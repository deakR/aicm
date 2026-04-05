package handlers

import (
	"encoding/json"
	"net/http"

	"deakr/aicm/internal/database"
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

// InitWidget is intentionally disabled for public guest sessions.
// Customers must sign in or register before a chat session can start.
func (h *WidgetHandler) InitWidget(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"message": "Customer sign-in is required before starting chat.",
	})
}
