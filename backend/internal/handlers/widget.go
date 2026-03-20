package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"deakr/aicm/internal/database"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
)

type WidgetHandler struct {
	DB *database.Service
}

type WidgetInitPayload struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

type WidgetInitResponse struct {
	Token          string `json:"token"`
	ConversationID string `json:"conversation_id"`
}

// InitWidget finds or creates a customer, starts a conversation, and returns a session token.
func (h *WidgetHandler) InitWidget(w http.ResponseWriter, r *http.Request) {
	var payload WidgetInitPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(payload.Name)
	email := strings.TrimSpace(payload.Email)
	if name == "" || email == "" {
		http.Error(w, "Name and email are required", http.StatusBadRequest)
		return
	}

	// 1. Find or create the customer user.
	var userID string
	err := h.DB.Pool.QueryRow(context.Background(), "SELECT id FROM users WHERE email = $1", email).Scan(&userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			err = h.DB.Pool.QueryRow(
				context.Background(),
				"INSERT INTO users (role, name, email, password_hash) VALUES ('customer', $1, $2, '') RETURNING id",
				name,
				email,
			).Scan(&userID)
			if err != nil {
				http.Error(w, "Failed to create customer", http.StatusInternalServerError)
				return
			}
		} else {
			http.Error(w, "Failed to load customer", http.StatusInternalServerError)
			return
		}
	}

	// 2. Generate a JWT for this customer session.
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"role":    "customer",
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
	})
	jwtSecret := os.Getenv("JWT_SECRET")
	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		http.Error(w, "Failed to create session token", http.StatusInternalServerError)
		return
	}

	// 3. Find or create an active conversation for this customer.
	var conversationID string
	err = h.DB.Pool.QueryRow(
		context.Background(),
		"SELECT id FROM conversations WHERE customer_id = $1 AND status != 'resolved' LIMIT 1",
		userID,
	).Scan(&conversationID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			err = h.DB.Pool.QueryRow(
				context.Background(),
				"INSERT INTO conversations (customer_id, status) VALUES ($1, 'open') RETURNING id",
				userID,
			).Scan(&conversationID)
			if err != nil {
				http.Error(w, "Failed to create conversation", http.StatusInternalServerError)
				return
			}
		} else {
			http.Error(w, "Failed to load conversation", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(WidgetInitResponse{
		Token:          tokenString,
		ConversationID: conversationID,
	})
}
