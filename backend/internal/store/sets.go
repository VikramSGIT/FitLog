package store

import (
	"context"
	"database/sql"
	"time"

	"github.com/jmoiron/sqlx"

	"exercise-tracker/internal/models"
)

type Sets struct {
	db *sqlx.DB
}

func NewSets(db *sqlx.DB) *Sets { return &Sets{db: db} }

type CreateSetParams struct {
	ExerciseID  string
	UserID      string
	Position    int
	Reps        int
	WeightKg    float64
	RPE         *float64
	IsWarmup    bool
	RestSeconds *int
	Tempo       *string
	PerformedAt *time.Time
}

func (s *Sets) Create(ctx context.Context, p CreateSetParams) (*models.Set, error) {
	const q = `
		insert into sets (exercise_id, user_id, workout_date, position, reps, weight_kg, rpe, is_warmup, rest_seconds, tempo, performed_at)
		select $1, d.user_id, d.workout_date, $3, $4, $5, $6, $7, $8, $9, $10
		from exercises e join workout_days d on d.id = e.day_id
		where e.id = $1 and d.user_id = $2
		returning id, exercise_id, user_id, workout_date, position, reps, weight_kg, rpe,
		          is_warmup, rest_seconds, tempo, performed_at,
				  volume_kg, created_at, updated_at
	`
	var out models.Set
	if err := s.db.QueryRowxContext(ctx, q,
		p.ExerciseID, p.UserID, p.Position, p.Reps, p.WeightKg, p.RPE, p.IsWarmup, p.RestSeconds, p.Tempo, p.PerformedAt,
	).StructScan(&out); err != nil {
		return nil, err
	}
	return &out, nil
}

type UpdateSetParams struct {
	ID          string
	UserID      string
	Position    *int
	Reps        *int
	WeightKg    *float64
	RPE         *float64
	IsWarmup    *bool
	RestSeconds *int
	Tempo       *string
	PerformedAt *time.Time
}

func (s *Sets) Update(ctx context.Context, p UpdateSetParams) (*models.Set, error) {
	const q = `
		update sets s set
		  position = coalesce($3, s.position),
		  reps = coalesce($4, s.reps),
		  weight_kg = coalesce($5, s.weight_kg),
		  rpe = coalesce($6, s.rpe),
		  is_warmup = coalesce($7, s.is_warmup),
		  rest_seconds = coalesce($8, s.rest_seconds),
		  tempo = coalesce($9, s.tempo),
		  performed_at = coalesce($10, s.performed_at)
		where s.id = $1 and s.user_id = $2
		returning id, exercise_id, user_id, workout_date, position, reps, weight_kg, rpe,
		          is_warmup, rest_seconds, tempo, performed_at,
				  volume_kg, created_at, updated_at
	`
	var out models.Set
	if err := s.db.QueryRowxContext(ctx, q,
		p.ID, p.UserID, p.Position, p.Reps, p.WeightKg, p.RPE, p.IsWarmup, p.RestSeconds, p.Tempo, p.PerformedAt,
	).StructScan(&out); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &out, nil
}

func (s *Sets) Delete(ctx context.Context, id, userID string) (bool, error) {
	res, err := s.db.ExecContext(ctx, `delete from sets where id = $1 and user_id = $2`, id, userID)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

type CreateRestParams struct {
	ExerciseID      string
	UserID          string
	Position        int
	DurationSeconds int
}

func (s *Sets) CreateRest(ctx context.Context, p CreateRestParams) (*models.RestPeriod, error) {
	const q = `
		insert into rest_periods (exercise_id, position, duration_seconds)
		select $1, $3, $4
		from exercises e
		join workout_days d on d.id = e.day_id
		where e.id = $1 and d.user_id = $2
		returning id, exercise_id, position, duration_seconds, created_at, updated_at
	`
	var out models.RestPeriod
	if err := s.db.QueryRowxContext(ctx, q,
		p.ExerciseID, p.UserID, p.Position, p.DurationSeconds,
	).StructScan(&out); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &out, nil
}

type UpdateRestParams struct {
	ID              string
	UserID          string
	Position        *int
	DurationSeconds *int
}

func (s *Sets) UpdateRest(ctx context.Context, p UpdateRestParams) (*models.RestPeriod, error) {
	const q = `
		update rest_periods rp set
		  position = coalesce($3, rp.position),
		  duration_seconds = coalesce($4, rp.duration_seconds),
		  updated_at = now()
		from exercises e
		join workout_days d on d.id = e.day_id
		where rp.id = $1
		  and rp.exercise_id = e.id
		  and d.user_id = $2
		returning rp.id, rp.exercise_id, rp.position, rp.duration_seconds, rp.created_at, rp.updated_at
	`
	var out models.RestPeriod
	if err := s.db.QueryRowxContext(ctx, q,
		p.ID, p.UserID, p.Position, p.DurationSeconds,
	).StructScan(&out); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &out, nil
}

func (s *Sets) DeleteRest(ctx context.Context, restID, userID string) (bool, error) {
	const q = `
		delete from rest_periods rp
		using exercises e
		join workout_days d on d.id = e.day_id
		where rp.id = $1
		  and rp.exercise_id = e.id
		  and d.user_id = $2
	`
	res, err := s.db.ExecContext(ctx, q, restID, userID)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}
