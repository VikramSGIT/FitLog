package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
)

type Save struct {
	db *sqlx.DB
}

func NewSave(db *sqlx.DB) *Save { return &Save{db: db} }

// Operation envelopes (decoded per type)
type opType string

const (
	opCreateExercise   opType = "createExercise"
	opCreateSet        opType = "createSet"
	opUpdateExercise   opType = "updateExercise"
	opUpdateSet        opType = "updateSet"
	opReorderExercises opType = "reorderExercises"
	opReorderSets      opType = "reorderSets"
	opDeleteExercise   opType = "deleteExercise"
	opDeleteSet        opType = "deleteSet"
	opCreateRest       opType = "createRest"
	opUpdateRest       opType = "updateRest"
	opDeleteRest       opType = "deleteRest"
	opUpdateDay        opType = "updateDay"
	opCreateDay        opType = "createDay"
)

type opEnvelope struct {
	Type opType `json:"type"`
	// Keep raw for secondary decode
	raw json.RawMessage
}

func (o *opEnvelope) UnmarshalJSON(data []byte) error {
	type alias struct {
		Type opType `json:"type"`
	}
	var a alias
	if err := json.Unmarshal(data, &a); err != nil {
		return err
	}
	o.Type = a.Type
	o.raw = append(o.raw[:0], data...)
	return nil
}

// Create/update types
type createExerciseOp struct {
	Type      opType  `json:"type"`
	LocalID   string  `json:"localId"`
	DayID     string  `json:"dayId"`
	CatalogID string  `json:"catalogId"`
	Position  int     `json:"position"`
	Comment   *string `json:"comment,omitempty"`
}

type createSetOp struct {
	Type       opType  `json:"type"`
	LocalID    string  `json:"localId"`
	ExerciseID string  `json:"exerciseId"` // can be "temp:<id>"
	Position   int     `json:"position"`
	Reps       int     `json:"reps"`
	WeightKg   float64 `json:"weightKg"`
	IsWarmup   bool    `json:"isWarmup"`
}

type updateExerciseOp struct {
	Type  opType `json:"type"`
	ExerciseID string `json:"exerciseId"`
	Patch struct {
		Position *int    `json:"position"`
		Comment  *string `json:"comment"`
	} `json:"patch"`
}

type updateSetOp struct {
	Type  opType `json:"type"`
	SetID string `json:"setId"`
	Patch struct {
		Position  *int     `json:"position"`
		Reps      *int     `json:"reps"`
		WeightKg  *float64 `json:"weightKg"`
		IsWarmup  *bool    `json:"isWarmup"`
	} `json:"patch"`
}

type reorderExercisesOp struct {
	Type      opType   `json:"type"`
	DayID     string   `json:"dayId"`
	OrderedIDs []string `json:"orderedIds"`
}

type reorderSetsOp struct {
	Type       opType   `json:"type"`
	ExerciseID string   `json:"exerciseId"`
	OrderedIDs []string `json:"orderedIds"`
}

type deleteExerciseOp struct {
	Type opType `json:"type"`
	ExerciseID string `json:"exerciseId"`
}

type deleteSetOp struct {
	Type opType `json:"type"`
	SetID string `json:"setId"`
}

type createRestOp struct {
	Type       opType `json:"type"`
	LocalID    string `json:"localId"`
	ExerciseID string `json:"exerciseId"` // may be "temp:<id>"
	Position   int    `json:"position"`
	Duration   int    `json:"durationSeconds"`
}

type updateRestOp struct {
	Type  opType `json:"type"`
	RestID string `json:"restId"`
	Patch struct {
		Position *int `json:"position"`
		Duration *int `json:"durationSeconds"`
	} `json:"patch"`
}

type deleteRestOp struct {
	Type opType `json:"type"`
	RestID string `json:"restId"`
}

type updateDayOp struct {
	Type      opType `json:"type"`
	DayID     string `json:"dayId"`
	IsRestDay bool   `json:"isRestDay"`
}

type createDayOp struct {
	Type        opType `json:"type"`
	LocalID     string `json:"localId"`
	WorkoutDate string `json:"workoutDate"`
	Timezone    string `json:"timezone"`
}

// SaveMapping is returned to map temp -> real IDs created during the batch.
type SaveMapping struct {
	Exercises []LocalIdMap `json:"exercises"`
	Sets      []LocalIdMap `json:"sets"`
	Rests     []LocalIdMap `json:"rests"`
}

type LocalIdMap struct {
	LocalID string `json:"localId"`
	ID      string `json:"id"`
}

// ProcessBatch applies the ops within a single transaction using the prescribed ordering.
func (s *Save) ProcessBatch(ctx context.Context, userID string, rawOps []json.RawMessage, idKey string) (SaveMapping, time.Time, error) {
	if len(rawOps) == 0 {
		return SaveMapping{}, time.Now().UTC(), nil
	}
	log.Printf("save batch start key=%s user=%s ops=%d", safeStr(idKey), userID, len(rawOps))
	// Decode envelopes
	var envs []opEnvelope
	envs = make([]opEnvelope, 0, len(rawOps))
	for _, r := range rawOps {
		var e opEnvelope
		if err := json.Unmarshal(r, &e); err != nil {
			return SaveMapping{}, time.Time{}, fmt.Errorf("invalid op: %w", err)
		}
		envs = append(envs, e)
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return SaveMapping{}, time.Time{}, err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	tempToRealExercise := make(map[string]string)
	tempToRealDay := make(map[string]string)
	tempToRealSet := make(map[string]string)
	tempToRealRest := make(map[string]string)
	mapping := SaveMapping{}

	// Execute operations sequentially in the exact order received
	for _, e := range envs {
		switch e.Type {
		case opCreateDay:
			var op createDayOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid createDay: %w", err)
			}
			if strings.TrimSpace(op.LocalID) == "" || strings.TrimSpace(op.WorkoutDate) == "" {
				return SaveMapping{}, time.Time{}, errors.New("createDay missing localId or workoutDate")
			}
			const qCreateDay = `
				insert into workout_days (user_id, workout_date, timezone, is_rest_day)
				values ($1, $2, $3, false)
				returning id
			`
			var realDayID string
			if err = tx.QueryRowxContext(ctx, qCreateDay, userID, op.WorkoutDate, op.Timezone).Scan(&realDayID); err != nil {
				// Handle potential conflict, maybe day already exists. For now, we error.
				return SaveMapping{}, time.Time{}, fmt.Errorf("could not create day, it may already exist: %w", err)
			}
			tempToRealDay[op.LocalID] = realDayID
			// Note: We dont add Day mappings to the response as client creates them interactively.

			log.Printf("save op createDay key=%s user=%s localId=%s id=%s date=%s", safeStr(idKey), userID, op.LocalID, realDayID, op.WorkoutDate)

		case opUpdateDay:
			var op updateDayOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateDay: %w", err)
			}
			if strings.TrimSpace(op.DayID) == "" {
				return SaveMapping{}, time.Time{}, errors.New("updateDay missing dayId")
			}
			if _, err = tx.ExecContext(ctx, `
				update workout_days set is_rest_day = $3, updated_at = now()
				where id = $1 and user_id = $2
			`, op.DayID, userID, op.IsRestDay); err != nil {
				return SaveMapping{}, time.Time{}, err
			}
			log.Printf("save op updateDay key=%s user=%s dayId=%s isRestDay=%t", safeStr(idKey), userID, op.DayID, op.IsRestDay)
		case opDeleteSet:
			var op deleteSetOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid deleteSet: %w", err)
			}
			id := resolveId(op.SetID, tempToRealSet)
			if id == "" && strings.HasPrefix(op.SetID, "temp:") { // Changed op.ID to op.SetID
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid deleteSet id: %s", op.SetID) // Changed op.ID to op.SetID
			}
			if id == "" {
				id = op.SetID // Changed op.ID to op.SetID
			}
			if _, err = tx.ExecContext(ctx, `delete from sets where id = $1 and user_id = $2`, id, userID); err != nil {
				return SaveMapping{}, time.Time{}, err
			}
			log.Printf("save op deleteSet key=%s user=%s id=%s", safeStr(idKey), userID, op.SetID) // Changed op.ID to op.SetID
		case opDeleteRest:
			var op deleteRestOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid deleteRest: %w", err)
			}
			rid := resolveId(op.RestID, tempToRealRest)
			if rid == "" && strings.HasPrefix(op.RestID, "temp:") {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid deleteRest id: %s", op.RestID)
			}
			if rid == "" {
				rid = op.RestID
			}
			if _, err = tx.ExecContext(ctx, `
				delete from rest_periods rp
				using exercises e
				join workout_days d on d.id = e.day_id
				where rp.id = $1
				  and rp.exercise_id = e.id
				  and d.user_id = $2
			`, rid, userID); err != nil {
				return SaveMapping{}, time.Time{}, err
			}
			log.Printf("save op deleteRest key=%s user=%s id=%s", safeStr(idKey), userID, op.RestID)
		case opCreateExercise:
			var op createExerciseOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid createExercise: %w", err)
			}
			if strings.TrimSpace(op.LocalID) == "" || strings.TrimSpace(op.DayID) == "" || strings.TrimSpace(op.CatalogID) == "" {
				return SaveMapping{}, time.Time{}, errors.New("createExercise missing localId/dayId/catalogId")
			}

			dayID := resolveId(op.DayID, tempToRealDay)
			if dayID == "" {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid or out-of-order reference for createExercise.dayId: %s", op.DayID)
			}

			const qCreateEx = `
				insert into exercises (day_id, catalog_id, position, comment)
				select $1, $2, $3, $4
				where exists (select 1 from workout_days where id = $1 and user_id = $5)
				returning id
			`
			var realExID string
			if err = tx.QueryRowxContext(ctx, qCreateEx, dayID, op.CatalogID, op.Position, op.Comment, userID).Scan(&realExID); err != nil {
				return SaveMapping{}, time.Time{}, err
			}
			tempToRealExercise[op.LocalID] = realExID
			mapping.Exercises = append(mapping.Exercises, LocalIdMap{LocalID: op.LocalID, ID: realExID})
			log.Printf("save op createExercise key=%s user=%s localId=%s id=%s dayId=%s catalogId=%s position=%d",
				safeStr(idKey), userID, op.LocalID, realExID, op.DayID, op.CatalogID, op.Position)
		case opCreateSet:
			var op createSetOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid createSet: %w", err)
			}
			exID := resolveId(op.ExerciseID, tempToRealExercise)
			if exID == "" {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid or out-of-order reference for createSet.exerciseId: %s", op.ExerciseID)
			}
			const qCreateSet = `
				insert into sets (exercise_id, user_id, workout_date, position, reps, weight_kg, is_warmup)
				select $1, d.user_id, d.workout_date, $3, $4, $5, $6
				from exercises e
				join workout_days d on d.id = e.day_id
				where e.id = $1 and d.user_id = $2
				returning id
			`
			var realSetID string
			if err = tx.QueryRowxContext(ctx, qCreateSet, exID, userID, op.Position, op.Reps, op.WeightKg, op.IsWarmup).Scan(&realSetID); err != nil {
				return SaveMapping{}, time.Time{}, err
			}
			tempToRealSet[op.LocalID] = realSetID
			mapping.Sets = append(mapping.Sets, LocalIdMap{LocalID: op.LocalID, ID: realSetID})
			log.Printf("save op createSet key=%s user=%s localId=%s id=%s exerciseId=%s position=%d reps=%d weightKg=%.2f warmup=%t",
				safeStr(idKey), userID, op.LocalID, realSetID, exID, op.Position, op.Reps, op.WeightKg, op.IsWarmup)
		case opCreateRest:
			var op createRestOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid createRest: %w", err)
			}
			exID := resolveId(op.ExerciseID, tempToRealExercise)
			if exID == "" {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid or out-of-order reference for createRest.exerciseId: %s", op.ExerciseID)
			}
			const qCreateRest = `
				with allowed as (
				  select e.id as exercise_id
				  from exercises e
				  join workout_days d on d.id = e.day_id
				  where e.id = $1 and d.user_id = $2
				)
				insert into rest_periods (exercise_id, position, duration_seconds)
				select (select exercise_id from allowed), $3, $4
				on conflict (exercise_id, position)
				do update set duration_seconds = excluded.duration_seconds, updated_at = now()
				returning id
			`
			var realRestID string
			if err = tx.QueryRowxContext(ctx, qCreateRest, exID, userID, op.Position, op.Duration).Scan(&realRestID); err != nil {
				return SaveMapping{}, time.Time{}, err
			}
			tempToRealRest[op.LocalID] = realRestID
			mapping.Rests = append(mapping.Rests, LocalIdMap{LocalID: op.LocalID, ID: realRestID})
			log.Printf("save op createRest key=%s user=%s localId=%s id=%s exerciseId=%s position=%d duration=%d",
				safeStr(idKey), userID, op.LocalID, realRestID, exID, op.Position, op.Duration)
		case opUpdateExercise:
			var op updateExerciseOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateExercise: %w", err)
			}
			id := resolveId(op.ExerciseID, tempToRealExercise)
			if id == "" {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateExercise id: %s", op.ExerciseID)
			}
			const qUpdEx = `
				update exercises e
				set position = coalesce($3, e.position),
				    comment = coalesce($4, e.comment)
				where e.id = $1
				  and exists (select 1 from workout_days d where d.id = e.day_id and d.user_id = $2)
			`
			if _, err = tx.ExecContext(ctx, qUpdEx, id, userID, op.Patch.Position, op.Patch.Comment); err != nil {
				return SaveMapping{}, time.Time{}, err
			}
			log.Printf("save op updateExercise key=%s user=%s id=%s pos_set=%t comment_set=%t",
				safeStr(idKey), userID, op.ExerciseID, op.Patch.Position != nil, op.Patch.Comment != nil)
		case opUpdateSet:
			var op updateSetOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateSet: %w", err)
			}
			id := resolveId(op.SetID, tempToRealSet)
			if id == "" {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateSet id: %s", op.SetID)
			}
			const qUpdSet = `
				update sets s set
				  position = coalesce($3, s.position),
				  reps = coalesce($4, s.reps),
				  weight_kg = coalesce($5, s.weight_kg),
				  is_warmup = coalesce($6, s.is_warmup)
				where s.id = $1 and s.user_id = $2
			`
			if _, err = tx.ExecContext(ctx, qUpdSet, id, userID, op.Patch.Position, op.Patch.Reps, op.Patch.WeightKg, op.Patch.IsWarmup); err != nil {
				return SaveMapping{}, time.Time{}, err
			}
			log.Printf("save op updateSet key=%s user=%s id=%s pos_set=%t reps_set=%t weight_set=%t warmup_set=%t",
				safeStr(idKey), userID, op.SetID,
				op.Patch.Position != nil, op.Patch.Reps != nil, op.Patch.WeightKg != nil, op.Patch.IsWarmup != nil)
		case opUpdateRest:
			var op updateRestOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateRest: %w", err)
			}
			id := resolveId(op.RestID, tempToRealRest)
			if id == "" {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateRest id: %s", op.RestID)
			}
			const qUpdRest = `
				update rest_periods rp set
				  position = coalesce($3, rp.position),
				  duration_seconds = coalesce($4, rp.duration_seconds),
				  updated_at = now()
				from exercises e
				join workout_days d on d.id = e.day_id
				where rp.id = $1
				  and rp.exercise_id = e.id
				  and d.user_id = $2
			`
			if _, err = tx.ExecContext(ctx, qUpdRest, id, userID, op.Patch.Position, op.Patch.Duration); err != nil {
				return SaveMapping{}, time.Time{}, err
			}
			log.Printf("save op updateRest key=%s user=%s id=%s pos_set=%t duration_set=%t",
				safeStr(idKey), userID, op.RestID, op.Patch.Position != nil, op.Patch.Duration != nil)
		case opReorderExercises:
			var op reorderExercisesOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid reorderExercises: %w", err)
			}
			count := 0
			for idx, id := range op.OrderedIDs {
				id = resolveId(id, tempToRealExercise)
				if id == "" {
					return SaveMapping{}, time.Time{}, fmt.Errorf("invalid exercise id in reorder: %s", op.OrderedIDs[idx])
				}
				if _, err = tx.ExecContext(ctx, `
					update exercises e set position = $3
					where e.id = $1
					  and exists (select 1 from workout_days d where d.id = e.day_id and d.user_id = $2)
				`, id, userID, idx); err != nil {
					return SaveMapping{}, time.Time{}, err
				}
				count++
			}
			log.Printf("save op reorderExercises key=%s user=%s dayId=%s count=%d", safeStr(idKey), userID, op.DayID, count)
		case opReorderSets:
			var op reorderSetsOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid reorderSets: %w", err)
			}
			exID := resolveId(op.ExerciseID, tempToRealExercise)
			if exID == "" {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid reorderSets.exerciseId: %s", op.ExerciseID)
			}
			count := 0
			for idx, id := range op.OrderedIDs {
				id = resolveId(id, tempToRealSet)
				if id == "" {
					return SaveMapping{}, time.Time{}, fmt.Errorf("invalid set id in reorder: %s", op.OrderedIDs[idx])
				}
				if _, err = tx.ExecContext(ctx, `
					update sets s set position = $3
					where s.id = $1 and s.user_id = $2
				`, id, userID, idx); err != nil {
					return SaveMapping{}, time.Time{}, err
				}
				count++
			}
			log.Printf("save op reorderSets key=%s user=%s exerciseId=%s count=%d", safeStr(idKey), userID, exID, count)
		case opDeleteExercise:
			var op deleteExerciseOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid deleteExercise: %w", err)
			}
			eid := resolveId(op.ExerciseID, tempToRealExercise)
			if eid == "" && strings.HasPrefix(op.ExerciseID, "temp:") { // Changed op.ID to op.ExerciseID
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid deleteExercise id: %s", op.ExerciseID) // Changed op.ID to op.ExerciseID
			}
			if eid == "" {
				eid = op.ExerciseID // Changed op.ID to op.ExerciseID
			}
			if _, err = tx.ExecContext(ctx, `
				delete from exercises e
				where e.id = $1
				  and exists (select 1 from workout_days d where d.id = e.day_id and d.user_id = $2)
			`, eid, userID); err != nil {
				return SaveMapping{}, time.Time{}, err
			}
			log.Printf("save op deleteExercise key=%s user=%s id=%s", safeStr(idKey), userID, op.ExerciseID) // Changed op.ID to op.ExerciseID
		default:
			return SaveMapping{}, time.Time{}, fmt.Errorf("unknown op type: %s", string(e.Type))
		}
	}

	if err = tx.Commit(); err != nil {
		return SaveMapping{}, time.Time{}, err
	}
	log.Printf("save batch commit key=%s user=%s createdExercises=%d createdSets=%d createdRests=%d", safeStr(idKey), userID, len(mapping.Exercises), len(mapping.Sets), len(mapping.Rests))
	return mapping, time.Now().UTC(), nil
}

func resolveId(id string, tempMap map[string]string) string {
	if realId, ok := tempMap[id]; ok {
		return realId
	}
	return id
}

func safeStr(s string) string {
	if strings.TrimSpace(s) == "" {
		return "-"
	}
	return s
}

// CurrentEpoch returns the stored epoch for a user, or 0 on error/missing.
func (s *Save) CurrentEpoch(ctx context.Context, userID string) int64 {
	var epoch sql.NullInt64
	if err := s.db.QueryRowxContext(ctx, `select save_epoch from users where id = $1`, userID).Scan(&epoch); err != nil {
		return 0
	}
	if epoch.Valid {
		return epoch.Int64
	}
	return 0
}

// SetEpoch updates the user's epoch to the provided value.
func (s *Save) SetEpoch(ctx context.Context, userID string, epoch int64) error {
	_, err := s.db.ExecContext(ctx, `update users set save_epoch = $2 where id = $1`, userID, epoch)
	return err
}


