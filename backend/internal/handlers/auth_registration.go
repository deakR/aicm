package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"

	"deakr/aicm/internal/models"
)

// Register creates a new user and hashes their password.
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	h.registerCustomer(w, r)
}

func (h *AuthHandler) RegisterCustomer(w http.ResponseWriter, r *http.Request) {
	h.registerCustomer(w, r)
}

func (h *AuthHandler) registerCustomer(w http.ResponseWriter, r *http.Request) {
	var payload models.AuthPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	normalizeAuthPayload(&payload)
	if validation := validateAuthPayload(payload); validation.Message != "" {
		http.Error(w, validation.Message, validation.Code)
		return
	}
	role := "customer"
	if strings.EqualFold(strings.TrimSpace(os.Getenv("ALLOW_ROLE_FROM_REGISTER")), "true") {
		switch payload.Role {
		case "customer", "agent", "admin":
			role = payload.Role
		}
	}

	userID, createErr := h.createUserWithRole(payload, role)
	if createErr.Message != "" {
		http.Error(w, createErr.Message, createErr.Code)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "User registered successfully", "id": userID})
}

// BootstrapAdmin creates the first human admin account for a local install.
func (h *AuthHandler) BootstrapAdmin(w http.ResponseWriter, r *http.Request) {
	var payload models.AuthPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	normalizeAuthPayload(&payload)
	if validation := validateAuthPayload(payload); validation.Message != "" {
		http.Error(w, validation.Message, validation.Code)
		return
	}

	var existingHumanAdmins int
	err := h.DB.Pool.QueryRow(
		context.Background(),
		"SELECT COUNT(*) FROM users WHERE role = 'admin' AND password_hash <> ''",
	).Scan(&existingHumanAdmins)
	if err != nil {
		http.Error(w, "Failed to check admin bootstrap state", http.StatusInternalServerError)
		return
	}
	if existingHumanAdmins > 0 {
		http.Error(w, "An admin account already exists. Use an authenticated admin to create more users.", http.StatusConflict)
		return
	}

	userID, createErr := h.createUserWithRole(payload, "admin")
	if createErr.Message != "" {
		http.Error(w, createErr.Message, createErr.Code)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Admin account created successfully",
		"id":      userID,
	})
}

// CreateUser allows an authenticated admin to create customer, agent, or admin accounts.
func (h *AuthHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	_, role, ok := requestIdentity(r)
	if !ok || role != "admin" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var payload models.AuthPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	normalizeAuthPayload(&payload)
	if validation := validateAuthPayload(payload); validation.Message != "" {
		http.Error(w, validation.Message, validation.Code)
		return
	}

	switch payload.Role {
	case "customer", "agent", "admin":
	default:
		http.Error(w, "Role must be one of customer, agent, or admin", http.StatusBadRequest)
		return
	}

	userID, createErr := h.createUserWithRole(payload, payload.Role)
	if createErr.Message != "" {
		http.Error(w, createErr.Message, createErr.Code)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "User created successfully",
		"id":      userID,
	})
}
