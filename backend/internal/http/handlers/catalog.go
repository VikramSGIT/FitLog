package handlers

import (
	"log"
	"net/http"
	"strconv"
	"strings"

	"exercise-tracker/internal/http/middleware"
	"exercise-tracker/internal/store"
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
		Q:        q,
		Type:     typ,
		BodyPart: body,
		Equipment: equip,
		Level:    level,
		Muscle:   muscle,
		Page:     page,
		PageSize: pageSize,
		Sort:     sort,
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


