package config

import (
	"log"
	"os"
	"strconv"
)

type Config struct {
	Port           int
	DatabaseURL    string
	JWTSecret      string
	FrontendOrigin string
	CookieDomain   string
	AdminEmails    string
}

func getenv(key, def string) string {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	return v
}

func MustLoad() Config {
	portStr := getenv("PORT", "8080")
	port, err := strconv.Atoi(portStr)
	if err != nil {
		log.Fatalf("invalid PORT: %v", err)
	}
	cfg := Config{
		Port:           port,
		DatabaseURL:    getenv("DATABASE_URL", "postgres://fitness_assistant:test123@100.0.0.4:54321/fitness_gym?sslmode=disable"),
		JWTSecret:      getenv("JWT_SECRET", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30"),
		FrontendOrigin: getenv("FRONTEND_ORIGIN", ""),
		CookieDomain:   getenv("COOKIE_DOMAIN", ""),
		AdminEmails:    getenv("ADMIN_EMAILS", ""),
	}
	if cfg.JWTSecret == "" {
		log.Println("warning: JWT_SECRET is empty")
	}
	if cfg.FrontendOrigin == "" {
		log.Println("warning: FRONTEND_ORIGIN is empty (CORS will be wide open in dev)")
	}
	return cfg
}


