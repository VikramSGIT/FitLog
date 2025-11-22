package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"exercise-tracker/internal/http/middleware"
	"exercise-tracker/internal/store"
	"github.com/go-chi/chi/v5"
)

type CatalogHandler struct {
	Catalog *store.Catalog
}

func (h *CatalogHandler) Search(w http.ResponseWriter, r *http.Request) {
	// require auth
	if _, ok := middleware.UserIDFromContext(r.Context()); !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	typ := strings.TrimSpace(r.URL.Query().Get("type"))
	body := strings.TrimSpace(r.URL.Query().Get("bodyPart"))
	equip := strings.TrimSpace(r.URL.Query().Get("equipment"))
	level := strings.TrimSpace(r.URL.Query().Get("level"))
	muscle := strings.TrimSpace(r.URL.Query().Get("muscle"))
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	sort := strings.TrimSpace(r.URL.Query().Get("sort"))
	res, err := h.Catalog.Search(r.Context(), store.CatalogSearchParams{
		Q:         q,
		Type:      typ,
		BodyPart:  body,
		Equipment: equip,
		Level:     level,
		Muscle:    muscle,
		Page:      page,
		PageSize:  pageSize,
		Sort:      sort,
	})
	if err != nil {
		log.Printf("catalog search error: %v", err)
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (h *CatalogHandler) Facets(w http.ResponseWriter, r *http.Request) {
	// require auth
	if _, ok := middleware.UserIDFromContext(r.Context()); !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	f, err := h.Catalog.Facets(r.Context())
	if err != nil {
		log.Printf("catalog facets error: %v", err)
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, f)
}

func (h *CatalogHandler) GetEntry(w http.ResponseWriter, r *http.Request) {
	if _, ok := middleware.UserIDFromContext(r.Context()); !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		http.Error(w, "id is required", http.StatusBadRequest)
		return
	}
	rec, err := h.Catalog.GetCatalogEntry(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		log.Printf("catalog get entry error: %v", err)
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, rec)
}

func (h *CatalogHandler) UpdateEntry(w http.ResponseWriter, r *http.Request) {
	if _, ok := middleware.UserIDFromContext(r.Context()); !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		http.Error(w, "id is required", http.StatusBadRequest)
		return
	}

	// Accept multipart/form-data so we can update the exercise and image together.
	// The frontend sends a "metadata" field containing the JSON catalog payload
	// and an optional "file" field for the PNG/APNG image.
	if err := r.ParseMultipartForm(10 << 20); err != nil { // 10MB
		http.Error(w, "invalid form", http.StatusBadRequest)
		return
	}

	metaJSON := strings.TrimSpace(r.FormValue("metadata"))
	if metaJSON == "" {
		http.Error(w, "metadata is required", http.StatusBadRequest)
		return
	}

	var payload catalogPayload
	if err := json.Unmarshal([]byte(metaJSON), &payload); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	entry, err := payload.toCatalogEntry()
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	removeImage := strings.EqualFold(strings.TrimSpace(r.FormValue("removeImage")), "true")

	var (
		imageData     []byte
		imageMimeType string
	)

	file, header, err := r.FormFile("file")
	if err == nil {
		defer file.Close()
		data, readErr := io.ReadAll(file)
		if readErr != nil {
			http.Error(w, "invalid file", http.StatusBadRequest)
			return
		}
		if len(data) == 0 {
			http.Error(w, "empty file", http.StatusBadRequest)
			return
		}
		mimeType := header.Header.Get("Content-Type")
		if mimeType == "" {
			mimeType = http.DetectContentType(data)
		}
		switch mimeType {
		case "image/apng", "image/png":
			// ok
		default:
			http.Error(w, "only PNG/APNG images are supported", http.StatusBadRequest)
			return
		}
		imageData = data
		imageMimeType = mimeType
	} else if err != http.ErrMissingFile {
		http.Error(w, "invalid file", http.StatusBadRequest)
		return
	}

	if err := h.Catalog.UpdateCatalogEntry(r.Context(), id, entry, imageData, imageMimeType, removeImage); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		log.Printf("catalog update entry error: %v", err)
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	rec, err := h.Catalog.GetCatalogEntry(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		log.Printf("catalog reload entry error: %v", err)
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, rec)
}

func (h *CatalogHandler) GetImage(w http.ResponseWriter, r *http.Request) {
	if _, ok := middleware.UserIDFromContext(r.Context()); !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		http.Error(w, "id is required", http.StatusBadRequest)
		return
	}
	data, mimeType, err := h.Catalog.GetCatalogImage(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		log.Printf("catalog get image error: %v", err)
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if len(data) == 0 {
		http.NotFound(w, r)
		return
	}
	if mimeType == "" {
		mimeType = http.DetectContentType(data)
	}
	w.Header().Set("Content-Type", mimeType)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (h *CatalogHandler) DeleteEntry(w http.ResponseWriter, r *http.Request) {
	if _, ok := middleware.UserIDFromContext(r.Context()); !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		http.Error(w, "id is required", http.StatusBadRequest)
		return
	}
	if err := h.Catalog.DeleteCatalogEntry(r.Context(), id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		log.Printf("catalog delete entry error: %v", err)
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *CatalogHandler) GetExerciseStats(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		http.Error(w, "id is required", http.StatusBadRequest)
		return
	}

	// Parse pagination parameters
	limit := 5 // Default to 5 days
	offset := 0
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		if parsed, err := strconv.Atoi(offsetStr); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	stats, hasMore, err := h.Catalog.GetExerciseStats(r.Context(), id, userID, limit, offset)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		log.Printf("catalog get exercise stats error: %v", err)
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	// Include hasMore in response
	response := map[string]interface{}{
		"highestWeightKg": stats.HighestWeightKg,
		"history":         stats.History,
		"hasMore":        hasMore,
	}
	writeJSON(w, http.StatusOK, response)
}


