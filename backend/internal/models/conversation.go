package models

import "time"

// Conversation represents the metadata of a support thread
type Conversation struct {
	ID                 string     `json:"id"`
	CustomerID         string     `json:"customer_id"`
	AssigneeID         *string    `json:"assignee_id,omitempty"` // Pointer because it can be null
	Source             string     `json:"source"`
	Subject            *string    `json:"subject,omitempty"`
	Status             string     `json:"status"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
	CustomerLastReadAt *time.Time `json:"customer_last_read_at,omitempty"`
	AgentLastReadAt    *time.Time `json:"agent_last_read_at,omitempty"`
	AIConfidenceScore  float64    `json:"ai_confidence_score"`
	AIConfidenceLabel  string     `json:"ai_confidence_label"`
	AILastOutcome      string     `json:"ai_last_outcome"`
	AISourceTitle      *string    `json:"ai_source_title,omitempty"`
	Tags               []string   `json:"tags"`
	MergedIntoID       *string    `json:"merged_into_id,omitempty"`

	// Fields joined from other tables for the UI
	CustomerName string `json:"customer_name"`
	Preview      string `json:"preview"` // The last message sent
}

// Message represents an individual chat bubble
type Message struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversation_id"`
	SenderID       string    `json:"sender_id"`
	SenderRole     string    `json:"sender_role,omitempty"`
	Content        string    `json:"content"`
	AttachmentURL  *string   `json:"attachment_url,omitempty"`
	AttachmentName *string   `json:"attachment_name,omitempty"`
	AttachmentType *string   `json:"attachment_type,omitempty"`
	IsAIGenerated  bool      `json:"is_ai_generated"`
	IsInternal     bool      `json:"is_internal"`
	CreatedAt      time.Time `json:"created_at"`

	// Joined field for the UI
	SenderName string `json:"sender_name"`
}
