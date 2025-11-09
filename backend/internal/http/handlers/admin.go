package handlers

import (
	"encoding/csv"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"exercise-tracker/internal/http/middleware"
	"exercise-tracker/internal/store"
)

type AdminHandler struct {
	Users       *store.Users
	Catalog     *store.Catalog
	AdminEmails map[string]struct{}
}

func (h *AdminHandler) AdminOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uid, ok := middleware.UserIDFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		u, err := h.Users.ByID(r.Context(), uid)
		if err != nil || u == nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if _, ok := h.AdminEmails[strings.ToLower(u.Email)]; !ok {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// JSON payload: [{name, primaryMuscle?, secondaryMuscles?[]}]
func (h *AdminHandler) UpsertCatalogJSON(w http.ResponseWriter, r *http.Request) {
	var items []store.CatalogEntry
	if err := json.NewDecoder(r.Body).Decode(&items); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	n, err := h.Catalog.Upsert(r.Context(), items)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"upserted": n})
}

// CSV upload: multipart/form-data with "file", headers: name,primary_muscle,secondary_muscles (pipe-separated)
func (h *AdminHandler) UpsertCatalogCSV(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(10 << 20); err != nil { // 10MB
		http.Error(w, "invalid form", http.StatusBadRequest)
		return
	}
	f, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "file required", http.StatusBadRequest)
		return
	}
	defer f.Close()
	reader := csv.NewReader(f)
	reader.FieldsPerRecord = -1
	headers, err := reader.Read()
	if err != nil {
		http.Error(w, "invalid csv", http.StatusBadRequest)
		return
	}
	idx := func(name string) int {
		for i, h := range headers {
			if strings.EqualFold(strings.TrimSpace(h), name) {
				return i
			}
		}
		return -1
	}
	iName := idx("name")
	iPrim := idx("primary_muscle")
	iSec := idx("secondary_muscles")
	if iName < 0 {
		http.Error(w, "csv must include 'name' header", http.StatusBadRequest)
		return
	}
	var items []store.CatalogEntry
	for {
		rec, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			http.Error(w, "invalid csv row", http.StatusBadRequest)
			return
		}
		name := strings.TrimSpace(rec[iName])
		if name == "" {
			continue
		}
		var primPtr *string
		if iPrim >= 0 && strings.TrimSpace(rec[iPrim]) != "" {
			p := strings.TrimSpace(rec[iPrim])
			primPtr = &p
		}
		var secs []string
		if iSec >= 0 && strings.TrimSpace(rec[iSec]) != "" {
			for _, s := range strings.Split(rec[iSec], "|") {
				s = strings.TrimSpace(s)
				if s != "" {
					secs = append(secs, s)
				}
			}
		}
		items = append(items, store.CatalogEntry{
			Name:             name,
			PrimaryMuscle:    primPtr,
			SecondaryMuscles: secs,
		})
	}
	n, err := h.Catalog.Upsert(r.Context(), items)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"upserted": n})
}


