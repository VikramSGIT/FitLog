package store

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgconn"
	"github.com/jmoiron/sqlx"

	"exercise-tracker/internal/models"
)

var ErrExerciseOnRestDay = errors.New("cannot add exercise to a rest day")

type Exercises struct {
	db *sqlx.DB
}

func NewExercises(db *sqlx.DB) *Exercises { return &Exercises{db: db} }

func (s *Exercises) Create(ctx context.Context, userID, dayID, name string, position int, catalogID *string, comment *string) (*models.Exercise, error) {
	const q = `
		insert into exercises (day_id, catalog_id, name, position, comment)
		select $1, $2, $3, $4, $5
		where exists(select 1 from workout_days where id = $1 and user_id = $6)
		returning id, day_id, catalog_id, name, position, comment, created_at, updated_at
	`
	var ex models.Exercise
	if err := s.db.QueryRowxContext(ctx, q, dayID, catalogID, name, position, comment, userID).StructScan(&ex); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.ConstraintName == "exercises_require_training_day" {
			return nil, ErrExerciseOnRestDay
		}
		return nil, err
	}
	return &ex, nil
}

func (s *Exercises) Update(ctx context.Context, userID, id string, name *string, position *int, catalogID *string, comment *string) (*models.Exercise, error) {
	const q = `
		update exercises e
		set name = coalesce($3, e.name),
		    position = coalesce($4, e.position),
		    catalog_id = coalesce($5, e.catalog_id),
		    comment = coalesce($6, e.comment)
		where e.id = $1
		  and exists (select 1 from workout_days d where d.id = e.day_id and d.user_id = $2)
		returning id, day_id, catalog_id, name, position, comment, created_at, updated_at
	`
	var ex models.Exercise
	if err := s.db.QueryRowxContext(ctx, q, id, userID, name, position, catalogID, comment).StructScan(&ex); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &ex, nil
}

func (s *Exercises) Delete(ctx context.Context, userID, id string) (bool, error) {
	const q = `
		delete from exercises e
		where e.id = $1
		  and exists (select 1 from workout_days d where d.id = e.day_id and d.user_id = $2)
	`
	res, err := s.db.ExecContext(ctx, q, id, userID)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}
