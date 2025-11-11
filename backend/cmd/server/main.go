package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"

	"exercise-tracker/internal/config"
	"exercise-tracker/internal/db"
	apphttp "exercise-tracker/internal/http"
	"exercise-tracker/internal/http/handlers"
	"exercise-tracker/internal/http/middleware"
	"exercise-tracker/internal/store"
)

func main() {
	cfg := config.MustLoad()

	ctx := context.Background()
	database, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer database.Close()

	if err := database.Migrate(ctx); err != nil {
		log.Fatalf("db migrate: %v", err)
	}

	usersStore := store.NewUsers(database.DB)
	daysStore := store.NewDays(database.DB)
	exercisesStore := store.NewExercises(database.DB)
	setsStore := store.NewSets(database.DB)
	catalogStore := store.NewCatalog(database.DB)
	saveStore := store.NewSave(database.DB)

	authCfg := middleware.AuthConfig{
		JWTSecret:    cfg.JWTSecret,
		CookieDomain: cfg.CookieDomain,
	}

	authHandler := &handlers.AuthHandler{
		Users:        usersStore,
		JWTSecret:    cfg.JWTSecret,
		CookieDomain: cfg.CookieDomain,
	}
	daysHandler := &handlers.DaysHandler{Days: daysStore}
	exercisesHandler := &handlers.ExercisesHandler{Exercises: exercisesStore}
	setsHandler := &handlers.SetsHandler{Sets: setsStore}
	catalogHandler := &handlers.CatalogHandler{Catalog: catalogStore}
	saveHandler := &handlers.SaveHandler{Service: saveStore}
	// Admin emails set
	adminSet := map[string]struct{}{}
	if cfg.AdminEmails != "" {
		for _, e := range strings.Split(cfg.AdminEmails, ",") {
			e = strings.TrimSpace(strings.ToLower(e))
			if e != "" {
				adminSet[e] = struct{}{}
			}
		}
	}
	adminHandler := &handlers.AdminHandler{
		Users:       usersStore,
		Catalog:     catalogStore,
		AdminEmails: adminSet,
	}

	router := apphttp.NewRouter(cfg.FrontendOrigin, authCfg.Middleware, func(r chi.Router) {
		r.Route("/api", func(r chi.Router) {
			// Public auth routes
			r.Route("/auth", func(r chi.Router) {
				r.Post("/register", authHandler.Register)
				r.Post("/login", authHandler.Login)
				r.Post("/logout", authHandler.Logout)
				r.Get("/me", authCfg.Middleware(http.HandlerFunc(authHandler.Me)).ServeHTTP)
			})

			// Authenticated routes
				r.Group(func(r chi.Router) {
					r.Use(authCfg.Middleware)
				r.Get("/days", daysHandler.GetByDate)        // /api/days?date=YYYY-MM-DD&ensure=true
				r.Post("/days", daysHandler.Create)          // body {date}
				r.Patch("/days/{dayId}", daysHandler.Update) // body {isRestDay}
				r.Post("/days/{dayId}/exercises", exercisesHandler.Create)
				r.Patch("/exercises/{id}", exercisesHandler.Update)
				r.Delete("/exercises/{id}", exercisesHandler.Delete)
				r.Post("/exercises/{id}/sets", setsHandler.Create)
				r.Patch("/sets/{id}", setsHandler.Update)
				r.Delete("/sets/{id}", setsHandler.Delete)
				r.Post("/exercises/{id}/rests", setsHandler.CreateRest)
				r.Patch("/rests/{id}", setsHandler.UpdateRest)
				r.Delete("/rests/{id}", setsHandler.DeleteRest)

				// Catalog search
				r.Get("/catalog", catalogHandler.Search)
				r.Get("/catalog/facets", catalogHandler.Facets)
				r.Get("/catalog/entries/{id}", catalogHandler.GetEntry)
				r.Put("/catalog/entries/{id}", catalogHandler.UpdateEntry)

				// Admin-only routes
				r.Post("/catalog/admin/import", adminHandler.UpsertCatalogJSON)
				r.Post("/catalog/admin/import/csv", adminHandler.UpsertCatalogCSV)

				// Batch save
				r.Post("/save", saveHandler.Handle)
				r.Get("/save/epoch", saveHandler.Epoch)
			})
		})
	})

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Port),
		Handler:           router,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("listening on :%d", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	// Graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}
