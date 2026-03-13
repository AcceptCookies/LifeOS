// Package testdb provides a helper that spins up a fresh isolated PostgreSQL
// database for each test and tears it down when the test finishes.
//
// Usage:
//
//	func TestSomething(t *testing.T) {
//	    conn := testdb.New(t)
//	    store := pantry.NewStore(conn)
//	    ...
//	}
//
// Requires a running PostgreSQL instance. Defaults to the docker-compose one:
//
//	docker-compose up -d postgres
//
// Override with TEST_DATABASE_URL=postgres://user:pass@host:port
package testdb

import (
	"database/sql"
	"fmt"
	"os"
	"testing"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"lifeos/db"
)

// New creates a fresh database, runs all migrations, and registers a cleanup
// that drops the database when the test ends.
func New(t *testing.T) *sql.DB {
	t.Helper()

	base := os.Getenv("TEST_DATABASE_URL")
	if base == "" {
		base = "postgres://lifeos:lifeos@localhost:5433"
	}

	// Connect to the postgres maintenance database to create the test DB.
	admin, err := sql.Open("pgx", base+"/postgres?sslmode=disable")
	if err != nil {
		t.Fatalf("testdb: open admin conn: %v", err)
	}
	defer admin.Close()

	dbName := fmt.Sprintf("lifeos_test_%d", time.Now().UnixNano())
	if _, err = admin.Exec("CREATE DATABASE " + dbName); err != nil {
		t.Fatalf("testdb: create database: %v", err)
	}

	dsn := fmt.Sprintf("%s/%s?sslmode=disable", base, dbName)
	conn, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatalf("testdb: open test conn: %v", err)
	}

	goose.SetBaseFS(*db.Migrations)
	if err = goose.SetDialect("postgres"); err != nil {
		t.Fatalf("testdb: goose dialect: %v", err)
	}
	if err = goose.Up(conn, "migrations"); err != nil {
		t.Fatalf("testdb: migrations: %v", err)
	}

	t.Cleanup(func() {
		conn.Close()
		drop, _ := sql.Open("pgx", base+"/postgres?sslmode=disable")
		drop.Exec("DROP DATABASE " + dbName + " WITH (FORCE)")
		drop.Close()
	})

	return conn
}
