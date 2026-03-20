package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"time"

	"deakr/aicm/internal/database"
	"deakr/aicm/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	DB *database.Service
}

// Register creates a new user and hashes their password
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var payload models.AuthPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	// Default to customer if no role is provided
	if payload.Role == "" {
		payload.Role = "customer"
	}

	// Hash the password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(payload.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	// Insert into PostgreSQL
	query := `INSERT INTO users (role, name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id`
	var userID string
	err = h.DB.Pool.QueryRow(context.Background(), query, payload.Role, payload.Name, payload.Email, string(hashedPassword)).Scan(&userID)

	if err != nil {
		http.Error(w, "Failed to create user (email might already exist)", http.StatusConflict)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "User registered successfully", "id": userID})
}

// Login verifies credentials and returns a JWT
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var payload models.AuthPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	// Fetch user from DB
	var user models.User
	query := `SELECT id, role, name, email, password_hash FROM users WHERE email = $1`
	err := h.DB.Pool.QueryRow(context.Background(), query, payload.Email).Scan(&user.ID, &user.Role, &user.Name, &user.Email, &user.PasswordHash)

	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Compare passwords
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(payload.Password))
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Generate JWT
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"role":    user.Role,
		"exp":     time.Now().Add(time.Hour * 72).Unix(), // Token expires in 72 hours
	})

	jwtSecret := os.Getenv("JWT_SECRET")
	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"token": tokenString})
}
