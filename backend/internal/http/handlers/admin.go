package handlers

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"exercise-tracker/internal/http/middleware"
	"exercise-tracker/internal/store"
)

type AdminHandler struct {
	Users       *store.Users
	Catalog     *store.Catalog
	AdminEmails map[string]struct{}
}

type catalogPayload struct {
	Name             string   `json:"name"`
	Description      *string  `json:"description"`
	Type             string   `json:"type"`
	BodyPart         string   `json:"bodyPart"`
	Equipment        string   `json:"equipment"`
	Level            string   `json:"level"`
	PrimaryMuscles   []string `json:"primaryMuscles"`
	SecondaryMuscles []string `json:"secondaryMuscles"`
	Links            []string `json:"links"`
	Multiplier       *float64 `json:"multiplier"`
	BaseWeightKg     *float64 `json:"baseWeightKg"`
}

func (p catalogPayload) toCatalogEntry() (store.CatalogEntry, error) {
	name := strings.TrimSpace(p.Name)
	if name == "" {
		return store.CatalogEntry{}, errors.New("name is required")
	}
	typeVal := strings.TrimSpace(p.Type)
	if typeVal == "" {
		return store.CatalogEntry{}, errors.New("type is required")
	}
	bodyPart := strings.TrimSpace(p.BodyPart)
	if bodyPart == "" {
		return store.CatalogEntry{}, errors.New("bodyPart is required")
	}
	equipment := strings.TrimSpace(p.Equipment)
	if equipment == "" {
		return store.CatalogEntry{}, errors.New("equipment is required")
	}
	level := strings.TrimSpace(p.Level)
	if level == "" {
		return store.CatalogEntry{}, errors.New("level is required")
	}
	primaryMuscles := sanitizeList(p.PrimaryMuscles)
	if len(primaryMuscles) == 0 {
		return store.CatalogEntry{}, errors.New("primaryMuscles is required")
	}
	entry := store.CatalogEntry{
		Name:             name,
		Description:      trimStringPtr(p.Description),
		Type:             typeVal,
		BodyPart:         bodyPart,
		Equipment:        equipment,
		Level:            level,
		PrimaryMuscles:   primaryMuscles,
		SecondaryMuscles: sanitizeList(p.SecondaryMuscles),
		Links:            sanitizeList(p.Links),
		Multiplier:       p.Multiplier,
		BaseWeightKg:     p.BaseWeightKg,
	}
	return entry, nil
}

func trimStringPtr(v *string) *string {
	if v == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*v)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func sanitizeList(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	seen := make(map[string]struct{})
	out := make([]string, 0, len(values))
	for _, v := range values {
		trimmed := strings.TrimSpace(v)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		out = append(out, trimmed)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func parseFloat(value string) (*float64, error) {
	num, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	if err != nil {
		return nil, err
	}
	return &num, nil
}

func (h *AdminHandler) UpsertCatalogJSON(w http.ResponseWriter, r *http.Request) {
	if _, ok := middleware.UserIDFromContext(r.Context()); !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var payloads []catalogPayload
	if err := json.Unmarshal(body, &payloads); err != nil {
		var single catalogPayload
		if errSingle := json.Unmarshal(body, &single); errSingle != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		payloads = append(payloads, single)
	}

	if len(payloads) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"upserted": 0})
		return
	}

	entries := make([]store.CatalogEntry, 0, len(payloads))
	for _, p := range payloads {
		entry, err := p.toCatalogEntry()
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		entries = append(entries, entry)
	}

	n, err := h.Catalog.Upsert(r.Context(), entries)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"upserted": n})
}

func (h *AdminHandler) UpsertCatalogCSV(w http.ResponseWriter, r *http.Request) {
	if _, ok := middleware.UserIDFromContext(r.Context()); !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil {
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

	index := func(name string) int {
		for i, h := range headers {
			if strings.EqualFold(strings.TrimSpace(h), name) {
				return i
			}
		}
		return -1
	}

	iName := index("name")
	iDesc := index("description")
	iType := index("type")
	iBody := index("body_part")
	iEquip := index("equipment")
	iLevel := index("level")
	iPrimary := index("primary_muscle")
	iSecondary := index("secondary_muscles")
	iLinks := index("links")
	iMultiplier := index("multiplier")
	iBase := index("base_weight_kg")

	if iName < 0 || iType < 0 || iBody < 0 || iEquip < 0 || iLevel < 0 || iPrimary < 0 {
		http.Error(w, "csv must include name,type,body_part,equipment,level,primary_muscle headers", http.StatusBadRequest)
		return
	}

	var entries []store.CatalogEntry
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			http.Error(w, "invalid csv row", http.StatusBadRequest)
			return
		}
		p := catalogPayload{
			Name:      record[iName],
			Type:      record[iType],
			BodyPart:  record[iBody],
			Equipment: record[iEquip],
			Level:     record[iLevel],
		}
		if iPrimary >= 0 && strings.TrimSpace(record[iPrimary]) != "" {
			p.PrimaryMuscles = strings.Split(record[iPrimary], "|")
		}
		if iDesc >= 0 {
			desc := record[iDesc]
			p.Description = &desc
		}
		if iSecondary >= 0 {
			p.SecondaryMuscles = strings.Split(record[iSecondary], "|")
		}
		if iLinks >= 0 {
			p.Links = strings.Split(record[iLinks], "|")
		}
		if iMultiplier >= 0 && strings.TrimSpace(record[iMultiplier]) != "" {
			if val, err := parseFloat(record[iMultiplier]); err == nil {
				p.Multiplier = val
			}
		}
		if iBase >= 0 && strings.TrimSpace(record[iBase]) != "" {
			if val, err := parseFloat(record[iBase]); err == nil {
				p.BaseWeightKg = val
			}
		}
		entry, err := p.toCatalogEntry()
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		entries = append(entries, entry)
	}

	if len(entries) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"upserted": 0})
		return
	}
	n, err := h.Catalog.Upsert(r.Context(), entries)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"upserted": n})
}
