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

	// Keep additive migrations here so older local DBs keep working after new fields are introduced.
	migrations := []string{
		"ALTER TABLE IF EXISTS messages ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT FALSE",
		"ALTER TABLE IF EXISTS messages ADD COLUMN IF NOT EXISTS attachment_url TEXT",
		"ALTER TABLE IF EXISTS messages ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255)",
		"ALTER TABLE IF EXISTS messages ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(50)",
		"ALTER TABLE IF EXISTS articles ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0",
		"ALTER TABLE IF EXISTS articles ADD COLUMN IF NOT EXISTS collection_name VARCHAR(120) NOT NULL DEFAULT 'General'",
		"ALTER TABLE IF EXISTS articles ADD COLUMN IF NOT EXISTS section_name VARCHAR(120) NOT NULL DEFAULT 'General'",
		"ALTER TABLE IF EXISTS conversations ADD COLUMN IF NOT EXISTS ai_confidence_score DOUBLE PRECISION DEFAULT 0",
		"ALTER TABLE IF EXISTS conversations ADD COLUMN IF NOT EXISTS ai_confidence_label VARCHAR(20) DEFAULT 'unknown'",
		"ALTER TABLE IF EXISTS conversations ADD COLUMN IF NOT EXISTS ai_last_outcome VARCHAR(20) DEFAULT 'unknown'",
		"ALTER TABLE IF EXISTS conversations ADD COLUMN IF NOT EXISTS ai_source_title VARCHAR(255)",
		"ALTER TABLE IF EXISTS conversations ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[]",
		"ALTER TABLE IF EXISTS conversations ADD COLUMN IF NOT EXISTS customer_last_read_at TIMESTAMP WITH TIME ZONE",
		"ALTER TABLE IF EXISTS conversations ADD COLUMN IF NOT EXISTS agent_last_read_at TIMESTAMP WITH TIME ZONE",
		"ALTER TABLE IF EXISTS conversations ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'web'",
		"ALTER TABLE IF EXISTS conversations ADD COLUMN IF NOT EXISTS subject VARCHAR(255)",
		"CREATE TABLE IF NOT EXISTS ticket_notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE, customer_id UUID REFERENCES users(id) NOT NULL, message TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)",
		"CREATE TABLE IF NOT EXISTS ai_settings (id INTEGER PRIMARY KEY CHECK (id = 1), name VARCHAR(255) NOT NULL DEFAULT 'AI Agent', greeting TEXT NOT NULL DEFAULT 'Hi, I''m your AI support assistant.', tone VARCHAR(50) NOT NULL DEFAULT 'friendly', brand_name VARCHAR(255) NOT NULL DEFAULT 'AICM Support', accent_color VARCHAR(7) NOT NULL DEFAULT '#2563EB', updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)",
		"ALTER TABLE IF EXISTS ai_settings ADD COLUMN IF NOT EXISTS brand_name VARCHAR(255) NOT NULL DEFAULT 'AICM Support'",
		"ALTER TABLE IF EXISTS ai_settings ADD COLUMN IF NOT EXISTS accent_color VARCHAR(7) NOT NULL DEFAULT '#2563EB'",
		"INSERT INTO ai_settings (id, name, greeting, tone, brand_name, accent_color) VALUES (1, 'AI Agent', 'Hi, I''m your AI support assistant.', 'friendly', 'AICM Support', '#2563EB') ON CONFLICT (id) DO NOTHING",
		// Drop old restrictive workflow constraints (they block change_status, escalate_to_human, time_elapsed, customer_attribute)
		"ALTER TABLE IF EXISTS workflows DROP CONSTRAINT IF EXISTS workflows_trigger_type_check",
		"ALTER TABLE IF EXISTS workflows DROP CONSTRAINT IF EXISTS workflows_action_type_check",
		// Add multi-condition support to workflows
		"ALTER TABLE IF EXISTS workflows ADD COLUMN IF NOT EXISTS conditions JSONB",
		"ALTER TABLE IF EXISTS workflows ADD COLUMN IF NOT EXISTS condition_logic VARCHAR(10) DEFAULT 'and'",
		// Add user custom attributes
		"ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS custom_attributes JSONB DEFAULT '{}'",
		// Add conversation merge tracking
		"ALTER TABLE IF EXISTS conversations ADD COLUMN IF NOT EXISTS merged_into_id UUID",
	}
	for _, stmt := range migrations {
		if _, err := pool.Exec(context.Background(), stmt); err != nil {
			return fmt.Errorf("failed to apply migration '%s': %w", stmt, err)
		}
	}

	return nil
}
