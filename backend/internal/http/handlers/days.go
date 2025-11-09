package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"exercise-tracker/internal/http/middleware"
	"exercise-tracker/internal/models"
	"exercise-tracker/internal/store"
)

type DaysHandler struct {
	Days *store.Days
}

type ensureDayRequest struct {
	Date string `json:"date"` // YYYY-MM-DD
}

type updateDayRequest struct {
	IsRestDay *bool `json:"isRestDay"`
}

func (h *DaysHandler) GetByDate(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	dateStr := r.URL.Query().Get("date")
	if dateStr == "" {
		http.Error(w, "date required", http.StatusBadRequest)
		return
	}
	dt, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		http.Error(w, "invalid date", http.StatusBadRequest)
		return
	}
	ensure := r.URL.Query().Get("ensure") == "true"
	if ensure {
		// ensure day exists
		if _, err := h.Days.GetOrCreate(r.Context(), uid, dt); err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			return
		}
	}
	day, err := h.Days.GetByUserAndDate(r.Context(), uid, dt)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if day == nil {
		writeJSON(w, http.StatusOK, map[string]any{"day": nil})
		return
	}
	var detail *models.DayWithDetails
	detail, err = h.Days.GetWithDetails(r.Context(), uid, day.ID)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

func (h *DaysHandler) Create(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var req ensureDayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	dt, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		http.Error(w, "invalid date", http.StatusBadRequest)
		return
	}
	day, err := h.Days.GetOrCreate(r.Context(), uid, dt)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	detail, err := h.Days.GetWithDetails(r.Context(), uid, day.ID)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, detail)
}

func (h *DaysHandler) Update(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	dayID := chi.URLParam(r, "dayId")
	if dayID == "" {
		http.Error(w, "dayId required", http.StatusBadRequest)
		return
	}
	var req updateDayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if req.IsRestDay == nil {
		http.Error(w, "isRestDay required", http.StatusBadRequest)
		return
	}
	day, err := h.Days.SetRestDay(r.Context(), uid, dayID, *req.IsRestDay)
	if err != nil {
		if errors.Is(err, store.ErrRestDayHasExercises) {
			http.Error(w, "remove existing exercises before marking rest day", http.StatusConflict)
			return
		}
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if day == nil {
		http.NotFound(w, r)
		return
	}
	detail, err := h.Days.GetWithDetails(r.Context(), uid, day.ID)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, detail)
}
