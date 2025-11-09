package main

import (
	"context"
	"encoding/csv"
	"flag"
	"log"
	"os"
	"regexp"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/jmoiron/sqlx"
)

var nonAlnum = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(name string) string {
	s := strings.ToLower(name)
	s = nonAlnum.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

type Row struct {
	Title     string
	Desc      string
	Type      string
	BodyPart  string
	Equipment string
	Level     string
}

func main() {
	var (
		dbURL string
		csvPath string
		dryRun bool
		batch int
	)
	flag.StringVar(&dbURL, "db", os.Getenv("DATABASE_URL"), "Postgres connection URL (or env DATABASE_URL)")
	flag.StringVar(&csvPath, "csv", "megaGymDataset.csv", "Path to megaGymDataset.csv")
	flag.BoolVar(&dryRun, "dry-run", false, "Parse only; do not write to DB")
	flag.IntVar(&batch, "batch", 500, "Batch size for DB upserts")
	flag.Parse()

	f, err := os.Open(csvPath)
	if err != nil {
		log.Fatalf("open csv: %v", err)
	}
	defer f.Close()
	r := csv.NewReader(f)
	r.FieldsPerRecord = -1

	headers, err := r.Read()
	if err != nil {
		log.Fatalf("read header: %v", err)
	}
	idx := func(name string) int {
		for i, h := range headers {
			if strings.EqualFold(strings.TrimSpace(h), name) {
				return i
			}
		}
		return -1
	}
	iTitle := idx("Title")
	iDesc := idx("Desc")
	iType := idx("Type")
	iBody := idx("BodyPart")
	iEquip := idx("Equipment")
	iLevel := idx("Level")
	if iTitle < 0 {
		log.Fatalf("Title column not found")
	}

	var rows []Row
	for {
		rec, err := r.Read()
		if err != nil {
			if err.Error() == "EOF" {
				break
			}
			if strings.Contains(err.Error(), "EOF") {
				break
			}
			log.Fatalf("read row: %v", err)
		}
		// Skip empty/short rows
		if len(rec) <= iTitle {
			continue
		}
		title := strings.TrimSpace(rec[iTitle])
		if title == "" {
			continue
		}
		row := Row{
			Title:     title,
			Desc:      pick(rec, iDesc),
			Type:      pick(rec, iType),
			BodyPart:  pick(rec, iBody),
			Equipment: pick(rec, iEquip),
			Level:     pick(rec, iLevel),
		}
		rows = append(rows, row)
	}
	log.Printf("parsed %d rows", len(rows))
	if dryRun {
		for i := 0; i < len(rows) && i < 10; i++ {
			log.Printf("%3d: %s [%s] %s | %s", i+1, rows[i].Title, rows[i].Level, rows[i].Type, rows[i].BodyPart)
		}
		return
	}
	if dbURL == "" {
		log.Fatalf("DATABASE_URL or --db is required unless --dry-run")
	}

	db, err := sqlx.Open("pgx", dbURL)
	if err != nil {
		log.Fatalf("db open: %v", err)
	}
	defer db.Close()
	ctx := context.Background()
	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("db ping: %v", err)
	}

	start := time.Now()
	for i := 0; i < len(rows); i += batch {
		end := i + batch
		if end > len(rows) {
			end = len(rows)
		}
		err := transact(ctx, db, func(tx *sqlx.Tx) error {
			for _, row := range rows[i:end] {
				if err := upsertCatalog(ctx, tx, row); err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			log.Fatalf("batch upsert failed at %d-%d: %v", i, end, err)
		}
		log.Printf("upserted %d/%d", end, len(rows))
	}
	log.Printf("done in %s", time.Since(start).Truncate(time.Millisecond))
}

func pick(rec []string, i int) string {
	if i >= 0 && i < len(rec) {
		return strings.TrimSpace(rec[i])
	}
	return ""
}

func transact(ctx context.Context, db *sqlx.DB, fn func(*sqlx.Tx) error) error {
	tx, err := db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p)
		}
	}()
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

func upsertCatalog(ctx context.Context, tx *sqlx.Tx, r Row) error {
	slug := slugify(r.Title)
	// Ensure reference values exist (FKs)
	if strings.TrimSpace(r.Type) != "" {
		if _, err := tx.ExecContext(ctx, `insert into exercise_types(name) values ($1) on conflict do nothing`, r.Type); err != nil {
			return err
		}
	}
	if strings.TrimSpace(r.BodyPart) != "" {
		if _, err := tx.ExecContext(ctx, `insert into body_parts(name) values ($1) on conflict do nothing`, r.BodyPart); err != nil {
			return err
		}
	}
	if strings.TrimSpace(r.Equipment) != "" {
		if _, err := tx.ExecContext(ctx, `insert into equipment_types(name) values ($1) on conflict do nothing`, r.Equipment); err != nil {
			return err
		}
	}
	if strings.TrimSpace(r.Level) != "" {
		if _, err := tx.ExecContext(ctx, `insert into levels(name) values ($1) on conflict do nothing`, r.Level); err != nil {
			return err
		}
	}
	const q = `
insert into exercise_catalog (name, slug, description, type, body_part, equipment, level, links)
values ($1, $2, $3, $4, $5, $6, $7, '{}'::text[])
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    type = excluded.type,
    body_part = excluded.body_part,
    equipment = excluded.equipment,
    level = excluded.level
`
	_, err := tx.ExecContext(ctx, q, r.Title, slug, r.Desc, r.Type, r.BodyPart, r.Equipment, r.Level)
	return err
}


