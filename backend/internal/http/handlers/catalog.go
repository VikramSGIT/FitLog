package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
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
	var payload catalogPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	entry, err := payload.toCatalogEntry()
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.Catalog.UpdateCatalogEntry(r.Context(), id, entry); err != nil {
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
