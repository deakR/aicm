package models

import "time"

// Conversation represents the metadata of a support thread
type Conversation struct {
	ID           string    `json:"id"`
	CustomerID   string    `json:"customer_id"`
	AssigneeID   *string   `json:"assignee_id,omitempty"` // Pointer because it can be null
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	
	// Fields joined from other tables for the UI
	CustomerName string    `json:"customer_name"`
	Preview      string    `json:"preview"` // The last message sent
}

// Message represents an individual chat bubble
type Message struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversation_id"`
	SenderID       string    `json:"sender_id"`
	Content        string    `json:"content"`
	IsAIGenerated  bool      `json:"is_ai_generated"`
	CreatedAt      time.Time `json:"created_at"`

	// Joined field for the UI
	SenderName     string    `json:"sender_name"`
}