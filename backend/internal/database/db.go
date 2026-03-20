package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	Pool *pgxpool.Pool
}

// New initializes the database connection pool
func New() *Service {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is not set")
	}

	// Configure the connection pool
	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Fatalf("Unable to parse database URL: %v", err)
	}

	// Good default pool settings for a prototype
	config.MaxConns = 10
	config.MaxConnIdleTime = 5 * time.Minute

	// Create the pool
	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}

	// Verify the connection
	if err := pool.Ping(context.Background()); err != nil {
		log.Fatalf("Database ping failed: %v", err)
	}

	fmt.Println("Successfully connected to PostgreSQL database!")

	// Initialize schema
	if err := initSchema(pool); err != nil {
		log.Fatalf("Failed to initialize schema: %v", err)
	}

	fmt.Println("Database schema initialized!")

	return &Service{
		Pool: pool,
	}
}

// Close gracefully closes the database pool
func (s *Service) Close() {
	if s.Pool != nil {
		s.Pool.Close()
	}
}

// initSchema reads and executes the schema.sql file to set up the database tables
func initSchema(pool *pgxpool.Pool) error {
	schemaBytes, err := os.ReadFile("schema.sql")
	if err != nil {
		return fmt.Errorf("failed to read schema.sql: %w", err)
	}

	schema := string(schemaBytes)
	_, err = pool.Exec(context.Background(), schema)
	if err != nil {
		return fmt.Errorf("failed to execute schema: %w", err)
	}

	return nil
}
