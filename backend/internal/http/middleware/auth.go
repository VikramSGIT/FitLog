package middleware

import (
	"context"
	"net/http"
	"time"

	"exercise-tracker/internal/auth"
)

type contextKey string

const userIDKey contextKey = "userID"
const sessionCookieName = "session"

func WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, userIDKey, userID)
}

func UserIDFromContext(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(userIDKey).(string)
	return v, ok && v != ""
}

type AuthConfig struct {
	JWTSecret    string
	CookieDomain string
}

func (c AuthConfig) cookieSettings() (http.SameSite, bool) {
	// In local dev (no CookieDomain), use Lax and non-secure so cookies work over http://localhost via Vite proxy.
	// In deployed envs, require SameSite=None; Secure for cross-site usage.
	if c.CookieDomain == "" {
		return http.SameSiteLaxMode, false
	}
	return http.SameSiteNoneMode, true
}

func (c AuthConfig) SetSessionCookie(w http.ResponseWriter, token string, exp time.Time) {
	sameSite, secure := c.cookieSettings()
	cookie := &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		Domain:   c.CookieDomain,
		Expires:  exp,
		MaxAge:   int(time.Until(exp).Seconds()),
		SameSite: sameSite,
		HttpOnly: true,
		Secure:   secure,
	}
	http.SetCookie(w, cookie)
}

func (c AuthConfig) ClearSessionCookie(w http.ResponseWriter) {
	sameSite, secure := c.cookieSettings()
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		Domain:   c.CookieDomain,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
		SameSite: sameSite,
		HttpOnly: true,
		Secure:   secure,
	})
}

func (c AuthConfig) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Public endpoints (do not require session)
		if isPublicAuthPath(r.URL.Path) || r.URL.Path == "/healthz" {
			next.ServeHTTP(w, r)
			return
		}
		cookie, err := r.Cookie(sessionCookieName)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		claims, err := auth.ParseToken(c.JWTSecret, cookie.Value)
		if err != nil || claims == nil || claims.UserID == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		ctx := WithUserID(r.Context(), claims.UserID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func isPublicAuthPath(p string) bool {
	switch p {
	case "/api/auth/register", "/api/auth/login", "/api/auth/logout":
		return true
	default:
		return false
	}
}


