package main

import (
	"context"
	"fmt"
	"log"
	"strings"

	"deakr/aicm/internal/database"

	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

type seededUser struct {
	Name     string
	Email    string
	Role     string
	Password string
}

type seededArticle struct {
	Title      string
	Collection string
	Section    string
	Content    string
	Status     string
}

func main() {
	for _, path := range []string{"../.env", ".env"} {
		_ = godotenv.Load(path)
	}

	db := database.New()
	defer db.Close()

	ctx := context.Background()
	if err := resetTables(ctx, db); err != nil {
		log.Fatalf("reset failed: %v", err)
	}

	if err := seedAISettings(ctx, db); err != nil {
		log.Fatalf("failed to seed AI settings: %v", err)
	}
	if err := seedArticles(ctx, db); err != nil {
		log.Fatalf("failed to seed articles: %v", err)
	}

	admin := createUser(ctx, db, seededUser{
		Name:     "Rohith Admin",
		Email:    "admin@aicm.local",
		Role:     "admin",
		Password: "Admin12345!",
	})
	agent := createUser(ctx, db, seededUser{
		Name:     "Maya Support",
		Email:    "agent@aicm.local",
		Role:     "agent",
		Password: "Agent12345!",
	})

	fmt.Println("Database reset complete.")
	fmt.Println("Seeded users:")
	fmt.Printf("  admin: %s / %s\n", admin.Email, admin.Password)
	fmt.Printf("  agent: %s / %s\n", agent.Email, agent.Password)
	fmt.Println("Seeded articles: 6")
	fmt.Println("Customers must now register through /customer/register before they can chat.")
}

func resetTables(ctx context.Context, db *database.Service) error {
	resetSQL := `
		TRUNCATE TABLE
			workflow_logs,
			ticket_notifications,
			ticket_comments,
			tickets,
			messages,
			conversations,
			workflows,
			articles,
			users
		RESTART IDENTITY CASCADE
	`
	_, err := db.Pool.Exec(ctx, resetSQL)
	return err
}

func seedAISettings(ctx context.Context, db *database.Service) error {
	_, err := db.Pool.Exec(
		ctx,
		`INSERT INTO ai_settings (id, name, greeting, tone, updated_at)
		 VALUES (1, 'AICM Concierge', 'Hi, I''m AICM Concierge. I''ll help first, and I can bring in a human agent if you need one.', 'friendly', CURRENT_TIMESTAMP)
		 ON CONFLICT (id) DO UPDATE
		 SET name = EXCLUDED.name,
		     greeting = EXCLUDED.greeting,
		     tone = EXCLUDED.tone,
		     updated_at = CURRENT_TIMESTAMP`,
	)
	return err
}

func createUser(ctx context.Context, db *database.Service, user seededUser) seededUser {
	passwordHash := ""
	if strings.TrimSpace(user.Password) != "" {
		hashed, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("failed to hash password for %s: %v", user.Email, err)
		}
		passwordHash = string(hashed)
	}

	if _, err := db.Pool.Exec(
		ctx,
		`INSERT INTO users (role, name, email, password_hash) VALUES ($1, $2, $3, $4)`,
		user.Role,
		user.Name,
		user.Email,
		passwordHash,
	); err != nil {
		log.Fatalf("failed to create %s user %s: %v", user.Role, user.Email, err)
	}

	return user
}

func seedArticles(ctx context.Context, db *database.Service) error {
	articles := []seededArticle{
		{
			Title:      "Refund Policy",
			Collection: "Billing",
			Section:    "Refunds",
			Content:    "Customers can request a full refund within 30 days of purchase. Once approved, refunds are processed back to the original payment method within 5 business days.",
			Status:     "published",
		},
		{
			Title:      "Billing and Duplicate Charges",
			Collection: "Billing",
			Section:    "Payments",
			Content:    "If a customer sees a duplicate card charge, first confirm whether one charge is still pending authorization. Pending duplicates usually disappear within 3 to 5 business days. If both charges settle, support should review the account and open a billing follow-up.",
			Status:     "published",
		},
		{
			Title:      "Shipping and Delivery Timelines",
			Collection: "Orders",
			Section:    "Shipping",
			Content:    "Standard shipping usually takes 3 to 5 business days inside India and 5 to 7 business days for international orders. Expedited shipping usually takes 1 to 2 business days after dispatch.",
			Status:     "published",
		},
		{
			Title:      "Change Delivery Address After Ordering",
			Collection: "Orders",
			Section:    "Delivery Changes",
			Content:    "Customers can update the delivery address before an order reaches packed status. Once packed or shipped, the address cannot be changed from the support dashboard.",
			Status:     "published",
		},
		{
			Title:      "Password Reset Help",
			Collection: "Account",
			Section:    "Login and Security",
			Content:    "If a customer cannot sign in, they should use the Forgot Password link. Password reset emails usually arrive within a few minutes. If no email arrives, they should check spam and confirm the email address attached to the account.",
			Status:     "published",
		},
		{
			Title:      "Account Cancellation and Data Deletion",
			Collection: "Account",
			Section:    "Account Management",
			Content:    "Customers can cancel their subscription at the end of the current billing cycle from account settings. Permanent data deletion requests must be handled by a human support agent after identity verification.",
			Status:     "published",
		},
	}

	for _, article := range articles {
		if _, err := db.Pool.Exec(
			ctx,
			`INSERT INTO articles (title, collection_name, section_name, content, status, view_count)
			 VALUES ($1, $2, $3, $4, $5, 0)`,
			article.Title,
			article.Collection,
			article.Section,
			article.Content,
			article.Status,
		); err != nil {
			return err
		}
	}

	return nil
}
