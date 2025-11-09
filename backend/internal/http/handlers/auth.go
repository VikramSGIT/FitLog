package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"exercise-tracker/internal/auth"
	"exercise-tracker/internal/http/middleware"
	"exercise-tracker/internal/store"
)

type AuthHandler struct {
	Users       *store.Users
	JWTSecret   string
	CookieDomain string
}

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	UserID string `json:"userId"`
	Email  string `json:"email"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" || len(req.Password) < 6 {
		http.Error(w, "invalid email or password", http.StatusBadRequest)
		return
	}
	existing, err := h.Users.ByEmail(r.Context(), req.Email)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if existing != nil {
		http.Error(w, "email already in use", http.StatusConflict)
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	u, err := h.Users.Create(r.Context(), req.Email, hash)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	token, exp, err := auth.CreateToken(h.JWTSecret, u.ID, 30*24*time.Hour)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	mw := middleware.AuthConfig{JWTSecret: h.JWTSecret, CookieDomain: h.CookieDomain}
	mw.SetSessionCookie(w, token, exp)
	writeJSON(w, http.StatusCreated, authResponse{UserID: u.ID, Email: u.Email})
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	u, err := h.Users.ByEmail(r.Context(), strings.TrimSpace(req.Email))
	if err != nil || u == nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}
	ok, _ := auth.VerifyPassword(u.PasswordHash, req.Password)
	if !ok {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}
	token, exp, err := auth.CreateToken(h.JWTSecret, u.ID, 30*24*time.Hour)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	mw := middleware.AuthConfig{JWTSecret: h.JWTSecret, CookieDomain: h.CookieDomain}
	mw.SetSessionCookie(w, token, exp)
	writeJSON(w, http.StatusOK, authResponse{UserID: u.ID, Email: u.Email})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	mw := middleware.AuthConfig{JWTSecret: h.JWTSecret, CookieDomain: h.CookieDomain}
	mw.ClearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
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
	writeJSON(w, http.StatusOK, authResponse{UserID: u.ID, Email: u.Email})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}


