package store

import (
	"testing"
	"time"

	"exercise-tracker/internal/models"
)

func TestBuildExerciseTimelineOrdersEntries(t *testing.T) {
	sets := []models.Set{
		{
			ID:          "set-1",
			ExerciseID:  "ex",
			UserID:      "user",
			WorkoutDate: time.Now(),
			Position:    1,
			Reps:        8,
			WeightKg:    80,
		},
		{
			ID:          "set-2",
			ExerciseID:  "ex",
			UserID:      "user",
			WorkoutDate: time.Now(),
			Position:    2,
			Reps:        6,
			WeightKg:    90,
		},
	}
	rests := []models.RestPeriod{
		{ID: "rest-pre", ExerciseID: "ex", Position: 0, DurationSeconds: 45},
		{ID: "rest-mid", ExerciseID: "ex", Position: 1, DurationSeconds: 60},
		{ID: "rest-tail", ExerciseID: "ex", Position: 5, DurationSeconds: 75},
	}

	timeline := buildExerciseTimeline(sets, rests)

	if len(timeline) != 5 {
		t.Fatalf("expected 5 timeline entries, got %d", len(timeline))
	}
	assertEntry := func(entry models.ExerciseEntry, wantKind string, wantID string) {
		t.Helper()
		if entry.Kind != wantKind {
			t.Fatalf("expected kind %s, got %s", wantKind, entry.Kind)
		}
		switch wantKind {
		case "set":
			if entry.Set == nil || entry.Set.ID != wantID {
				t.Fatalf("expected set id %s, got %#v", wantID, entry.Set)
			}
		case "rest":
			if entry.Rest == nil || entry.Rest.ID != wantID {
				t.Fatalf("expected rest id %s, got %#v", wantID, entry.Rest)
			}
		default:
			t.Fatalf("unexpected kind %s", wantKind)
		}
	}

	assertEntry(timeline[0], "rest", "rest-pre")
	assertEntry(timeline[1], "set", "set-1")
	assertEntry(timeline[2], "rest", "rest-mid")
	assertEntry(timeline[3], "set", "set-2")
	assertEntry(timeline[4], "rest", "rest-tail")
}


