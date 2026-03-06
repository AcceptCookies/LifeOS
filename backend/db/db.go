package db

import (
	"database/sql"
	"embed"
	"fmt"
	"log"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var migrations embed.FS

func Open() (*sql.DB, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://lifeos:lifeos@localhost:5433/lifeos?sslmode=disable"
	}

	conn, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	if err = conn.Ping(); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}

	if err = runMigrations(conn); err != nil {
		return nil, fmt.Errorf("migrations: %w", err)
	}

	log.Println("db ready")
	return conn, nil
}

func runMigrations(conn *sql.DB) error {
	goose.SetBaseFS(migrations)
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	return goose.Up(conn, "migrations")
}
