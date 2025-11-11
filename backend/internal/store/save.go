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
	Type     opType `json:"type"`
	TempID   string `json:"tempId"`
	DayID    string `json:"dayId"`
	CatalogID string `json:"catalogId"`
	Position int    `json:"position"`
	Comment  *string `json:"comment,omitempty"`
}

type createSetOp struct {
	Type       opType  `json:"type"`
	TempID     string  `json:"tempId"`
	ExerciseID string  `json:"exerciseId"` // can be "temp:<id>"
	Position   int     `json:"position"`
	Reps       int     `json:"reps"`
	WeightKg   float64 `json:"weightKg"`
	IsWarmup   bool    `json:"isWarmup"`
}

type updateExerciseOp struct {
	Type  opType `json:"type"`
	ID    string `json:"id"`
	Patch struct {
		Position *int    `json:"position"`
		Comment  *string `json:"comment"`
	} `json:"patch"`
}

type updateSetOp struct {
	Type  opType `json:"type"`
	ID    string `json:"id"`
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
	ID   string `json:"id"`
}

type deleteSetOp struct {
	Type opType `json:"type"`
	ID   string `json:"id"`
}

type createRestOp struct {
	Type       opType `json:"type"`
	TempID     string `json:"tempId"`
	ExerciseID string `json:"exerciseId"` // may be "temp:<id>"
	Position   int    `json:"position"`
	Duration   int    `json:"durationSeconds"`
}

type updateRestOp struct {
	Type  opType `json:"type"`
	ID    string `json:"id"`
	Patch struct {
		Position *int `json:"position"`
		Duration *int `json:"durationSeconds"`
	} `json:"patch"`
}

type deleteRestOp struct {
	Type opType `json:"type"`
	ID   string `json:"id"`
}

type updateDayOp struct {
	Type      opType `json:"type"`
	DayID     string `json:"dayId"`
	IsRestDay bool   `json:"isRestDay"`
}

// SaveMapping is returned to map temp -> real IDs created during the batch.
type SaveMapping struct {
	Exercises []TempMap `json:"exercises"`
	Sets      []TempMap `json:"sets"`
	Rests     []TempMap `json:"rests"`
}

type TempMap struct {
	TempID string `json:"tempId"`
	ID     string `json:"id"`
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
	tempToRealSet := make(map[string]string)
	tempToRealRest := make(map[string]string)
	mapping := SaveMapping{}

	// Execute operations sequentially in the exact order received
	for _, e := range envs {
		switch e.Type {
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
			id := resolveMaybeTemp(op.ID, tempToRealSet)
			if id == "" && strings.HasPrefix(op.ID, "temp:") {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid deleteSet id: %s", op.ID)
			}
			if id == "" {
				id = op.ID
			}
			if _, err = tx.ExecContext(ctx, `delete from sets where id = $1 and user_id = $2`, id, userID); err != nil {
				return SaveMapping{}, time.Time{}, err
			}
			log.Printf("save op deleteSet key=%s user=%s id=%s", safeStr(idKey), userID, op.ID)
		case opDeleteRest:
			var op deleteRestOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid deleteRest: %w", err)
			}
			rid := resolveMaybeTemp(op.ID, tempToRealRest)
			if rid == "" && strings.HasPrefix(op.ID, "temp:") {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid deleteRest id: %s", op.ID)
			}
			if rid == "" {
				rid = op.ID
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
			log.Printf("save op deleteRest key=%s user=%s id=%s", safeStr(idKey), userID, op.ID)
		case opCreateExercise:
			var op createExerciseOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid createExercise: %w", err)
			}
			if strings.TrimSpace(op.TempID) == "" || strings.TrimSpace(op.DayID) == "" || strings.TrimSpace(op.CatalogID) == "" {
				return SaveMapping{}, time.Time{}, errors.New("createExercise missing tempId/dayId/catalogId")
			}
			const qCreateEx = `
				insert into exercises (day_id, catalog_id, position, comment)
				select $1, $2, $3, $4
				where exists (select 1 from workout_days where id = $1 and user_id = $5)
				returning id
			`
			var realExID string
			if err = tx.QueryRowxContext(ctx, qCreateEx, op.DayID, op.CatalogID, op.Position, op.Comment, userID).Scan(&realExID); err != nil {
				return SaveMapping{}, time.Time{}, err
			}
			tempToRealExercise[op.TempID] = realExID
			mapping.Exercises = append(mapping.Exercises, TempMap{TempID: op.TempID, ID: realExID})
			log.Printf("save op createExercise key=%s user=%s tempId=%s id=%s dayId=%s catalogId=%s position=%d",
				safeStr(idKey), userID, op.TempID, realExID, op.DayID, op.CatalogID, op.Position)
		case opCreateSet:
			var op createSetOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid createSet: %w", err)
			}
			exID := resolveMaybeTemp(op.ExerciseID, tempToRealExercise)
			if exID == "" {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid reference for createSet.exerciseId: %s", op.ExerciseID)
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
			tempToRealSet[op.TempID] = realSetID
			mapping.Sets = append(mapping.Sets, TempMap{TempID: op.TempID, ID: realSetID})
			log.Printf("save op createSet key=%s user=%s tempId=%s id=%s exerciseId=%s position=%d reps=%d weightKg=%.2f warmup=%t",
				safeStr(idKey), userID, op.TempID, realSetID, exID, op.Position, op.Reps, op.WeightKg, op.IsWarmup)
		case opCreateRest:
			var op createRestOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid createRest: %w", err)
			}
			exID := resolveMaybeTemp(op.ExerciseID, tempToRealExercise)
			if exID == "" {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid reference for createRest.exerciseId: %s", op.ExerciseID)
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
			tempToRealRest[op.TempID] = realRestID
			mapping.Rests = append(mapping.Rests, TempMap{TempID: op.TempID, ID: realRestID})
			log.Printf("save op createRest key=%s user=%s tempId=%s id=%s exerciseId=%s position=%d duration=%d",
				safeStr(idKey), userID, op.TempID, realRestID, exID, op.Position, op.Duration)
		case opUpdateExercise:
			var op updateExerciseOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateExercise: %w", err)
			}
			id := resolveMaybeTemp(op.ID, tempToRealExercise)
			if id == "" {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateExercise id: %s", op.ID)
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
				safeStr(idKey), userID, id, op.Patch.Position != nil, op.Patch.Comment != nil)
		case opUpdateSet:
			var op updateSetOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateSet: %w", err)
			}
			id := resolveMaybeTemp(op.ID, tempToRealSet)
			if id == "" {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateSet id: %s", op.ID)
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
				safeStr(idKey), userID, id,
				op.Patch.Position != nil, op.Patch.Reps != nil, op.Patch.WeightKg != nil, op.Patch.IsWarmup != nil)
		case opUpdateRest:
			var op updateRestOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateRest: %w", err)
			}
			id := resolveMaybeTemp(op.ID, tempToRealRest)
			if id == "" {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateRest id: %s", op.ID)
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
				safeStr(idKey), userID, id, op.Patch.Position != nil, op.Patch.Duration != nil)
		case opReorderExercises:
			var op reorderExercisesOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid reorderExercises: %w", err)
			}
			count := 0
			for idx, id := range op.OrderedIDs {
				id = resolveMaybeTemp(id, tempToRealExercise)
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
			exID := resolveMaybeTemp(op.ExerciseID, tempToRealExercise)
			if exID == "" {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid reorderSets.exerciseId: %s", op.ExerciseID)
			}
			count := 0
			for idx, id := range op.OrderedIDs {
				id = resolveMaybeTemp(id, tempToRealSet)
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
			eid := resolveMaybeTemp(op.ID, tempToRealExercise)
			if eid == "" && strings.HasPrefix(op.ID, "temp:") {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid deleteExercise id: %s", op.ID)
			}
			if eid == "" {
				eid = op.ID
			}
			if _, err = tx.ExecContext(ctx, `
				delete from exercises e
				where e.id = $1
				  and exists (select 1 from workout_days d where d.id = e.day_id and d.user_id = $2)
			`, eid, userID); err != nil {
				return SaveMapping{}, time.Time{}, err
			}
			log.Printf("save op deleteExercise key=%s user=%s id=%s", safeStr(idKey), userID, op.ID)
		default:
			return SaveMapping{}, time.Time{}, fmt.Errorf("unknown op type: %s", string(e.Type))
		}
	}

	// Old phased execution (kept for reference, disabled)
	if false {
	// Phase 0: update day rest flag (FIRST pass) — only turn OFF rest day before creations
	for _, e := range envs {
		if e.Type != opUpdateDay {
			continue
		}
		var op updateDayOp
		if err = json.Unmarshal(e.raw, &op); err != nil {
			return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateDay: %w", err)
		}
		if !op.IsRestDay { // turning training mode ON
			if strings.TrimSpace(op.DayID) == "" {
				return SaveMapping{}, time.Time{}, errors.New("updateDay missing dayId")
			}
			if _, err = tx.ExecContext(ctx, `
				update workout_days set is_rest_day = $3, updated_at = now()
				where id = $1 and user_id = $2
			`, op.DayID, userID, op.IsRestDay); err != nil {
				return SaveMapping{}, time.Time{}, err
			}
			log.Printf("save op updateDay (pre) key=%s user=%s dayId=%s isRestDay=%t", safeStr(idKey), userID, op.DayID, op.IsRestDay)
		}
	}

	// Phase 1: delete sets
	for _, e := range envs {
		if e.Type != opDeleteSet {
			continue
		}
		var op deleteSetOp
		if err = json.Unmarshal(e.raw, &op); err != nil {
			return SaveMapping{}, time.Time{}, fmt.Errorf("invalid deleteSet: %w", err)
		}
		if _, err = tx.ExecContext(ctx, `delete from sets where id = $1 and user_id = $2`, op.ID, userID); err != nil {
			return SaveMapping{}, time.Time{}, err
		}
		log.Printf("save op deleteSet key=%s user=%s id=%s", safeStr(idKey), userID, op.ID)
	}

// Phase 1b: delete rests
for _, e := range envs {
	if e.Type != opDeleteRest {
		continue
	}
	var op deleteRestOp
	if err = json.Unmarshal(e.raw, &op); err != nil {
		return SaveMapping{}, time.Time{}, fmt.Errorf("invalid deleteRest: %w", err)
	}
	if _, err = tx.ExecContext(ctx, `
		delete from rest_periods rp
		using exercises e
		join workout_days d on d.id = e.day_id
		where rp.id = $1
		  and rp.exercise_id = e.id
		  and d.user_id = $2
	`, op.ID, userID); err != nil {
		return SaveMapping{}, time.Time{}, err
	}
	log.Printf("save op deleteRest key=%s user=%s id=%s", safeStr(idKey), userID, op.ID)
}

	// Phase 2: create exercises
	for _, e := range envs {
		if e.Type != opCreateExercise {
			continue
		}
		var op createExerciseOp
		if err = json.Unmarshal(e.raw, &op); err != nil {
			return SaveMapping{}, time.Time{}, fmt.Errorf("invalid createExercise: %w", err)
		}
		if strings.TrimSpace(op.TempID) == "" || strings.TrimSpace(op.DayID) == "" || strings.TrimSpace(op.CatalogID) == "" {
			return SaveMapping{}, time.Time{}, errors.New("createExercise missing tempId/dayId/catalogId")
		}
		const q = `
			insert into exercises (day_id, catalog_id, position, comment)
			select $1, $2, $3, $4
			where exists (select 1 from workout_days where id = $1 and user_id = $5)
			returning id
		`
		var realID string
		if err = tx.QueryRowxContext(ctx, q, op.DayID, op.CatalogID, op.Position, op.Comment, userID).Scan(&realID); err != nil {
			return SaveMapping{}, time.Time{}, err
		}
		tempToRealExercise[op.TempID] = realID
		mapping.Exercises = append(mapping.Exercises, TempMap{TempID: op.TempID, ID: realID})
		log.Printf("save op createExercise key=%s user=%s tempId=%s id=%s dayId=%s catalogId=%s position=%d",
			safeStr(idKey), userID, op.TempID, realID, op.DayID, op.CatalogID, op.Position)
	}

	// Phase 3: create sets
	for _, e := range envs {
		if e.Type != opCreateSet {
			continue
		}
		var op createSetOp
		if err = json.Unmarshal(e.raw, &op); err != nil {
			return SaveMapping{}, time.Time{}, fmt.Errorf("invalid createSet: %w", err)
		}
		exID := resolveMaybeTemp(op.ExerciseID, tempToRealExercise)
		if exID == "" {
			return SaveMapping{}, time.Time{}, fmt.Errorf("invalid reference for createSet.exerciseId: %s", op.ExerciseID)
		}
		const q = `
			insert into sets (exercise_id, user_id, workout_date, position, reps, weight_kg, is_warmup)
			select $1, d.user_id, d.workout_date, $3, $4, $5, $6
			from exercises e
			join workout_days d on d.id = e.day_id
			where e.id = $1 and d.user_id = $2
			returning id
		`
		var realID string
		if err = tx.QueryRowxContext(ctx, q, exID, userID, op.Position, op.Reps, op.WeightKg, op.IsWarmup).Scan(&realID); err != nil {
			return SaveMapping{}, time.Time{}, err
		}
		tempToRealSet[op.TempID] = realID
		mapping.Sets = append(mapping.Sets, TempMap{TempID: op.TempID, ID: realID})
		log.Printf("save op createSet key=%s user=%s tempId=%s id=%s exerciseId=%s position=%d reps=%d weightKg=%.2f warmup=%t",
			safeStr(idKey), userID, op.TempID, realID, exID, op.Position, op.Reps, op.WeightKg, op.IsWarmup)
	}

// Phase 3b: create rests
for _, e := range envs {
	if e.Type != opCreateRest {
		continue
	}
	var op createRestOp
	if err = json.Unmarshal(e.raw, &op); err != nil {
		return SaveMapping{}, time.Time{}, fmt.Errorf("invalid createRest: %w", err)
	}
	exID := resolveMaybeTemp(op.ExerciseID, tempToRealExercise)
	if exID == "" {
		return SaveMapping{}, time.Time{}, fmt.Errorf("invalid reference for createRest.exerciseId: %s", op.ExerciseID)
	}
	const q = `
		insert into rest_periods (exercise_id, position, duration_seconds)
		select $1, $3, $4
		from exercises e
		join workout_days d on d.id = e.day_id
		where e.id = $1 and d.user_id = $2
		returning id
	`
	var realID string
	if err = tx.QueryRowxContext(ctx, q, exID, userID, op.Position, op.Duration).Scan(&realID); err != nil {
		return SaveMapping{}, time.Time{}, err
	}
	tempToRealRest[op.TempID] = realID
	mapping.Rests = append(mapping.Rests, TempMap{TempID: op.TempID, ID: realID})
	log.Printf("save op createRest key=%s user=%s tempId=%s id=%s exerciseId=%s position=%d duration=%d",
		safeStr(idKey), userID, op.TempID, realID, exID, op.Position, op.Duration)
}

	// Phase 4: updates
	for _, e := range envs {
		switch e.Type {
		case opUpdateExercise:
			var op updateExerciseOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateExercise: %w", err)
			}
			id := resolveMaybeTemp(op.ID, tempToRealExercise)
			if id == "" {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateExercise id: %s", op.ID)
			}
			const q = `
				update exercises e
				set position = coalesce($3, e.position),
				    comment = coalesce($4, e.comment)
				where e.id = $1
				  and exists (select 1 from workout_days d where d.id = e.day_id and d.user_id = $2)
			`
			if _, err = tx.ExecContext(ctx, q, id, userID, op.Patch.Position, op.Patch.Comment); err != nil {
				return SaveMapping{}, time.Time{}, err
			}
			log.Printf("save op updateExercise key=%s user=%s id=%s pos_set=%t comment_set=%t",
				safeStr(idKey), userID, id, op.Patch.Position != nil, op.Patch.Comment != nil)
		case opUpdateSet:
			var op updateSetOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateSet: %w", err)
			}
			id := resolveMaybeTemp(op.ID, tempToRealSet)
			if id == "" {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateSet id: %s", op.ID)
			}
			const q = `
				update sets s set
				  position = coalesce($3, s.position),
				  reps = coalesce($4, s.reps),
				  weight_kg = coalesce($5, s.weight_kg),
				  is_warmup = coalesce($6, s.is_warmup)
				where s.id = $1 and s.user_id = $2
			`
			if _, err = tx.ExecContext(ctx, q, id, userID, op.Patch.Position, op.Patch.Reps, op.Patch.WeightKg, op.Patch.IsWarmup); err != nil {
				return SaveMapping{}, time.Time{}, err
			}
			log.Printf("save op updateSet key=%s user=%s id=%s pos_set=%t reps_set=%t weight_set=%t warmup_set=%t",
				safeStr(idKey), userID, id,
				op.Patch.Position != nil, op.Patch.Reps != nil, op.Patch.WeightKg != nil, op.Patch.IsWarmup != nil)
		case opUpdateRest:
			var op updateRestOp
			if err = json.Unmarshal(e.raw, &op); err != nil {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateRest: %w", err)
			}
			id := resolveMaybeTemp(op.ID, tempToRealRest)
			if id == "" {
				return SaveMapping{}, time.Time{}, fmt.Errorf("invalid updateRest id: %s", op.ID)
			}
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
			`
			if _, err = tx.ExecContext(ctx, q, id, userID, op.Patch.Position, op.Patch.Duration); err != nil {
				return SaveMapping{}, time.Time{}, err
			}
			log.Printf("save op updateRest key=%s user=%s id=%s pos_set=%t duration_set=%t",
				safeStr(idKey), userID, id, op.Patch.Position != nil, op.Patch.Duration != nil)
		}
	}

	// Phase 5: reorders
	for _, e := range envs {
		if e.Type != opReorderExercises {
			continue
		}
		var op reorderExercisesOp
		if err = json.Unmarshal(e.raw, &op); err != nil {
			return SaveMapping{}, time.Time{}, fmt.Errorf("invalid reorderExercises: %w", err)
		}
		// Ensure all belong to user/day, then update sequential positions
		count := 0
		for idx, id := range op.OrderedIDs {
			id = resolveMaybeTemp(id, tempToRealExercise)
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
	}
	for _, e := range envs {
		if e.Type != opReorderSets {
			continue
		}
		var op reorderSetsOp
		if err = json.Unmarshal(e.raw, &op); err != nil {
			return SaveMapping{}, time.Time{}, fmt.Errorf("invalid reorderSets: %w", err)
		}
		exID := resolveMaybeTemp(op.ExerciseID, tempToRealExercise)
		if exID == "" {
			return SaveMapping{}, time.Time{}, fmt.Errorf("invalid reorderSets.exerciseId: %s", op.ExerciseID)
		}
		count := 0
		for idx, id := range op.OrderedIDs {
			id = resolveMaybeTemp(id, tempToRealSet)
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
	}

	// Phase 6: delete exercises (cascade their sets)
	for _, e := range envs {
		if e.Type != opDeleteExercise {
			continue
		}
		var op deleteExerciseOp
		if err = json.Unmarshal(e.raw, &op); err != nil {
			return SaveMapping{}, time.Time{}, fmt.Errorf("invalid deleteExercise: %w", err)
		}
		if _, err = tx.ExecContext(ctx, `
			delete from exercises e
			where e.id = $1
			  and exists (select 1 from workout_days d where d.id = e.day_id and d.user_id = $2)
		`, op.ID, userID); err != nil {
			return SaveMapping{}, time.Time{}, err
		}
		log.Printf("save op deleteExercise key=%s user=%s id=%s", safeStr(idKey), userID, op.ID)
	}

	}

	if err = tx.Commit(); err != nil {
		return SaveMapping{}, time.Time{}, err
	}
	log.Printf("save batch commit key=%s user=%s createdExercises=%d createdSets=%d createdRests=%d", safeStr(idKey), userID, len(mapping.Exercises), len(mapping.Sets), len(mapping.Rests))
	return mapping, time.Now().UTC(), nil
}

func resolveMaybeTemp(id string, tempMap map[string]string) string {
	if strings.HasPrefix(id, "temp:") {
		key := strings.TrimPrefix(id, "temp:")
		return tempMap[key]
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


