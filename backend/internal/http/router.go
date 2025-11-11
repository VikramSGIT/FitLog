package http

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"

	"exercise-tracker/internal/http/middleware"
)

type Dependencies interface {
	FrontendOrigin() string
	AuthMiddleware() func(http.Handler) http.Handler
	RegisterRoutes(r chi.Router)
}

func NewRouter(frontendOrigin string, authMw func(http.Handler) http.Handler, register func(r chi.Router)) http.Handler {
	r := chi.NewRouter()

	if frontendOrigin != "" {
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins:   []string{frontendOrigin},
			AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
			ExposedHeaders:   []string{"Link"},
			AllowCredentials: true,
			MaxAge:           300,
		}))
	} else {
		// dev-friendly permissive CORS
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins:   []string{"*"},
			AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
			ExposedHeaders:   []string{"Link"},
			AllowCredentials: true,
			MaxAge:           300,
		}))
	}

	r.Use(middleware.RequestLogger)

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true,"ts":"` + time.Now().UTC().Format(time.RFC3339) + `"}`))
	})

	register(r)
	return r
}
