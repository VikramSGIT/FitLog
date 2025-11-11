package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"exercise-tracker/internal/http/middleware"
	"exercise-tracker/internal/store"
)

type SaveHandler struct {
	Service *store.Save
}

type saveRequest struct {
	Version         string            `json:"version"`
	IdempotencyKey  string            `json:"idempotencyKey"`
	Ops             []json.RawMessage `json:"ops"`
}

type saveResponse struct {
	Applied   bool                 `json:"applied"`
	Mapping   store.SaveMapping    `json:"mapping,omitempty"`
	UpdatedAt time.Time            `json:"updatedAt,omitempty"`
	Error     *saveErrorResponse   `json:"error,omitempty"`
}

type saveErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Handle processes a batch of operations and returns temp->real id mappings.
func (h *SaveHandler) Handle(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var req saveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Version) == "" {
		req.Version = "v1"
	}
	if req.Version != "v1" {
		http.Error(w, "unsupported version", http.StatusBadRequest)
		return
	}
	if len(req.Ops) == 0 {
		writeJSON(w, http.StatusOK, saveResponse{Applied: false, Mapping: store.SaveMapping{}})
		return
	}

	mapping, updatedAt, err := h.Service.ProcessBatch(r.Context(), uid, req.Ops, req.IdempotencyKey)
	if err != nil {
		log.Printf("save batch error: %v", err)
		writeJSON(w, http.StatusBadRequest, saveResponse{
			Applied: false,
			Error:   &saveErrorResponse{Code: "invalid_request", Message: err.Error()},
		})
		return
	}
	writeJSON(w, http.StatusOK, saveResponse{
		Applied:   true,
		Mapping:   mapping,
		UpdatedAt: updatedAt,
	})
}


