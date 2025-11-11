package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"exercise-tracker/internal/http/middleware"
	"exercise-tracker/internal/store"
)

type SetsHandler struct {
	Sets *store.Sets
}

type createSetRequest struct {
	Position    int      `json:"position"`
	Reps        int      `json:"reps"`
	WeightKg    float64  `json:"weightKg"`
	RPE         *float64 `json:"rpe"`
	IsWarmup    bool     `json:"isWarmup"`
	RestSeconds *int     `json:"restSeconds"`
	Tempo       *string  `json:"tempo"`
	PerformedAt *string  `json:"performedAt"`
}

func (h *SetsHandler) Create(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	exerciseID := chi.URLParam(r, "id")
	var req createSetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	var performedAt *time.Time
	if req.PerformedAt != nil && *req.PerformedAt != "" {
		t, err := time.Parse(time.RFC3339, *req.PerformedAt)
		if err == nil {
			performedAt = &t
		}
	}
	created, err := h.Sets.Create(r.Context(), store.CreateSetParams{
		ExerciseID:  exerciseID,
		UserID:      uid,
		Position:    req.Position,
		Reps:        req.Reps,
		WeightKg:    req.WeightKg,
		RPE:         req.RPE,
		IsWarmup:    req.IsWarmup,
		RestSeconds: req.RestSeconds,
		Tempo:       req.Tempo,
		PerformedAt: performedAt,
	})
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

type updateSetRequest struct {
	Position    *int     `json:"position"`
	Reps        *int     `json:"reps"`
	WeightKg    *float64 `json:"weightKg"`
	RPE         *float64 `json:"rpe"`
	IsWarmup    *bool    `json:"isWarmup"`
	RestSeconds *int     `json:"restSeconds"`
	Tempo       *string  `json:"tempo"`
	PerformedAt *string  `json:"performedAt"`
}

func (h *SetsHandler) Update(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id := chi.URLParam(r, "id")
	var req updateSetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	var performedAt *time.Time
	if req.PerformedAt != nil && *req.PerformedAt != "" {
		t, err := time.Parse(time.RFC3339, *req.PerformedAt)
		if err == nil {
			performedAt = &t
		}
	}
	updated, err := h.Sets.Update(r.Context(), store.UpdateSetParams{
		ID:          id,
		UserID:      uid,
		Position:    req.Position,
		Reps:        req.Reps,
		WeightKg:    req.WeightKg,
		RPE:         req.RPE,
		IsWarmup:    req.IsWarmup,
		RestSeconds: req.RestSeconds,
		Tempo:       req.Tempo,
		PerformedAt: performedAt,
	})
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if updated == nil {
		http.NotFound(w, r)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *SetsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id := chi.URLParam(r, "id")
	okDel, err := h.Sets.Delete(r.Context(), id, uid)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if !okDel {
		http.NotFound(w, r)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type createRestRequest struct {
	Position        int `json:"position"`
	DurationSeconds int `json:"durationSeconds"`
}

func (h *SetsHandler) CreateRest(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	exerciseID := chi.URLParam(r, "id")
	if exerciseID == "" {
		http.Error(w, "exercise id required", http.StatusBadRequest)
		return
	}
	var req createRestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if req.Position < 0 {
		http.Error(w, "position must be >= 0", http.StatusBadRequest)
		return
	}
	if req.DurationSeconds < 0 {
		http.Error(w, "durationSeconds must be >= 0", http.StatusBadRequest)
		return
	}
	rest, err := h.Sets.CreateRest(r.Context(), store.CreateRestParams{
		ExerciseID:      exerciseID,
		UserID:          uid,
		Position:        req.Position,
		DurationSeconds: req.DurationSeconds,
	})
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if rest == nil {
		http.NotFound(w, r)
		return
	}
	writeJSON(w, http.StatusCreated, rest)
}

type updateRestRequest struct {
	Position        *int `json:"position"`
	DurationSeconds *int `json:"durationSeconds"`
}

func (h *SetsHandler) UpdateRest(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	restID := chi.URLParam(r, "id")
	if restID == "" {
		http.Error(w, "rest id required", http.StatusBadRequest)
		return
	}
	var req updateRestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if req.Position != nil && *req.Position < 0 {
		http.Error(w, "position must be >= 0", http.StatusBadRequest)
		return
	}
	if req.DurationSeconds != nil && *req.DurationSeconds < 0 {
		http.Error(w, "durationSeconds must be >= 0", http.StatusBadRequest)
		return
	}
	updated, err := h.Sets.UpdateRest(r.Context(), store.UpdateRestParams{
		ID:              restID,
		UserID:          uid,
		Position:        req.Position,
		DurationSeconds: req.DurationSeconds,
	})
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if updated == nil {
		http.NotFound(w, r)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *SetsHandler) DeleteRest(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	restID := chi.URLParam(r, "id")
	if restID == "" {
		http.Error(w, "rest id required", http.StatusBadRequest)
		return
	}
	okDel, err := h.Sets.DeleteRest(r.Context(), restID, uid)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if !okDel {
		http.NotFound(w, r)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
