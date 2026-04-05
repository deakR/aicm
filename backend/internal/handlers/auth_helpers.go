package handlers

import (
	"context"
	"net/http"
	"strings"

	"deakr/aicm/internal/models"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

type errorMessageAndCode struct {
	Message string
	Code    int
}

func normalizeAuthPayload(payload *models.AuthPayload) {
	payload.Email = strings.TrimSpace(strings.ToLower(payload.Email))
	payload.Name = strings.TrimSpace(payload.Name)
	payload.Role = strings.TrimSpace(strings.ToLower(payload.Role))
}

func validateAuthPayload(payload models.AuthPayload) errorMessageAndCode {
	if payload.Email == "" || payload.Password == "" {
		return errorMessageAndCode{Message: "Email and password are required", Code: http.StatusBadRequest}
	}
	if len(payload.Password) < 8 {
		return errorMessageAndCode{Message: "Password must be at least 8 characters", Code: http.StatusBadRequest}
	}
	return errorMessageAndCode{}
}

func (h *AuthHandler) createUserWithRole(payload models.AuthPayload, role string) (string, errorMessageAndCode) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(payload.Password), bcrypt.DefaultCost)
	if err != nil {
		return "", errorMessageAndCode{Message: "Failed to hash password", Code: http.StatusInternalServerError}
	}

	var existingUserID string
	var existingRole string
	var existingPasswordHash string
	err = h.DB.Pool.QueryRow(
		context.Background(),
		"SELECT id, role, COALESCE(password_hash, '') FROM users WHERE email = $1",
		payload.Email,
	).Scan(&existingUserID, &existingRole, &existingPasswordHash)
	if err == nil {
		if role == "customer" && existingRole == "customer" && existingPasswordHash == "" {
			_, updateErr := h.DB.Pool.Exec(
				context.Background(),
				"UPDATE users SET name = $1, password_hash = $2 WHERE id = $3",
				payload.Name,
				string(hashedPassword),
				existingUserID,
			)
			if updateErr != nil {
				return "", errorMessageAndCode{Message: "Failed to upgrade existing customer account", Code: http.StatusInternalServerError}
			}
			return existingUserID, errorMessageAndCode{}
		}
		return "", errorMessageAndCode{Message: "Failed to create user (email might already exist)", Code: http.StatusConflict}
	}
	if err != pgx.ErrNoRows {
		return "", errorMessageAndCode{Message: "Failed to check existing users", Code: http.StatusInternalServerError}
	}

	query := `INSERT INTO users (role, name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id`
	var userID string
	err = h.DB.Pool.QueryRow(context.Background(), query, role, payload.Name, payload.Email, string(hashedPassword)).Scan(&userID)
	if err != nil {
		return "", errorMessageAndCode{Message: "Failed to create user (email might already exist)", Code: http.StatusConflict}
	}

	return userID, errorMessageAndCode{}
}
