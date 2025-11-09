package store

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/jmoiron/sqlx"

	"exercise-tracker/internal/models"
)

type Users struct {
	db *sqlx.DB
}

func NewUsers(db *sqlx.DB) *Users {
	return &Users{db: db}
}

func (s *Users) Create(ctx context.Context, email, passwordHash string) (*models.User, error) {
	const q = `
		insert into users (email, password_hash)
		values ($1, $2)
		returning id, email, password_hash, created_at, updated_at
	`
	u := new(models.User)
	if err := s.db.QueryRowxContext(ctx, q, strings.ToLower(email), passwordHash).StructScan(u); err != nil {
		return nil, err
	}
	return u, nil
}

func (s *Users) ByEmail(ctx context.Context, email string) (*models.User, error) {
	const q = `select id, email, password_hash, created_at, updated_at from users where email = $1`
	u := new(models.User)
	if err := s.db.QueryRowxContext(ctx, q, strings.ToLower(email)).StructScan(u); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return u, nil
}

func (s *Users) ByID(ctx context.Context, id string) (*models.User, error) {
	const q = `select id, email, password_hash, created_at, updated_at from users where id = $1`
	u := new(models.User)
	if err := s.db.QueryRowxContext(ctx, q, id).StructScan(u); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return u, nil
}


