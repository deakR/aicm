package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"deakr/aicm/internal/models"

	"github.com/go-chi/chi/v5"
)

// ListUsers returns users filtered by role.
func (h *AuthHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	_, role, ok := requestIdentity(r)
	if !ok || (role != "agent" && role != "admin") {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	targetRole := r.URL.Query().Get("role")
	query := "SELECT id, role, name, email, COALESCE(custom_attributes::text, '{}') FROM users"
	var args []interface{}
	if targetRole != "" {
		query += " WHERE role = $1"
		args = append(args, targetRole)
	}
	query += " ORDER BY name ASC"

	rows, err := h.DB.Pool.Query(context.Background(), query, args...)
	if err != nil {
		http.Error(w, "Failed to fetch users", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		var attrsJSON string
		if err := rows.Scan(&u.ID, &u.Role, &u.Name, &u.Email, &attrsJSON); err != nil {
			continue
		}
		_ = json.Unmarshal([]byte(attrsJSON), &u.CustomAttributes)
		users = append(users, u)
	}

	if users == nil {
		users = []models.User{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// UpdateUserCustomAttributes sets custom attributes for a user (admin or self).
// PUT /api/protected/users/{id}/attributes
func (h *AuthHandler) UpdateUserCustomAttributes(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	requesterID, role, ok := requestIdentity(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if role != "admin" && requesterID != userID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var attrs map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&attrs); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	attrsJSON, err := json.Marshal(attrs)
	if err != nil {
		http.Error(w, "Failed to encode attributes", http.StatusInternalServerError)
		return
	}

	_, err = h.DB.Pool.Exec(
		context.Background(),
		"UPDATE users SET custom_attributes = $1::jsonb WHERE id = $2",
		string(attrsJSON),
		userID,
	)
	if err != nil {
		http.Error(w, "Failed to update custom attributes", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Custom attributes updated"})
}
