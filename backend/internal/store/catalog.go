package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
)

type Catalog struct {
	db *sqlx.DB
}

func NewCatalog(db *sqlx.DB) *Catalog {
	return &Catalog{db: db}
}

type CatalogEntry struct {
	Name             string   `json:"name"`
	Description      *string  `json:"description,omitempty"`
	Type             string   `json:"type"`
	BodyPart         string   `json:"bodyPart"`
	Equipment        string   `json:"equipment"`
	Level            string   `json:"level"`
	PrimaryMuscles   []string `json:"primaryMuscles"`
	SecondaryMuscles []string `json:"secondaryMuscles,omitempty"`
	Links            []string `json:"links,omitempty"`
	Multiplier       *float64 `json:"multiplier,omitempty"`
	BaseWeightKg     *float64 `json:"baseWeightKg,omitempty"`
}

type CatalogRecord struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	Slug             string    `json:"slug"`
	Description      *string   `json:"description,omitempty"`
	Type             string    `json:"type"`
	BodyPart         string    `json:"bodyPart"`
	Equipment        string    `json:"equipment"`
	Level            string    `json:"level"`
	PrimaryMuscles   []string  `json:"primaryMuscles"`
	SecondaryMuscles []string  `json:"secondaryMuscles"`
	Links            []string  `json:"links"`
	Multiplier       *float64  `json:"multiplier,omitempty"`
	BaseWeightKg     *float64  `json:"baseWeightKg,omitempty"`
	HasImage         bool      `json:"hasImage"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

var nonAlnum = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(name string) string {
	s := strings.ToLower(name)
	s = nonAlnum.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	return s
}

// Upsert inserts or updates catalog rows by slug.
func (s *Catalog) Upsert(ctx context.Context, entries []CatalogEntry) (affected int, err error) {
	if len(entries) == 0 {
		return 0, nil
	}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()
	for _, entry := range entries {
		if err = upsertCatalogEntry(ctx, tx, entry); err != nil {
			return affected, err
		}
		affected++
	}
	if err = tx.Commit(); err != nil {
		return affected, err
	}
	return affected, nil
}

func upsertCatalogEntry(ctx context.Context, tx *sqlx.Tx, entry CatalogEntry) error {
	name := strings.TrimSpace(entry.Name)
	if name == "" {
		return fmt.Errorf("catalog name is required")
	}
	slug := slugify(name)
	var (
		description sql.NullString
		multiplier  sql.NullFloat64
		baseWeight  sql.NullFloat64
	)
	if entry.Description != nil {
		if trimmed := strings.TrimSpace(*entry.Description); trimmed != "" {
			description = sql.NullString{String: trimmed, Valid: true}
		}
	}
	typeVal, err := normalizeRequired("type", entry.Type)
	if err != nil {
		return err
	}
	bodyPart, err := normalizeRequired("bodyPart", entry.BodyPart)
	if err != nil {
		return err
	}
	equipment, err := normalizeRequired("equipment", entry.Equipment)
	if err != nil {
		return err
	}
	level, err := normalizeRequired("level", entry.Level)
	if err != nil {
		return err
	}
	primaryMuscles := sanitizeList(entry.PrimaryMuscles)
	if len(primaryMuscles) == 0 {
		return fmt.Errorf("primaryMuscles is required")
	}
	if entry.Multiplier != nil {
		multiplier = sql.NullFloat64{Float64: *entry.Multiplier, Valid: true}
	}
	if entry.BaseWeightKg != nil {
		baseWeight = sql.NullFloat64{Float64: *entry.BaseWeightKg, Valid: true}
	}
	secondaries := sanitizeList(entry.SecondaryMuscles)

	for _, ref := range []struct {
		value string
		sql   string
	}{
		{typeVal, `insert into exercise_types(name) values ($1) on conflict do nothing`},
		{bodyPart, `insert into body_parts(name) values ($1) on conflict do nothing`},
		{equipment, `insert into equipment_types(name) values ($1) on conflict do nothing`},
		{level, `insert into levels(name) values ($1) on conflict do nothing`},
	} {
		if _, err := tx.ExecContext(ctx, ref.sql, ref.value); err != nil {
			return err
		}
	}
	for _, muscle := range primaryMuscles {
		if _, err := tx.ExecContext(ctx, `insert into muscle_types(name) values ($1) on conflict do nothing`, muscle); err != nil {
			return err
		}
	}
	for _, muscle := range secondaries {
		if _, err := tx.ExecContext(ctx, `insert into muscle_types(name) values ($1) on conflict do nothing`, muscle); err != nil {
			return err
		}
	}
	links := sanitizeList(entry.Links)
	if links == nil {
		links = []string{}
	}
	const q = `
insert into exercise_catalog (name, slug, description, type, body_part, equipment, level, multiplier, base_weight_kg, links)
values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, 1), coalesce($9, 0), $10)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    type = excluded.type,
    body_part = excluded.body_part,
    equipment = excluded.equipment,
    level = excluded.level,
    multiplier = case when $8 is null then exercise_catalog.multiplier else excluded.multiplier end,
    base_weight_kg = case when $9 is null then exercise_catalog.base_weight_kg else excluded.base_weight_kg end,
    links = excluded.links
returning id
`
	var catalogID string
	if err := tx.QueryRowxContext(ctx, q, name, slug, description, typeVal, bodyPart, equipment, level, multiplier, baseWeight, links).Scan(&catalogID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `delete from exercise_catalog_primary_muscles where catalog_id = $1`, catalogID); err != nil {
		return err
	}
	for _, muscle := range primaryMuscles {
		if _, err := tx.ExecContext(ctx, `
			insert into exercise_catalog_primary_muscles (catalog_id, muscle)
			values ($1, $2)
			on conflict do nothing`, catalogID, muscle); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `delete from exercise_catalog_secondary_muscles where catalog_id = $1`, catalogID); err != nil {
		return err
	}
	for _, muscle := range secondaries {
		if _, err := tx.ExecContext(ctx, `
			insert into exercise_catalog_secondary_muscles (catalog_id, muscle)
			values ($1, $2)
			on conflict do nothing`, catalogID, muscle); err != nil {
			return err
		}
	}
	return nil
}

func normalizeRequired(field, value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", fmt.Errorf("%s is required", field)
	}
	return trimmed, nil
}

func sanitizeList(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	seen := make(map[string]struct{})
	out := make([]string, 0, len(values))
	for _, v := range values {
		trimmed := strings.TrimSpace(v)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		out = append(out, trimmed)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func (s *Catalog) GetCatalogEntry(ctx context.Context, id string) (*CatalogRecord, error) {
	trimmed := strings.TrimSpace(id)
	if trimmed == "" {
		return nil, fmt.Errorf("id is required")
	}
	const q = `
select
  ec.id,
  ec.name,
  ec.slug,
  ec.description,
  ec.type,
  ec.body_part,
  ec.equipment,
  ec.level,
  coalesce((
    select array_to_json(array_agg(pm.muscle order by pm.muscle))
    from exercise_catalog_primary_muscles pm
    where pm.catalog_id = ec.id
  ), '[]'::json) as primary_json,
  ec.multiplier,
  ec.base_weight_kg,
  coalesce(array_to_json(ec.links), '[]'::json) as links_json,
  coalesce((
    select array_to_json(array_agg(sm.muscle order by sm.muscle))
    from exercise_catalog_secondary_muscles sm
    where sm.catalog_id = ec.id
  ), '[]'::json) as secondary_json,
  case when ec.image_data is not null then true else false end as has_image,
  ec.created_at,
  ec.updated_at
from exercise_catalog ec
where ec.id = $1
`
	var (
		record        CatalogRecord
		description   sql.NullString
		multiplier    sql.NullFloat64
		baseWeight    sql.NullFloat64
		primaryJSON   []byte
		linksJSON     []byte
		secondaryJSON []byte
	)
	if err := s.db.QueryRowxContext(ctx, q, trimmed).Scan(
		&record.ID,
		&record.Name,
		&record.Slug,
		&description,
		&record.Type,
		&record.BodyPart,
		&record.Equipment,
		&record.Level,
		&primaryJSON,
		&multiplier,
		&baseWeight,
		&linksJSON,
		&secondaryJSON,
		&record.HasImage,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if description.Valid {
		record.Description = &description.String
	}
	if multiplier.Valid {
		record.Multiplier = &multiplier.Float64
	}
	if baseWeight.Valid {
		record.BaseWeightKg = &baseWeight.Float64
	}
	if err := json.Unmarshal(primaryJSON, &record.PrimaryMuscles); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(linksJSON, &record.Links); err != nil {
		return nil, err
	}
	if record.Links == nil {
		record.Links = []string{}
	}
	if err := json.Unmarshal(secondaryJSON, &record.SecondaryMuscles); err != nil {
		return nil, err
	}
	if record.PrimaryMuscles == nil {
		record.PrimaryMuscles = []string{}
	}
	if record.SecondaryMuscles == nil {
		record.SecondaryMuscles = []string{}
	}
	return &record, nil
}

func (s *Catalog) UpdateCatalogEntry(ctx context.Context, id string, entry CatalogEntry, imageData []byte, imageMimeType string, removeImage bool) error {
	trimmed := strings.TrimSpace(id)
	if trimmed == "" {
		return fmt.Errorf("id is required")
	}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()
	if err = updateCatalogEntry(ctx, tx, trimmed, entry, imageData, imageMimeType, removeImage); err != nil {
		return err
	}
	return tx.Commit()
}

func updateCatalogEntry(ctx context.Context, tx *sqlx.Tx, id string, entry CatalogEntry, imageData []byte, imageMimeType string, removeImage bool) error {

	name := strings.TrimSpace(entry.Name)
	if name == "" {
		return fmt.Errorf("catalog name is required")
	}
	slug := slugify(name)
	var (
		description sql.NullString
		multiplier  sql.NullFloat64
		baseWeight  sql.NullFloat64
	)
	if entry.Description != nil {
		if trimmed := strings.TrimSpace(*entry.Description); trimmed != "" {
			description = sql.NullString{String: trimmed, Valid: true}
		}
	}
	typeVal, err := normalizeRequired("type", entry.Type)
	if err != nil {
		return err
	}
	bodyPart, err := normalizeRequired("bodyPart", entry.BodyPart)
	if err != nil {
		return err
	}
	equipment, err := normalizeRequired("equipment", entry.Equipment)
	if err != nil {
		return err
	}
	level, err := normalizeRequired("level", entry.Level)
	if err != nil {
		return err
	}
	primaryMuscles := sanitizeList(entry.PrimaryMuscles)
	if len(primaryMuscles) == 0 {
		return fmt.Errorf("primaryMuscles is required")
	}
	if entry.Multiplier != nil {
		multiplier = sql.NullFloat64{Float64: *entry.Multiplier, Valid: true}
	}
	if entry.BaseWeightKg != nil {
		baseWeight = sql.NullFloat64{Float64: *entry.BaseWeightKg, Valid: true}
	}
	secondaries := sanitizeList(entry.SecondaryMuscles)

	for _, ref := range []struct {
		value string
		sql   string
	}{
		{typeVal, `insert into exercise_types(name) values ($1) on conflict do nothing`},
		{bodyPart, `insert into body_parts(name) values ($1) on conflict do nothing`},
		{equipment, `insert into equipment_types(name) values ($1) on conflict do nothing`},
		{level, `insert into levels(name) values ($1) on conflict do nothing`},
	} {
		if _, err := tx.ExecContext(ctx, ref.sql, ref.value); err != nil {
			return err
		}
	}
	for _, muscle := range primaryMuscles {
		if _, err := tx.ExecContext(ctx, `insert into muscle_types(name) values ($1) on conflict do nothing`, muscle); err != nil {
			return err
		}
	}
	for _, muscle := range secondaries {
		if _, err := tx.ExecContext(ctx, `insert into muscle_types(name) values ($1) on conflict do nothing`, muscle); err != nil {
			return err
		}
	}
	links := sanitizeList(entry.Links)
	if links == nil {
		links = []string{}
	}
	const q = `
update exercise_catalog
set name = $2,
    slug = $3,
    description = $4,
    type = $5,
    body_part = $6,
    equipment = $7,
    level = $8,
    multiplier = coalesce($9, exercise_catalog.multiplier),
    base_weight_kg = coalesce($10, exercise_catalog.base_weight_kg),
    links = $11,
    image_data = case
      when octet_length($12::bytea) > 0 then $12
      when $13::boolean is true then null
      else exercise_catalog.image_data
    end,
    image_mime_type = case
      when octet_length($12::bytea) > 0 then nullif($14, '')
      when $13::boolean is true then null
      else exercise_catalog.image_mime_type
    end
where id = $1
returning id
`
	var updatedID string
	if err := tx.QueryRowxContext(ctx, q, id, name, slug, description, typeVal, bodyPart, equipment, level, multiplier, baseWeight, links, imageData, removeImage, strings.TrimSpace(imageMimeType)).Scan(&updatedID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `delete from exercise_catalog_primary_muscles where catalog_id = $1`, id); err != nil {
		return err
	}
	for _, muscle := range primaryMuscles {
		if _, err := tx.ExecContext(ctx, `
			insert into exercise_catalog_primary_muscles (catalog_id, muscle)
			values ($1, $2)
			on conflict do nothing`, id, muscle); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `delete from exercise_catalog_secondary_muscles where catalog_id = $1`, id); err != nil {
		return err
	}
	for _, muscle := range secondaries {
		if _, err := tx.ExecContext(ctx, `
			insert into exercise_catalog_secondary_muscles (catalog_id, muscle)
			values ($1, $2)
			on conflict do nothing`, id, muscle); err != nil {
			return err
		}
	}
	return nil
}

func (s *Catalog) GetCatalogImage(ctx context.Context, id string) ([]byte, string, error) {
	trimmed := strings.TrimSpace(id)
	if trimmed == "" {
		return nil, "", fmt.Errorf("id is required")
	}
	const q = `
select image_data, coalesce(image_mime_type, '')
from exercise_catalog
where id = $1`
	var (
		data     []byte
		mimeType string
	)
	if err := s.db.QueryRowxContext(ctx, q, trimmed).Scan(&data, &mimeType); err != nil {
		return nil, "", err
	}
	return data, mimeType, nil
}

func (s *Catalog) DeleteCatalogEntry(ctx context.Context, id string) error {
	trimmed := strings.TrimSpace(id)
	if trimmed == "" {
		return fmt.Errorf("id is required")
	}
	const q = `DELETE FROM exercise_catalog WHERE id = $1`
	result, err := s.db.ExecContext(ctx, q, trimmed)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Catalog) CreateCatalogEntryWithImage(ctx context.Context, entry CatalogEntry, imageData []byte, imageMimeType string) (*CatalogRecord, error) {
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()
	if err = createCatalogEntryWithImage(ctx, tx, entry, imageData, imageMimeType); err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	// Get the created entry by slug to return the full record
	slug := slugify(entry.Name)
	return s.GetCatalogEntryBySlug(ctx, slug)
}

func createCatalogEntryWithImage(ctx context.Context, tx *sqlx.Tx, entry CatalogEntry, imageData []byte, imageMimeType string) error {
	name := strings.TrimSpace(entry.Name)
	if name == "" {
		return fmt.Errorf("catalog name is required")
	}
	slug := slugify(name)
	var (
		description sql.NullString
		multiplier  sql.NullFloat64
		baseWeight  sql.NullFloat64
	)
	if entry.Description != nil {
		if trimmed := strings.TrimSpace(*entry.Description); trimmed != "" {
			description = sql.NullString{String: trimmed, Valid: true}
		}
	}
	typeVal, err := normalizeRequired("type", entry.Type)
	if err != nil {
		return err
	}
	bodyPart, err := normalizeRequired("bodyPart", entry.BodyPart)
	if err != nil {
		return err
	}
	equipment, err := normalizeRequired("equipment", entry.Equipment)
	if err != nil {
		return err
	}
	level, err := normalizeRequired("level", entry.Level)
	if err != nil {
		return err
	}
	primaryMuscles := sanitizeList(entry.PrimaryMuscles)
	if len(primaryMuscles) == 0 {
		return fmt.Errorf("primaryMuscles is required")
	}
	if entry.Multiplier != nil {
		multiplier = sql.NullFloat64{Float64: *entry.Multiplier, Valid: true}
	}
	if entry.BaseWeightKg != nil {
		baseWeight = sql.NullFloat64{Float64: *entry.BaseWeightKg, Valid: true}
	}
	secondaries := sanitizeList(entry.SecondaryMuscles)

	for _, ref := range []struct {
		value string
		sql   string
	}{
		{typeVal, `insert into exercise_types(name) values ($1) on conflict do nothing`},
		{bodyPart, `insert into body_parts(name) values ($1) on conflict do nothing`},
		{equipment, `insert into equipment_types(name) values ($1) on conflict do nothing`},
		{level, `insert into levels(name) values ($1) on conflict do nothing`},
	} {
		if _, err := tx.ExecContext(ctx, ref.sql, ref.value); err != nil {
			return err
		}
	}
	for _, muscle := range primaryMuscles {
		if _, err := tx.ExecContext(ctx, `insert into muscle_types(name) values ($1) on conflict do nothing`, muscle); err != nil {
			return err
		}
	}
	for _, muscle := range secondaries {
		if _, err := tx.ExecContext(ctx, `insert into muscle_types(name) values ($1) on conflict do nothing`, muscle); err != nil {
			return err
		}
	}
	links := sanitizeList(entry.Links)
	if links == nil {
		links = []string{}
	}
	const q = `
insert into exercise_catalog (name, slug, description, type, body_part, equipment, level, multiplier, base_weight_kg, links, image_data, image_mime_type)
values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, 1), coalesce($9, 0), $10, $11, $12)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    type = excluded.type,
    body_part = excluded.body_part,
    equipment = excluded.equipment,
    level = excluded.level,
    multiplier = case when $8 is null then exercise_catalog.multiplier else excluded.multiplier end,
    base_weight_kg = case when $9 is null then exercise_catalog.base_weight_kg else excluded.base_weight_kg end,
    links = excluded.links,
    image_data = case when octet_length($11::bytea) > 0 then $11 else exercise_catalog.image_data end,
    image_mime_type = case when octet_length($11::bytea) > 0 then nullif($12, '') else exercise_catalog.image_mime_type end
returning id
`
	var catalogID string
	mimeTypeStr := strings.TrimSpace(imageMimeType)
	if len(imageData) == 0 {
		mimeTypeStr = ""
	}
	if err := tx.QueryRowxContext(ctx, q, name, slug, description, typeVal, bodyPart, equipment, level, multiplier, baseWeight, links, imageData, mimeTypeStr).Scan(&catalogID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `delete from exercise_catalog_primary_muscles where catalog_id = $1`, catalogID); err != nil {
		return err
	}
	for _, muscle := range primaryMuscles {
		if _, err := tx.ExecContext(ctx, `
			insert into exercise_catalog_primary_muscles (catalog_id, muscle)
			values ($1, $2)
			on conflict do nothing`, catalogID, muscle); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `delete from exercise_catalog_secondary_muscles where catalog_id = $1`, catalogID); err != nil {
		return err
	}
	for _, muscle := range secondaries {
		if _, err := tx.ExecContext(ctx, `
			insert into exercise_catalog_secondary_muscles (catalog_id, muscle)
			values ($1, $2)
			on conflict do nothing`, catalogID, muscle); err != nil {
			return err
		}
	}
	return nil
}

func (s *Catalog) GetCatalogEntryBySlug(ctx context.Context, slug string) (*CatalogRecord, error) {
	trimmed := strings.TrimSpace(slug)
	if trimmed == "" {
		return nil, fmt.Errorf("slug is required")
	}
	const q = `
select
  ec.id,
  ec.name,
  ec.slug,
  ec.description,
  ec.type,
  ec.body_part,
  ec.equipment,
  ec.level,
  coalesce((
    select array_to_json(array_agg(pm.muscle order by pm.muscle))
    from exercise_catalog_primary_muscles pm
    where pm.catalog_id = ec.id
  ), '[]'::json) as primary_json,
  ec.multiplier,
  ec.base_weight_kg,
  coalesce(array_to_json(ec.links), '[]'::json) as links_json,
  coalesce((
    select array_to_json(array_agg(sm.muscle order by sm.muscle))
    from exercise_catalog_secondary_muscles sm
    where sm.catalog_id = ec.id
  ), '[]'::json) as secondary_json,
  case when ec.image_data is not null then true else false end as has_image,
  ec.created_at,
  ec.updated_at
from exercise_catalog ec
where ec.slug = $1
`
	var (
		record        CatalogRecord
		description   sql.NullString
		multiplier    sql.NullFloat64
		baseWeight    sql.NullFloat64
		primaryJSON   []byte
		linksJSON     []byte
		secondaryJSON []byte
	)
	if err := s.db.QueryRowxContext(ctx, q, trimmed).Scan(
		&record.ID,
		&record.Name,
		&record.Slug,
		&description,
		&record.Type,
		&record.BodyPart,
		&record.Equipment,
		&record.Level,
		&primaryJSON,
		&multiplier,
		&baseWeight,
		&linksJSON,
		&secondaryJSON,
		&record.HasImage,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if description.Valid {
		record.Description = &description.String
	}
	if multiplier.Valid {
		record.Multiplier = &multiplier.Float64
	}
	if baseWeight.Valid {
		record.BaseWeightKg = &baseWeight.Float64
	}
	if err := json.Unmarshal(primaryJSON, &record.PrimaryMuscles); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(linksJSON, &record.Links); err != nil {
		return nil, err
	}
	if record.Links == nil {
		record.Links = []string{}
	}
	if err := json.Unmarshal(secondaryJSON, &record.SecondaryMuscles); err != nil {
		return nil, err
	}
	if record.PrimaryMuscles == nil {
		record.PrimaryMuscles = []string{}
	}
	if record.SecondaryMuscles == nil {
		record.SecondaryMuscles = []string{}
	}
	return &record, nil
}

type ExerciseStats struct {
	HighestWeightKg float64              `json:"highestWeightKg"`
	History         []ExerciseHistoryItem `json:"history"`
}

type ExerciseHistoryItem struct {
	WorkoutDate string       `json:"workoutDate"`
	Sets        []SetHistory `json:"sets"`
}

type SetHistory struct {
	Reps     int     `json:"reps"`
	WeightKg float64 `json:"weightKg"`
	IsWarmup bool    `json:"isWarmup"`
}

func (s *Catalog) GetExerciseStats(ctx context.Context, catalogID string, userID string, limit, offset int) (*ExerciseStats, bool, error) {
	trimmed := strings.TrimSpace(catalogID)
	if trimmed == "" {
		return nil, false, fmt.Errorf("catalog id is required")
	}
	if strings.TrimSpace(userID) == "" {
		return nil, false, fmt.Errorf("user id is required")
	}

	// Get highest weight
	const highestWeightQ = `
	select max(s.weight_kg) as highest_weight
	from sets s
	join exercises e on e.id = s.exercise_id
	where e.catalog_id = $1 and s.user_id = $2 and s.is_warmup = false
	`
	var highestWeight sql.NullFloat64
	if err := s.db.QueryRowxContext(ctx, highestWeightQ, trimmed, userID).Scan(&highestWeight); err != nil {
		return nil, false, err
	}

	// Get distinct workout dates first, ordered by date descending
	const datesQ = `
	select distinct d.workout_date
	from sets s
	join exercises e on e.id = s.exercise_id
	join workout_days d on d.id = e.day_id
	where e.catalog_id = $1 and s.user_id = $2
	order by d.workout_date desc
	limit $3 offset $4
	`
	dateRows, err := s.db.QueryxContext(ctx, datesQ, trimmed, userID, limit, offset)
	if err != nil {
		return nil, false, err
	}
	defer dateRows.Close()

	var dates []time.Time
	for dateRows.Next() {
		var workoutDate time.Time
		if err := dateRows.Scan(&workoutDate); err != nil {
			return nil, false, err
		}
		dates = append(dates, workoutDate)
	}
	if err := dateRows.Err(); err != nil {
		return nil, false, err
	}

	// Check if there are more results
	hasMore := len(dates) == limit

	// Get exercise history for these dates
	if len(dates) == 0 {
		stats := &ExerciseStats{
			HighestWeightKg: 0,
			History:         []ExerciseHistoryItem{},
		}
		if highestWeight.Valid {
			stats.HighestWeightKg = highestWeight.Float64
		}
		return stats, false, nil
	}

	// Build query with date filter using IN clause
	datePlaceholders := make([]string, len(dates))
	args := make([]interface{}, len(dates)+2)
	args[0] = trimmed
	args[1] = userID
	for i, date := range dates {
		datePlaceholders[i] = fmt.Sprintf("$%d::date", i+3)
		args[i+2] = date
	}

	historyQ := fmt.Sprintf(`
	select 
		d.workout_date,
		s.reps,
		s.weight_kg,
		s.is_warmup
	from sets s
	join exercises e on e.id = s.exercise_id
	join workout_days d on d.id = e.day_id
	where e.catalog_id = $1 and s.user_id = $2 and d.workout_date in (%s)
	order by d.workout_date desc, s.position asc
	`, strings.Join(datePlaceholders, ","))

	rows, err := s.db.QueryxContext(ctx, historyQ, args...)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()

	historyMap := make(map[string][]SetHistory)
	for rows.Next() {
		var workoutDate time.Time
		var reps int
		var weightKg float64
		var isWarmup bool
		if err := rows.Scan(&workoutDate, &reps, &weightKg, &isWarmup); err != nil {
			return nil, false, err
		}
		dateStr := workoutDate.Format("2006-01-02")
		historyMap[dateStr] = append(historyMap[dateStr], SetHistory{
			Reps:     reps,
			WeightKg: weightKg,
			IsWarmup: isWarmup,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}

	// Convert map to sorted slice (already sorted by date descending from query)
	history := make([]ExerciseHistoryItem, 0, len(historyMap))
	for _, date := range dates {
		dateStr := date.Format("2006-01-02")
		if sets, ok := historyMap[dateStr]; ok {
			history = append(history, ExerciseHistoryItem{
				WorkoutDate: dateStr,
				Sets:        sets,
			})
		}
	}

	stats := &ExerciseStats{
		HighestWeightKg: 0,
		History:         history,
	}
	if highestWeight.Valid {
		stats.HighestWeightKg = highestWeight.Float64
	}

	return stats, hasMore, nil
}
