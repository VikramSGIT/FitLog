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
	Position       int      `json:"position"`
	Reps           int      `json:"reps"`
	WeightKg       float64  `json:"weightKg"`
	RPE            *float64 `json:"rpe"`
	IsWarmup       bool     `json:"isWarmup"`
	RestSeconds    *int     `json:"restSeconds"`
	Tempo          *string  `json:"tempo"`
	PerformedAt    *string  `json:"performedAt"`
	DropSetGroupID *string  `json:"dropSetGroupId"`
	StartDropSet   bool     `json:"startDropSet"`
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
	// Create drop-set group if requested
	dropID := req.DropSetGroupID
	if dropID == nil && req.StartDropSet {
		id, err := h.Sets.CreateDropSetGroup(r.Context(), uid, exerciseID)
		if err == nil && id != nil {
			dropID = id
		}
	}
	created, err := h.Sets.Create(r.Context(), store.CreateSetParams{
		ExerciseID:     exerciseID,
		UserID:         uid,
		Position:       req.Position,
		Reps:           req.Reps,
		WeightKg:       req.WeightKg,
		RPE:            req.RPE,
		IsWarmup:       req.IsWarmup,
		RestSeconds:    req.RestSeconds,
		Tempo:          req.Tempo,
		PerformedAt:    performedAt,
		DropSetGroupID: dropID,
	})
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

type updateSetRequest struct {
	Position       *int     `json:"position"`
	Reps           *int     `json:"reps"`
	WeightKg       *float64 `json:"weightKg"`
	RPE            *float64 `json:"rpe"`
	IsWarmup       *bool    `json:"isWarmup"`
	RestSeconds    *int     `json:"restSeconds"`
	Tempo          *string  `json:"tempo"`
	PerformedAt    *string  `json:"performedAt"`
	DropSetGroupID *string  `json:"dropSetGroupId"`
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
		ID:             id,
		UserID:         uid,
		Position:       req.Position,
		Reps:           req.Reps,
		WeightKg:       req.WeightKg,
		RPE:            req.RPE,
		IsWarmup:       req.IsWarmup,
		RestSeconds:    req.RestSeconds,
		Tempo:          req.Tempo,
		PerformedAt:    performedAt,
		DropSetGroupID: req.DropSetGroupID,
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


