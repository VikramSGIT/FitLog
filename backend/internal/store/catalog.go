package store

import (
	"context"
	"regexp"
	"strings"

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
	PrimaryMuscle    *string  `json:"primaryMuscle,omitempty"`
	SecondaryMuscles []string `json:"secondaryMuscles,omitempty"`
}

var nonAlnum = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(name string) string {
	s := strings.ToLower(name)
	s = nonAlnum.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	return s
}

// Upsert inserts or updates catalog rows by slug.
func (s *Catalog) Upsert(ctx context.Context, entries []CatalogEntry) (int, error) {
	affected := 0
	for _, e := range entries {
		slug := slugify(e.Name)
		var sec []string
		if len(e.SecondaryMuscles) > 0 {
			sec = e.SecondaryMuscles
		}
		const q = `
insert into exercise_catalog (name, slug, primary_muscle, secondary_muscles)
values ($1, $2, $3, $4::text[])
on conflict (slug) do update
set name = excluded.name,
    primary_muscle = coalesce(excluded.primary_muscle, exercise_catalog.primary_muscle),
    secondary_muscles = coalesce(excluded.secondary_muscles, exercise_catalog.secondary_muscles)
`
		if _, err := s.db.ExecContext(ctx, q, e.Name, slug, e.PrimaryMuscle, sec); err != nil {
			return affected, err
		}
		affected++
	}
	return affected, nil
}


