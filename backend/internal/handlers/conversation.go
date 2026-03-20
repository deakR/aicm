package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"deakr/aicm/internal/database"
	"deakr/aicm/internal/middleware"
	"deakr/aicm/internal/models"
	"deakr/aicm/internal/ws"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
)

type ConversationHandler struct {
	DB *database.Service
}

// ListConversations fetches all open/pending conversations for the inbox sidebar
func (h *ConversationHandler) ListConversations(w http.ResponseWriter, r *http.Request) {
	// Query joins the users table to get the customer name, and grabs the most recent message for the preview
	query := `
		SELECT 
			c.id, c.customer_id, c.status, c.created_at, c.updated_at,
			u.name as customer_name,
			COALESCE((SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1), 'No messages yet') as preview
		FROM conversations c
		JOIN users u ON c.customer_id = u.id
		ORDER BY c.updated_at DESC
	`

	rows, err := h.DB.Pool.Query(context.Background(), query)
	if err != nil {
		http.Error(w, "Failed to fetch conversations", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var conversations []models.Conversation
	for rows.Next() {
		var c models.Conversation
		err := rows.Scan(&c.ID, &c.CustomerID, &c.Status, &c.CreatedAt, &c.UpdatedAt, &c.CustomerName, &c.Preview)
		if err != nil {
			http.Error(w, "Error parsing conversations", http.StatusInternalServerError)
			return
		}
		conversations = append(conversations, c)
	}

	// Ensure we return an empty array instead of null if there are no conversations
	if conversations == nil {
		conversations = []models.Conversation{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(conversations)
}

// GetMessages fetches all messages for a specific conversation ID
func (h *ConversationHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	conversationID := chi.URLParam(r, "id")

	query := `
		SELECT 
			m.id, m.conversation_id, m.sender_id, m.content, m.is_ai_generated, m.created_at,
			u.name as sender_name
		FROM messages m
		JOIN users u ON m.sender_id = u.id
		WHERE m.conversation_id = $1
		ORDER BY m.created_at ASC
	`

	rows, err := h.DB.Pool.Query(context.Background(), query, conversationID)
	if err != nil {
		http.Error(w, "Failed to fetch messages", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var messages []models.Message
	for rows.Next() {
		var m models.Message
		err := rows.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.Content, &m.IsAIGenerated, &m.CreatedAt, &m.SenderName)
		if err != nil {
			http.Error(w, "Error parsing messages", http.StatusInternalServerError)
			return
		}
		messages = append(messages, m)
	}

	if messages == nil {
		messages = []models.Message{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

// MessagePayload is the expected JSON body for a new message
type MessagePayload struct {
	Content string `json:"content"`
}

// SendMessage adds a new message to a conversation
func (h *ConversationHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	conversationID := chi.URLParam(r, "id")

	// 1. Get the sender's ID from the JWT context
	claims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	senderID, ok := claims["user_id"].(string)
	if !ok || senderID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	senderName := "Agent"
	if role, ok := claims["role"].(string); ok && role == "customer" {
		senderName = "Customer"
	}

	// 2. Decode the request body
	var payload MessagePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || strings.TrimSpace(payload.Content) == "" {
		http.Error(w, "Invalid message content", http.StatusBadRequest)
		return
	}

	// 3. Insert into PostgreSQL
	query := `
		INSERT INTO messages (conversation_id, sender_id, content, is_ai_generated)
		VALUES ($1, $2, $3, false)
		RETURNING id, created_at
	`

	var newMessage models.Message
	newMessage.ConversationID = conversationID
	newMessage.SenderID = senderID
	newMessage.Content = payload.Content
	newMessage.IsAIGenerated = false
	newMessage.SenderName = senderName

	err := h.DB.Pool.QueryRow(context.Background(), query, conversationID, senderID, payload.Content).Scan(&newMessage.ID, &newMessage.CreatedAt)
	if err != nil {
		http.Error(w, "Failed to save message", http.StatusInternalServerError)
		return
	}

	// 4. Update the conversation's updated_at timestamp so it jumps to the top of the inbox
	updateQuery := `UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`
	_, _ = h.DB.Pool.Exec(context.Background(), updateQuery, conversationID)

	// Broadcast to any clients currently viewing this conversation.
	ws.Broadcast(conversationID, newMessage)

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(newMessage)
}
