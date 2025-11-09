package models

import "time"

type User struct {
	ID           string    `db:"id" json:"id"`
	Email        string    `db:"email" json:"email"`
	PasswordHash string    `db:"password_hash" json:"-"`
	CreatedAt    time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt    time.Time `db:"updated_at" json:"updatedAt"`
}

type WorkoutDay struct {
	ID          string    `db:"id" json:"id"`
	UserID      string    `db:"user_id" json:"userId"`
	WorkoutDate time.Time `db:"workout_date" json:"workoutDate"`
	Timezone    *string   `db:"timezone" json:"timezone,omitempty"`
	Notes       *string   `db:"notes" json:"notes,omitempty"`
	IsRestDay   bool      `db:"is_rest_day" json:"isRestDay"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at" json:"updatedAt"`
}

type Exercise struct {
	ID        string     `db:"id" json:"id"`
	DayID     string     `db:"day_id" json:"dayId"`
	CatalogID *string    `db:"catalog_id" json:"catalogId,omitempty"`
	Name      string     `db:"name" json:"name"`
	Position  int        `db:"position" json:"position"`
	Comment   *string    `db:"comment" json:"comment,omitempty"`
	CreatedAt time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time  `db:"updated_at" json:"updatedAt"`
	Sets      []Set      `json:"sets,omitempty"`
}

type Set struct {
	ID              string     `db:"id" json:"id"`
	ExerciseID      string     `db:"exercise_id" json:"exerciseId"`
	UserID          string     `db:"user_id" json:"userId"`
	WorkoutDate     time.Time  `db:"workout_date" json:"workoutDate"`
	Position        int        `db:"position" json:"position"`
	Reps            int        `db:"reps" json:"reps"`
	WeightKg        float64    `db:"weight_kg" json:"weightKg"`
	RPE             *float64   `db:"rpe" json:"rpe,omitempty"`
	IsWarmup        bool       `db:"is_warmup" json:"isWarmup"`
	RestSeconds     *int       `db:"rest_seconds" json:"restSeconds,omitempty"`
	Tempo           *string    `db:"tempo" json:"tempo,omitempty"`
	PerformedAt     *time.Time `db:"performed_at" json:"performedAt,omitempty"`
	DropSetGroupID  *string    `db:"drop_set_group_id" json:"dropSetGroupId,omitempty"`
	VolumeKg        float64    `db:"volume_kg" json:"volumeKg"`
	CreatedAt       time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt       time.Time  `db:"updated_at" json:"updatedAt"`
}

// Composite response
type DayWithDetails struct {
	WorkoutDay
	Exercises []Exercise `json:"exercises"`
}


