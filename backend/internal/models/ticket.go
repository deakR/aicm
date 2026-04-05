package models

import "time"

// Ticket represents a complex support issue.
type Ticket struct {
	ID             string    `json:"id"`
	ConversationID *string   `json:"conversation_id,omitempty"`
	CustomerID     string    `json:"customer_id"`
	AssigneeID     *string   `json:"assignee_id,omitempty"`
	Title          string    `json:"title"`
	Description    string    `json:"description"`
	Priority       string    `json:"priority"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	// Joined fields for the UI.
	CustomerName             string     `json:"customer_name,omitempty"`
	CustomerEmail            *string    `json:"customer_email,omitempty"`
	AssigneeName             *string    `json:"assignee_name,omitempty"`
	LastCustomerNotification *time.Time `json:"last_customer_notification,omitempty"`
}

// TicketPayload is the JSON expected from the frontend to create or update a ticket.
type TicketPayload struct {
	ConversationID *string `json:"conversation_id,omitempty"`
	CustomerID     string  `json:"customer_id"`
	AssigneeID     *string `json:"assignee_id,omitempty"`
	Title          string  `json:"title"`
	Description    string  `json:"description"`
	Priority       string  `json:"priority"`
	Status         string  `json:"status"`
}

// TicketComment represents an internal note on a ticket.
type TicketComment struct {
	ID        string    `json:"id"`
	TicketID  string    `json:"ticket_id"`
	AuthorID  string    `json:"author_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`

	// Joined field for the UI.
	AuthorName string `json:"author_name,omitempty"`
}

// TicketNotification represents a simulated customer-facing ticket update alert.
type TicketNotification struct {
	ID         string    `json:"id"`
	TicketID   string    `json:"ticket_id"`
	CustomerID string    `json:"customer_id"`
	Message    string    `json:"message"`
	CreatedAt  time.Time `json:"created_at"`
}
