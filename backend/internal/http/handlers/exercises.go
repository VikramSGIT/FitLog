package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"exercise-tracker/internal/http/middleware"
	"exercise-tracker/internal/store"
)

type ExercisesHandler struct {
	Exercises *store.Exercises
}

type createExerciseRequest struct {
	Position  int     `json:"position"`
	CatalogID *string `json:"catalogId"`
	Comment   *string `json:"comment"`
}

func (h *ExercisesHandler) Create(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	dayID := chi.URLParam(r, "dayId")
	var req createExerciseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if req.CatalogID == nil || *req.CatalogID == "" {
		http.Error(w, "catalogId is required", http.StatusBadRequest)
		return
	}
	ex, err := h.Exercises.Create(r.Context(), uid, dayID, *req.CatalogID, req.Position, req.Comment)
	if err != nil {
		if errors.Is(err, store.ErrExerciseOnRestDay) {
			http.Error(w, "cannot add exercises to a rest day", http.StatusConflict)
			return
		}
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, ex)
}

type updateExerciseRequest struct {
	Position *int    `json:"position"`
	Comment  *string `json:"comment"`
}

func (h *ExercisesHandler) Update(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id := chi.URLParam(r, "id")
	var req updateExerciseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	ex, err := h.Exercises.Update(r.Context(), uid, id, req.Position, req.Comment)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if ex == nil {
		http.NotFound(w, r)
		return
	}
	writeJSON(w, http.StatusOK, ex)
}

func (h *ExercisesHandler) Delete(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id := chi.URLParam(r, "id")
	okDel, err := h.Exercises.Delete(r.Context(), uid, id)
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
