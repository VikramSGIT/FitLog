package store

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/jackc/pgconn"
	"github.com/jmoiron/sqlx"

	"exercise-tracker/internal/models"
)

var ErrRestDayHasExercises = errors.New("workout day still has exercises")

type Days struct {
	db *sqlx.DB
}

func NewDays(db *sqlx.DB) *Days {
	return &Days{db: db}
}

func (s *Days) GetOrCreate(ctx context.Context, userID string, date time.Time) (*models.WorkoutDay, error) {
	d, err := s.GetByUserAndDate(ctx, userID, date)
	if err != nil {
		return nil, err
	}
	if d != nil {
		return d, nil
	}
	return s.Create(ctx, userID, date)
}

func (s *Days) GetByUserAndDate(ctx context.Context, userID string, date time.Time) (*models.WorkoutDay, error) {
	const q = `
		select id, user_id, workout_date, timezone, notes, is_rest_day, created_at, updated_at
		from workout_days
		where user_id = $1 and workout_date = $2
	`
	d := new(models.WorkoutDay)
	if err := s.db.QueryRowxContext(ctx, q, userID, date).StructScan(d); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return d, nil
}

func (s *Days) Create(ctx context.Context, userID string, date time.Time) (*models.WorkoutDay, error) {
	const q = `
		insert into workout_days (user_id, workout_date)
		values ($1, $2)
		on conflict (user_id, workout_date) do update set workout_date = excluded.workout_date
		returning id, user_id, workout_date, timezone, notes, is_rest_day, created_at, updated_at
	`
	d := new(models.WorkoutDay)
	if err := s.db.QueryRowxContext(ctx, q, userID, date).StructScan(d); err != nil {
		return nil, err
	}
	return d, nil
}

func (s *Days) GetWithDetails(ctx context.Context, userID, dayID string) (*models.DayWithDetails, error) {
	day := new(models.WorkoutDay)
	if err := s.db.QueryRowxContext(ctx,
		`select id, user_id, workout_date, timezone, notes, is_rest_day, created_at, updated_at
		 from workout_days where id = $1 and user_id = $2`, dayID, userID).StructScan(day); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	// Load exercises
	rows, err := s.db.QueryxContext(ctx, `
		select id, day_id, catalog_id, name, position, comment, created_at, updated_at
		from exercises
		where day_id = $1
		order by position, created_at`, dayID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var exercises []models.Exercise
	for rows.Next() {
		var ex models.Exercise
		if err := rows.StructScan(&ex); err != nil {
			return nil, err
		}
		exercises = append(exercises, ex)
	}
	// Load sets per exercise (simple N+1 for clarity)
	for i := range exercises {
		sets, err := s.ListSetsByExercise(ctx, exercises[i].ID)
		if err != nil {
			return nil, err
		}
		exercises[i].Sets = sets
	}
	return &models.DayWithDetails{WorkoutDay: *day, Exercises: exercises}, nil
}

func (s *Days) SetRestDay(ctx context.Context, userID, dayID string, rest bool) (*models.WorkoutDay, error) {
	const q = `
		update workout_days
		set is_rest_day = $3
		where id = $1 and user_id = $2
		returning id, user_id, workout_date, timezone, notes, is_rest_day, created_at, updated_at
	`
	d := new(models.WorkoutDay)
	if err := s.db.QueryRowxContext(ctx, q, dayID, userID, rest).StructScan(d); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.ConstraintName == "rest_day_requires_no_exercises" {
			return nil, ErrRestDayHasExercises
		}
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return d, nil
}

func (s *Days) ListSetsByExercise(ctx context.Context, exerciseID string) ([]models.Set, error) {
	rows, err := s.db.QueryxContext(ctx, `
		select id, exercise_id, user_id, workout_date, position, reps, weight_kg, rpe,
		       is_warmup, rest_seconds, tempo, performed_at, drop_set_group_id,
		       volume_kg, created_at, updated_at
		from sets
		where exercise_id = $1
		order by position, created_at
	`, exerciseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Set
	for rows.Next() {
		var s models.Set
		if err := rows.StructScan(&s); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, nil
}
