package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"deakr/aicm/internal/database"
	"deakr/aicm/internal/models"

	"github.com/go-chi/chi/v5"
)

type TicketHandler struct {
	DB *database.Service
}

func buildTicketStatusNotification(title string, status string) string {
	switch status {
	case "in_progress":
		return fmt.Sprintf("Your ticket \"%s\" is now in progress.", title)
	case "resolved":
		return fmt.Sprintf("Your ticket \"%s\" has been marked resolved.", title)
	case "closed":
		return fmt.Sprintf("Your ticket \"%s\" has been closed.", title)
	default:
		return fmt.Sprintf("Your ticket \"%s\" is now open.", title)
	}
}

// CreateTicket creates a new support ticket.
func (h *TicketHandler) CreateTicket(w http.ResponseWriter, r *http.Request) {
	_, role, ok := requestIdentity(r)
	if !ok || (role != "agent" && role != "admin") {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var payload models.TicketPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	payload.Title = strings.TrimSpace(payload.Title)
	payload.Description = strings.TrimSpace(payload.Description)
	payload.CustomerID = strings.TrimSpace(payload.CustomerID)
	if payload.Title == "" || payload.Description == "" || payload.CustomerID == "" {
		http.Error(w, "Title, description, and customer_id are required", http.StatusBadRequest)
		return
	}

	if payload.Priority == "" {
		payload.Priority = "medium"
	}
	if payload.Status == "" {
		payload.Status = "open"
	}

	query := `
		INSERT INTO tickets (conversation_id, customer_id, assignee_id, title, description, priority, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at
	`

	var t models.Ticket
	t.ConversationID = payload.ConversationID
	t.CustomerID = payload.CustomerID
	t.AssigneeID = payload.AssigneeID
	t.Title = payload.Title
	t.Description = payload.Description
	t.Priority = payload.Priority
	t.Status = payload.Status

	err := h.DB.Pool.QueryRow(
		context.Background(),
		query,
		payload.ConversationID,
		payload.CustomerID,
		payload.AssigneeID,
		payload.Title,
		payload.Description,
		payload.Priority,
		payload.Status,
	).Scan(&t.ID, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		fmt.Printf("Error creating ticket: %v\n", err)
		http.Error(w, "Failed to create ticket", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(t)
}

// ListTickets fetches all tickets, joining user data for friendly names.
func (h *TicketHandler) ListTickets(w http.ResponseWriter, r *http.Request) {
	_, role, ok := requestIdentity(r)
	if !ok || (role != "agent" && role != "admin") {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	priority := r.URL.Query().Get("priority")
	status := r.URL.Query().Get("status")

	query := `
		SELECT
			t.id, t.conversation_id, t.customer_id, t.assignee_id, t.title, t.description, t.priority, t.status, t.created_at, t.updated_at,
			c.name AS customer_name,
			c.email AS customer_email,
			a.name AS assignee_name,
			(
				SELECT MAX(created_at)
				FROM ticket_notifications tn
				WHERE tn.ticket_id = t.id
			) AS last_customer_notification
		FROM tickets t
		JOIN users c ON t.customer_id = c.id
		LEFT JOIN users a ON t.assignee_id = a.id
	`
	whereClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if priority != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("t.priority = $%d", argIdx))
		args = append(args, priority)
		argIdx++
	}
	if status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("t.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	if len(whereClauses) > 0 {
		query += " WHERE " + strings.Join(whereClauses, " AND ")
	}

	query += " ORDER BY t.created_at DESC"

	rows, err := h.DB.Pool.Query(context.Background(), query, args...)
	if err != nil {
		http.Error(w, "Failed to fetch tickets", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var tickets []models.Ticket
	for rows.Next() {
		var t models.Ticket
		err := rows.Scan(
			&t.ID,
			&t.ConversationID,
			&t.CustomerID,
			&t.AssigneeID,
			&t.Title,
			&t.Description,
			&t.Priority,
			&t.Status,
			&t.CreatedAt,
			&t.UpdatedAt,
			&t.CustomerName,
			&t.CustomerEmail,
			&t.AssigneeName,
			&t.LastCustomerNotification,
		)
		if err != nil {
			http.Error(w, "Error parsing tickets", http.StatusInternalServerError)
			return
		}
		tickets = append(tickets, t)
	}

	if tickets == nil {
		tickets = []models.Ticket{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tickets)
}

// UpdateTicket updates an existing ticket's status, priority, or assignee.
func (h *TicketHandler) UpdateTicket(w http.ResponseWriter, r *http.Request) {
	ticketID := chi.URLParam(r, "id")
	_, role, ok := requestIdentity(r)
	if !ok || (role != "agent" && role != "admin") {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var payload models.TicketPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	var previousStatus string
	var previousTitle string
	var customerID string
	err := h.DB.Pool.QueryRow(
		context.Background(),
		`SELECT status, title, customer_id FROM tickets WHERE id = $1`,
		ticketID,
	).Scan(&previousStatus, &previousTitle, &customerID)
	if err != nil {
		http.Error(w, "Ticket not found", http.StatusNotFound)
		return
	}

	setClauses := []string{"updated_at = CURRENT_TIMESTAMP"}
	args := []interface{}{}
	argIdx := 1
	statusChanged := false

	if status := strings.TrimSpace(payload.Status); status != "" {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, status)
		statusChanged = status != previousStatus
		argIdx++
	}

	if priority := strings.TrimSpace(payload.Priority); priority != "" {
		setClauses = append(setClauses, fmt.Sprintf("priority = $%d", argIdx))
		args = append(args, priority)
		argIdx++
	}

	if payload.AssigneeID != nil {
		assignee := strings.TrimSpace(*payload.AssigneeID)
		if assignee == "" {
			setClauses = append(setClauses, "assignee_id = NULL")
		} else {
			setClauses = append(setClauses, fmt.Sprintf("assignee_id = $%d", argIdx))
			args = append(args, assignee)
			argIdx++
		}
	}

	if len(setClauses) == 1 {
		http.Error(w, "No ticket fields provided to update", http.StatusBadRequest)
		return
	}

	updateQuery := fmt.Sprintf(`
		UPDATE tickets
		SET %s
		WHERE id = $%d
	`, strings.Join(setClauses, ", "), argIdx)
	args = append(args, ticketID)

	_, err = h.DB.Pool.Exec(context.Background(), updateQuery, args...)
	if err != nil {
		http.Error(w, "Failed to update ticket", http.StatusInternalServerError)
		return
	}

	if statusChanged {
		var newStatus string
		for i, clause := range setClauses {
			if strings.HasPrefix(clause, "status = $") {
				if value, ok := args[i-1].(string); ok {
					newStatus = value
				}
				break
			}
		}
		if newStatus == "" {
			newStatus = previousStatus
		}
		_, err = h.DB.Pool.Exec(
			context.Background(),
			`INSERT INTO ticket_notifications (ticket_id, customer_id, message, created_at)
			 VALUES ($1, $2, $3, $4)`,
			ticketID,
			customerID,
			buildTicketStatusNotification(previousTitle, newStatus),
			time.Now().UTC(),
		)
		if err != nil {
			http.Error(w, "Failed to record ticket notification", http.StatusInternalServerError)
			return
		}
	}

	// Re-fetch the full ticket with JOINed names (same shape as ListTickets)
	refetchQuery := `
		SELECT
			t.id, t.conversation_id, t.customer_id, t.assignee_id, t.title, t.description, t.priority, t.status, t.created_at, t.updated_at,
			c.name AS customer_name,
			c.email AS customer_email,
			a.name AS assignee_name,
			(
				SELECT MAX(created_at)
				FROM ticket_notifications tn
				WHERE tn.ticket_id = t.id
			) AS last_customer_notification
		FROM tickets t
		JOIN users c ON t.customer_id = c.id
		LEFT JOIN users a ON t.assignee_id = a.id
		WHERE t.id = $1
	`
	var t models.Ticket
	err = h.DB.Pool.QueryRow(context.Background(), refetchQuery, ticketID).Scan(
		&t.ID, &t.ConversationID, &t.CustomerID, &t.AssigneeID, &t.Title, &t.Description, &t.Priority, &t.Status, &t.CreatedAt, &t.UpdatedAt,
		&t.CustomerName, &t.CustomerEmail, &t.AssigneeName, &t.LastCustomerNotification,
	)
	if err != nil {
		http.Error(w, "Failed to fetch updated ticket", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(t)
}

// AddComment adds an internal note to a ticket.
func (h *TicketHandler) AddComment(w http.ResponseWriter, r *http.Request) {
	ticketID := chi.URLParam(r, "id")

	// Get author ID from the request context (injected by auth middleware).
	userID, role, ok := requestIdentity(r)
	if !ok || (role != "agent" && role != "admin") {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var payload struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || strings.TrimSpace(payload.Content) == "" {
		http.Error(w, "Invalid comment payload", http.StatusBadRequest)
		return
	}

	query := `
		INSERT INTO ticket_comments (ticket_id, author_id, content)
		VALUES ($1, $2, $3)
		RETURNING id, created_at
	`

	var comment models.TicketComment
	comment.TicketID = ticketID
	comment.AuthorID = userID
	comment.Content = strings.TrimSpace(payload.Content)

	err := h.DB.Pool.QueryRow(context.Background(), query, ticketID, userID, comment.Content).Scan(&comment.ID, &comment.CreatedAt)
	if err != nil {
		http.Error(w, "Failed to add comment", http.StatusInternalServerError)
		return
	}

	_ = h.DB.Pool.QueryRow(context.Background(), `SELECT COALESCE(name, email, id::text) FROM users WHERE id = $1`, userID).Scan(&comment.AuthorName)

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(comment)
}

// ListComments fetches the internal comment thread for a ticket.
func (h *TicketHandler) ListComments(w http.ResponseWriter, r *http.Request) {
	ticketID := chi.URLParam(r, "id")
	_, role, ok := requestIdentity(r)
	if !ok || (role != "agent" && role != "admin") {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.Pool.Query(
		context.Background(),
		`SELECT tc.id, tc.ticket_id, tc.author_id, tc.content, tc.created_at, u.name
		 FROM ticket_comments tc
		 JOIN users u ON tc.author_id = u.id
		 WHERE tc.ticket_id = $1
		 ORDER BY tc.created_at ASC`,
		ticketID,
	)
	if err != nil {
		http.Error(w, "Failed to fetch ticket comments", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	comments := []models.TicketComment{}
	for rows.Next() {
		var comment models.TicketComment
		if err := rows.Scan(&comment.ID, &comment.TicketID, &comment.AuthorID, &comment.Content, &comment.CreatedAt, &comment.AuthorName); err != nil {
			http.Error(w, "Failed to parse ticket comments", http.StatusInternalServerError)
			return
		}
		comments = append(comments, comment)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comments)
}

// ListNotifications fetches customer-facing ticket notifications for the prototype.
func (h *TicketHandler) ListNotifications(w http.ResponseWriter, r *http.Request) {
	ticketID := chi.URLParam(r, "id")
	_, role, ok := requestIdentity(r)
	if !ok || (role != "agent" && role != "admin") {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.Pool.Query(
		context.Background(),
		`SELECT id, ticket_id, customer_id, message, created_at
		 FROM ticket_notifications
		 WHERE ticket_id = $1
		 ORDER BY created_at DESC`,
		ticketID,
	)
	if err != nil {
		http.Error(w, "Failed to fetch ticket notifications", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	notifications := []models.TicketNotification{}
	for rows.Next() {
		var notification models.TicketNotification
		if err := rows.Scan(&notification.ID, &notification.TicketID, &notification.CustomerID, &notification.Message, &notification.CreatedAt); err != nil {
			http.Error(w, "Failed to parse ticket notifications", http.StatusInternalServerError)
			return
		}
		notifications = append(notifications, notification)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(notifications)
}
