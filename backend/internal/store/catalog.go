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
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if description.Valid {
		record.Description = &description.String
	}
	if multiplier.Valid {
		val := multiplier.Float64
		record.Multiplier = &val
	}
	if baseWeight.Valid {
		val := baseWeight.Float64
		record.BaseWeightKg = &val
	}
	if err := json.Unmarshal(linksJSON, &record.Links); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(primaryJSON, &record.PrimaryMuscles); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(secondaryJSON, &record.SecondaryMuscles); err != nil {
		return nil, err
	}
	if record.Links == nil {
		record.Links = []string{}
	}
	if record.PrimaryMuscles == nil {
		record.PrimaryMuscles = []string{}
	}
	if record.SecondaryMuscles == nil {
		record.SecondaryMuscles = []string{}
	}
	return &record, nil
}

func (s *Catalog) UpdateCatalogEntry(ctx context.Context, id string, entry CatalogEntry) error {
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
	if err = updateCatalogEntry(ctx, tx, trimmed, entry); err != nil {
		return err
	}
	return tx.Commit()
}

func updateCatalogEntry(ctx context.Context, tx *sqlx.Tx, id string, entry CatalogEntry) error {
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
	for _, m := range primaryMuscles {
		if _, err := tx.ExecContext(ctx, `insert into muscle_types(name) values ($1) on conflict do nothing`, m); err != nil {
			return err
		}
	}
	secondary := sanitizeList(entry.SecondaryMuscles)
	for _, m := range secondary {
		if _, err := tx.ExecContext(ctx, `insert into muscle_types(name) values ($1) on conflict do nothing`, m); err != nil {
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
    links = $11
where id = $1
returning id
`
	var updatedID string
	if err := tx.QueryRowxContext(ctx, q, id, name, slug, description, typeVal, bodyPart, equipment, level, multiplier, baseWeight, links).Scan(&updatedID); err != nil {
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
	for _, muscle := range secondary {
		if _, err := tx.ExecContext(ctx, `
			insert into exercise_catalog_secondary_muscles (catalog_id, muscle)
			values ($1, $2)
			on conflict do nothing`, id, muscle); err != nil {
			return err
		}
	}
	return nil
}
