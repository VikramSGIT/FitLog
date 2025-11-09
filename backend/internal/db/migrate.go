package db

import (
	"context"
	"embed"
	"fmt"
	"sort"
	"strings"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

type migration struct {
	Name string
	SQL  string
}

func (db *DB) Migrate(ctx context.Context) error {
	if _, err := db.ExecContext(ctx, `
		create table if not exists schema_migrations (
			id serial primary key,
			name text not null unique,
			applied_at timestamptz not null default now()
		);
	`); err != nil {
		return fmt.Errorf("ensure schema_migrations: %w", err)
	}

	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}
	var migs []migration
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		b, err := migrationFS.ReadFile("migrations/" + e.Name())
		if err != nil {
			return fmt.Errorf("read migration %s: %w", e.Name(), err)
		}
		migs = append(migs, migration{Name: e.Name(), SQL: string(b)})
	}
	sort.Slice(migs, func(i, j int) bool { return migs[i].Name < migs[j].Name })

	applied := map[string]bool{}
	rows, err := db.QueryxContext(ctx, `select name from schema_migrations`)
	if err != nil {
		return fmt.Errorf("read applied migrations: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return err
		}
		applied[name] = true
	}
	for _, m := range migs {
		if applied[m.Name] {
			continue
		}
		if strings.TrimSpace(m.SQL) == "" {
			continue
		}
		if _, err := db.ExecContext(ctx, m.SQL); err != nil {
			return fmt.Errorf("apply migration %s: %w", m.Name, err)
		}
		if _, err := db.ExecContext(ctx, `insert into schema_migrations(name) values ($1)`, m.Name); err != nil {
			return fmt.Errorf("record migration %s: %w", m.Name, err)
		}
	}
	return nil
}


