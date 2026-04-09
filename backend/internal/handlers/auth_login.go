package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"deakr/aicm/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// Login verifies credentials and returns a JWT.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	h.loginWithAllowedRoles(w, r)
}

func (h *AuthHandler) LoginAdmin(w http.ResponseWriter, r *http.Request) {
	h.loginWithAllowedRoles(w, r, "admin")
}

func (h *AuthHandler) LoginAgent(w http.ResponseWriter, r *http.Request) {
	h.loginWithAllowedRoles(w, r, "agent")
}

func (h *AuthHandler) LoginWorkspace(w http.ResponseWriter, r *http.Request) {
	h.loginWithAllowedRoles(w, r, "admin", "agent")
}

func (h *AuthHandler) LoginCustomer(w http.ResponseWriter, r *http.Request) {
	h.loginWithAllowedRoles(w, r, "customer")
}

func (h *AuthHandler) loginWithAllowedRoles(w http.ResponseWriter, r *http.Request, allowedRoles ...string) {
	var payload models.AuthPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}
	normalizeAuthPayload(&payload)

	var user models.User
	query := `SELECT id, role, name, email, password_hash FROM users WHERE email = $1`
	err := h.DB.Pool.QueryRow(context.Background(), query, payload.Email).Scan(
		&user.ID,
		&user.Role,
		&user.Name,
		&user.Email,
		&user.PasswordHash,
	)
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	if user.PasswordHash == "" {
		http.Error(w, "This account does not have a password yet. Please complete customer registration first.", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(payload.Password)); err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	if len(allowedRoles) > 0 {
		authorized := false
		for _, role := range allowedRoles {
			if strings.EqualFold(role, user.Role) {
				authorized = true
				break
			}
		}
		if !authorized {
			http.Error(w, "This account is not allowed to sign in through this endpoint", http.StatusForbidden)
			return
		}
	}

	tokenString, err := signAuthToken(user.ID, user.Role)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": tokenString})
}

func signAuthToken(userID string, role string) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"role":    role,
		"exp":     time.Now().Add(time.Hour * 72).Unix(),
	})

	jwtSecret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if jwtSecret == "" {
		return "", errors.New("server auth is not configured")
	}
	return token.SignedString([]byte(jwtSecret))
}
