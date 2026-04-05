package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"deakr/aicm/internal/ai"
	"deakr/aicm/internal/database"
	"deakr/aicm/internal/middleware"
	"deakr/aicm/internal/models"
	"deakr/aicm/internal/ws"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
)

type ConversationHandler struct {
	DB *database.Service
	AI *ai.Service
}

type articleMatch struct {
	ID              string
	Title           string
	Content         string
	SourceMode      string
	Score           int
	QueryTokenCount int
	TitleMatches    int
	ContentMatches  int
	UniqueMatches   int
	ConfidenceScore float64
	ConfidenceLabel string
}

type suggestedArticle struct {
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	Excerpt    string  `json:"excerpt"`
	MatchScore float64 `json:"match_score"`
}

type priorConversationSummary struct {
	ID            string  `json:"id"`
	Status        string  `json:"status"`
	Source        string  `json:"source"`
	Subject       *string `json:"subject,omitempty"`
	UpdatedAt     string  `json:"updated_at"`
	Preview       string  `json:"preview"`
	AILastOutcome string  `json:"ai_last_outcome"`
}

type copilotCacheEntry struct {
	Data      CopilotResponse
	ExpiresAt time.Time
}

var (
	copilotCache   = map[string]copilotCacheEntry{}
	copilotCacheMu sync.RWMutex
	aiTriggerMu    sync.Mutex
	aiLastTrigger  = map[string]time.Time{}
)

func copilotSuccessTTL() time.Duration {
	if raw := strings.TrimSpace(os.Getenv("COPILOT_CACHE_TTL_SECONDS")); raw != "" {
		if sec, err := strconv.Atoi(raw); err == nil && sec > 0 {
			return time.Duration(sec) * time.Second
		}
	}
	return 15 * time.Minute
}

func setCopilotCache(conversationID string, data CopilotResponse, ttl time.Duration) {
	if ttl <= 0 {
		return
	}
	copilotCacheMu.Lock()
	copilotCache[conversationID] = copilotCacheEntry{
		Data:      data,
		ExpiresAt: time.Now().Add(ttl),
	}
	copilotCacheMu.Unlock()
}

func getCopilotCache(conversationID string) (CopilotResponse, bool) {
	copilotCacheMu.RLock()
	entry, ok := copilotCache[conversationID]
	copilotCacheMu.RUnlock()
	if !ok {
		return CopilotResponse{}, false
	}
	if time.Now().After(entry.ExpiresAt) {
		copilotCacheMu.Lock()
		delete(copilotCache, conversationID)
		copilotCacheMu.Unlock()
		return CopilotResponse{}, false
	}
	return entry.Data, true
}

func invalidateCopilotCache(conversationID string) {
	copilotCacheMu.Lock()
	delete(copilotCache, conversationID)
	copilotCacheMu.Unlock()
}

func aiMinTriggerInterval() time.Duration {
	if raw := strings.TrimSpace(os.Getenv("AI_MIN_TRIGGER_INTERVAL_SECONDS")); raw != "" {
		if sec, err := strconv.Atoi(raw); err == nil && sec > 0 {
			return time.Duration(sec) * time.Second
		}
	}
	return 2 * time.Second
}

func shouldTriggerAI(conversationID string) bool {
	minInterval := aiMinTriggerInterval()
	now := time.Now()
	aiTriggerMu.Lock()
	defer aiTriggerMu.Unlock()
	if last, ok := aiLastTrigger[conversationID]; ok && now.Sub(last) < minInterval {
		return false
	}
	aiLastTrigger[conversationID] = now
	return true
}

func aiConfidenceThreshold() float64 {
	if raw := strings.TrimSpace(os.Getenv("AI_CONFIDENCE_THRESHOLD")); raw != "" {
		if v, err := strconv.ParseFloat(raw, 64); err == nil && v > 0 && v <= 1 {
			return v
		}
	}
	return 0.5
}

func classifyConfidence(score float64) string {
	switch {
	case score >= 0.75:
		return "high"
	case score >= 0.5:
		return "medium"
	case score > 0:
		return "low"
	default:
		return "none"
	}
}

func clampScore(score float64) float64 {
	switch {
	case score < 0:
		return 0
	case score > 1:
		return 1
	default:
		return score
	}
}

func requestIdentity(r *http.Request) (string, string, bool) {
	claims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		return "", "", false
	}

	userID, ok := claims["user_id"].(string)
	if !ok || strings.TrimSpace(userID) == "" {
		return "", "", false
	}
	role, ok := claims["role"].(string)
	if !ok || strings.TrimSpace(role) == "" {
		return "", "", false
	}

	return userID, role, true
}

func (h *ConversationHandler) canAccessConversation(ctx context.Context, conversationID string, userID string, role string) (bool, error) {
	if role == "agent" || role == "admin" {
		return true, nil
	}
	if role != "customer" {
		return false, nil
	}

	var exists bool
	err := h.DB.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM conversations WHERE id = $1 AND customer_id = $2)", conversationID, userID).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

func (h *ConversationHandler) loadConversationSnapshot(ctx context.Context, conversationID string) (models.Conversation, error) {
	var c models.Conversation
	err := h.DB.Pool.QueryRow(ctx, `
		SELECT
			c.id,
			c.customer_id,
			c.assignee_id,
			c.source,
			c.subject,
			c.status,
			c.created_at,
			c.updated_at,
			c.customer_last_read_at,
			c.agent_last_read_at,
			COALESCE(c.ai_confidence_score, 0),
			COALESCE(c.ai_confidence_label, 'unknown'),
			COALESCE(c.ai_last_outcome, 'unknown'),
			c.ai_source_title,
			COALESCE(c.tags, ARRAY[]::TEXT[]),
			u.name as customer_name,
			COALESCE((SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1), 'No messages yet') as preview
		FROM conversations c
		JOIN users u ON c.customer_id = u.id
		WHERE c.id = $1
	`, conversationID).Scan(
		&c.ID,
		&c.CustomerID,
		&c.AssigneeID,
		&c.Source,
		&c.Subject,
		&c.Status,
		&c.CreatedAt,
		&c.UpdatedAt,
		&c.CustomerLastReadAt,
		&c.AgentLastReadAt,
		&c.AIConfidenceScore,
		&c.AIConfidenceLabel,
		&c.AILastOutcome,
		&c.AISourceTitle,
		&c.Tags,
		&c.CustomerName,
		&c.Preview,
	)
	return c, err
}

func (h *ConversationHandler) touchConversation(ctx context.Context, conversationID string) {
	_, _ = h.DB.Pool.Exec(ctx, `UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, conversationID)
}

func (h *ConversationHandler) broadcastConversationSnapshot(ctx context.Context, conversationID string) {
	updatedConversation, err := h.loadConversationSnapshot(ctx, conversationID)
	if err != nil {
		return
	}
	ws.Broadcast(conversationID, map[string]interface{}{
		"type":    "conversation_update",
		"payload": updatedConversation,
	})
	ws.BroadcastSupport(map[string]interface{}{
		"type":    "conversation_update",
		"payload": updatedConversation,
	})
}

func (h *ConversationHandler) findOrCreateCustomer(ctx context.Context, name string, email string) (string, error) {
	var userID string
	err := h.DB.Pool.QueryRow(ctx, "SELECT id FROM users WHERE email = $1", email).Scan(&userID)
	if err == nil {
		_, _ = h.DB.Pool.Exec(ctx, "UPDATE users SET name = $1 WHERE id = $2 AND COALESCE(name, '') <> $1", name, userID)
		return userID, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}

	err = h.DB.Pool.QueryRow(
		ctx,
		"INSERT INTO users (role, name, email, password_hash) VALUES ('customer', $1, $2, '') RETURNING id",
		name,
		email,
	).Scan(&userID)
	if err != nil {
		return "", err
	}
	return userID, nil
}

func excerptText(text string, maxLen int) string {
	cleaned := strings.Join(strings.Fields(strings.TrimSpace(text)), " ")
	if len(cleaned) <= maxLen {
		return cleaned
	}
	if maxLen <= 3 {
		return cleaned[:maxLen]
	}
	return cleaned[:maxLen-3] + "..."
}

func normalizeTags(tags []string) []string {
	if len(tags) == 0 {
		return []string{}
	}

	seen := make(map[string]struct{}, len(tags))
	normalized := make([]string, 0, len(tags))
	for _, tag := range tags {
		cleaned := strings.ToLower(strings.TrimSpace(tag))
		if cleaned == "" {
			continue
		}
		if _, exists := seen[cleaned]; exists {
			continue
		}
		seen[cleaned] = struct{}{}
		normalized = append(normalized, cleaned)
	}

	sort.Strings(normalized)
	return normalized
}

func (h *ConversationHandler) mergeConversationTags(ctx context.Context, conversationID string, additions []string) []string {
	var existing []string
	if err := h.DB.Pool.QueryRow(ctx, "SELECT COALESCE(tags, ARRAY[]::TEXT[]) FROM conversations WHERE id = $1", conversationID).Scan(&existing); err != nil {
		return normalizeTags(additions)
	}
	return normalizeTags(append(existing, additions...))
}

func buildSuggestedArticles(matches []articleMatch, limit int) []suggestedArticle {
	if len(matches) == 0 {
		return []suggestedArticle{}
	}
	if len(matches) > limit {
		matches = matches[:limit]
	}

	suggestions := make([]suggestedArticle, 0, len(matches))
	for _, match := range matches {
		suggestions = append(suggestions, suggestedArticle{
			ID:         match.ID,
			Title:      match.Title,
			Excerpt:    excerptText(match.Content, 180),
			MatchScore: match.ConfidenceScore,
		})
	}
	return suggestions
}

func (h *ConversationHandler) ListConversations(w http.ResponseWriter, r *http.Request) {
	_, role, ok := requestIdentity(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if role == "customer" {
		http.Error(w, "Forbidden: Support inbox is available to agent/admin roles only", http.StatusForbidden)
		return
	}

	baseQuery := `
		SELECT
			c.id, c.customer_id, c.assignee_id, c.source, c.subject, c.status, c.created_at, c.updated_at,
			c.customer_last_read_at, c.agent_last_read_at,
			COALESCE(c.ai_confidence_score, 0), COALESCE(c.ai_confidence_label, 'unknown'),
			COALESCE(c.ai_last_outcome, 'unknown'), c.ai_source_title, COALESCE(c.tags, ARRAY[]::TEXT[]),
			u.name as customer_name,
			COALESCE((SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1), 'No messages yet') as preview
		FROM conversations c
		JOIN users u ON c.customer_id = u.id
	`

	whereClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if status := r.URL.Query().Get("status"); status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("c.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	if assigneeID := r.URL.Query().Get("assignee_id"); assigneeID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("c.assignee_id = $%d", argIdx))
		args = append(args, assigneeID)
		argIdx++
	}

	if source := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("source"))); source != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("c.source = $%d", argIdx))
		args = append(args, source)
		argIdx++
	}

	if daysRaw := strings.TrimSpace(r.URL.Query().Get("days")); daysRaw != "" {
		if days, err := strconv.Atoi(daysRaw); err == nil && days > 0 {
			whereClauses = append(whereClauses, fmt.Sprintf("c.updated_at >= NOW() - MAKE_INTERVAL(days => $%d)", argIdx))
			args = append(args, days)
			argIdx++
		}
	}

	if tag := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("tag"))); tag != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("EXISTS (SELECT 1 FROM UNNEST(COALESCE(c.tags, ARRAY[]::TEXT[])) AS tag_value WHERE tag_value = $%d)", argIdx))
		args = append(args, tag)
		argIdx++
	}

	query := baseQuery
	if len(whereClauses) > 0 {
		query += " WHERE " + strings.Join(whereClauses, " AND ")
	}
	query += " ORDER BY c.updated_at DESC"

	rows, err := h.DB.Pool.Query(context.Background(), query, args...)
	if err != nil {
		http.Error(w, "Failed to fetch conversations", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var conversations []models.Conversation
	for rows.Next() {
		var c models.Conversation
		err := rows.Scan(
			&c.ID,
			&c.CustomerID,
			&c.AssigneeID,
			&c.Source,
			&c.Subject,
			&c.Status,
			&c.CreatedAt,
			&c.UpdatedAt,
			&c.CustomerLastReadAt,
			&c.AgentLastReadAt,
			&c.AIConfidenceScore,
			&c.AIConfidenceLabel,
			&c.AILastOutcome,
			&c.AISourceTitle,
			&c.Tags,
			&c.CustomerName,
			&c.Preview,
		)
		if err != nil {
			http.Error(w, "Error parsing conversations", http.StatusInternalServerError)
			return
		}
		conversations = append(conversations, c)
	}

	if conversations == nil {
		conversations = []models.Conversation{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(conversations)
}

func (h *ConversationHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	conversationID := chi.URLParam(r, "id")
	userID, role, ok := requestIdentity(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	allowed, err := h.canAccessConversation(context.Background(), conversationID, userID, role)
	if err != nil {
		http.Error(w, "Failed to verify conversation access", http.StatusInternalServerError)
		return
	}
	if !allowed {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	query := `
		SELECT
			m.id, m.conversation_id, m.sender_id, u.role, m.content, m.attachment_url, m.attachment_name, m.attachment_type, m.is_ai_generated, m.is_internal, m.created_at,
			u.name as sender_name
		FROM messages m
		JOIN users u ON m.sender_id = u.id
		WHERE m.conversation_id = $1
		ORDER BY m.created_at ASC
	`

	rows, err := h.DB.Pool.Query(context.Background(), query, conversationID)
	if err != nil {
		log.Printf("ERROR: Failed to fetch messages for conversation %s: %v", conversationID, err)
		http.Error(w, "Failed to fetch messages", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var messages []models.Message
	for rows.Next() {
		var m models.Message
		err := rows.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.SenderRole, &m.Content, &m.AttachmentURL, &m.AttachmentName, &m.AttachmentType, &m.IsAIGenerated, &m.IsInternal, &m.CreatedAt, &m.SenderName)
		if err != nil {
			log.Printf("ERROR: Failed to scan message row: %v", err)
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

type MessagePayload struct {
	Content        string  `json:"content"`
	AttachmentURL  *string `json:"attachment_url,omitempty"`
	AttachmentName *string `json:"attachment_name,omitempty"`
	AttachmentType *string `json:"attachment_type,omitempty"`
}

func (h *ConversationHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	conversationID := chi.URLParam(r, "id")

	senderID, role, ok := requestIdentity(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	allowed, err := h.canAccessConversation(context.Background(), conversationID, senderID, role)
	if err != nil {
		http.Error(w, "Failed to verify conversation access", http.StatusInternalServerError)
		return
	}
	if !allowed {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Keep a UI-friendly label so clients can render message alignment immediately.
	senderName := "Agent"
	if role == "customer" {
		senderName = "Customer"
	} else if role != "agent" && role != "admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var payload MessagePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid message payload", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(payload.Content) == "" && payload.AttachmentURL == nil {
		http.Error(w, "Message content or attachment is required", http.StatusBadRequest)
		return
	}

	isInternal := false
	if r.URL.Query().Get("is_internal") == "true" && (role == "agent" || role == "admin") {
		isInternal = true
	}

	query := `
		INSERT INTO messages (conversation_id, sender_id, content, attachment_url, attachment_name, attachment_type, is_ai_generated, is_internal)
		VALUES ($1, $2, $3, $4, $5, $6, false, $7)
		RETURNING id, created_at
	`

	var newMessage models.Message
	newMessage.ConversationID = conversationID
	newMessage.SenderID = senderID
	newMessage.SenderRole = role
	newMessage.Content = payload.Content
	newMessage.AttachmentURL = payload.AttachmentURL
	newMessage.AttachmentName = payload.AttachmentName
	newMessage.AttachmentType = payload.AttachmentType
	newMessage.IsAIGenerated = false
	newMessage.IsInternal = isInternal
	newMessage.SenderName = senderName

	err = h.DB.Pool.QueryRow(context.Background(), query, conversationID, senderID, payload.Content, payload.AttachmentURL, payload.AttachmentName, payload.AttachmentType, isInternal).Scan(&newMessage.ID, &newMessage.CreatedAt)
	if err != nil {
		http.Error(w, "Failed to save message", http.StatusInternalServerError)
		return
	}
	invalidateCopilotCache(conversationID)

	h.touchConversation(context.Background(), conversationID)
	h.broadcastConversationSnapshot(context.Background(), conversationID)

	// Only broadcast non-internal messages via websocket so the widget
	// never shows internal agent notes to customers.
	if !isInternal {
		ws.Broadcast(conversationID, newMessage)
	}

	// Run workflow automation checks before AI generation.
	if role == "customer" {
		workflowEngine := &WorkflowHandler{DB: h.DB}
		go workflowEngine.EvaluateMessage(context.Background(), conversationID, payload.Content)
	}

	if role == "customer" && h.AI != nil && shouldTriggerAI(conversationID) {
		go h.triggerAIAgent(conversationID, payload.Content)
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(newMessage)
}

// AssignConversation updates the assignee of a conversation.
func (h *ConversationHandler) AssignConversation(w http.ResponseWriter, r *http.Request) {
	conversationID := chi.URLParam(r, "id")
	_, role, ok := requestIdentity(r)
	if !ok || (role != "agent" && role != "admin") {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var payload struct {
		AssigneeID *string   `json:"assignee_id"`
		Status     *string   `json:"status"`
		Tags       *[]string `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	if payload.AssigneeID == nil && payload.Status == nil && payload.Tags == nil {
		http.Error(w, "No conversation fields provided to update", http.StatusBadRequest)
		return
	}

	setClauses := []string{"updated_at = CURRENT_TIMESTAMP"}
	args := []interface{}{}
	argIdx := 1

	if payload.Status != nil {
		status := strings.TrimSpace(*payload.Status)
		switch status {
		case "open", "pending", "resolved", "snoozed":
			setClauses = append(setClauses, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, status)
			argIdx++
		default:
			http.Error(w, "Invalid conversation status", http.StatusBadRequest)
			return
		}
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

	if payload.Tags != nil {
		setClauses = append(setClauses, fmt.Sprintf("tags = $%d", argIdx))
		args = append(args, normalizeTags(*payload.Tags))
		argIdx++
	}

	query := fmt.Sprintf(`
		UPDATE conversations
		SET %s
		WHERE id = $%d
	`, strings.Join(setClauses, ", "), argIdx)
	args = append(args, conversationID)

	if _, err := h.DB.Pool.Exec(context.Background(), query, args...); err != nil {
		http.Error(w, "Failed to update conversation", http.StatusInternalServerError)
		return
	}

	c, err := h.loadConversationSnapshot(context.Background(), conversationID)
	if err != nil {
		http.Error(w, "Failed to load updated conversation", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(c)

	ws.Broadcast(conversationID, map[string]interface{}{
		"type":    "conversation_update",
		"payload": c,
	})
	ws.BroadcastSupport(map[string]interface{}{
		"type":    "conversation_update",
		"payload": c,
	})
}

func (h *ConversationHandler) triggerAIAgent(conversationID string, customerMessage string) {
	ctx := context.Background()
	settings, settingsErr := loadAISettings(ctx, h.DB)
	if settingsErr != nil {
		settings = defaultAISettings()
	}

	ws.Broadcast(conversationID, map[string]interface{}{
		"type": "typing",
		"payload": map[string]interface{}{
			"conversation_id": conversationID,
			"role":            "admin",
			"name":            settings.Name,
			"is_typing":       true,
		},
	})
	defer ws.Broadcast(conversationID, map[string]interface{}{
		"type": "typing",
		"payload": map[string]interface{}{
			"conversation_id": conversationID,
			"role":            "admin",
			"name":            settings.Name,
			"is_typing":       false,
		},
	})

	match := h.lookupBestArticle(ctx, customerMessage)
	shouldAnswerFromKnowledge := strings.TrimSpace(match.Content) != "" && match.ConfidenceScore >= aiConfidenceThreshold()
	customerRequestedHuman := customerRequestedHumanSupport(customerMessage)

	systemInstruction := fmt.Sprintf(
		"You are %s, a helpful customer support AI agent with a %s tone. Reply in 1 or 2 short sentences. Give the customer a direct answer first, then one practical next step only if needed. Keep the tone %s.",
		settings.Name,
		settings.Tone,
		settings.Tone,
	)

	aiReply := "I'm sorry, I couldn't process that request right now."
	aiOutcome := "unanswered"
	if shouldAnswerFromKnowledge {
		systemInstruction += fmt.Sprintf("A trusted help center article was retrieved via %s search with %s confidence. Use ONLY the article below to answer. Do not say you are transferring to a human if the article contains the answer.\n\nTitle: %s\nContent: %s", match.SourceMode, match.ConfidenceLabel, match.Title, match.Content)
		reply, err := h.AI.GenerateSupportReply(ctx, systemInstruction, customerMessage)
		if err != nil {
			fmt.Printf("Error calling LLM provider with article context: %v\n", err)
			aiReply = summarizeArticleForCustomer(match.Content)
		} else {
			aiReply = strings.TrimSpace(reply)
			if aiReply == "" || containsEscalationLanguage(aiReply) {
				// Keep the customer experience answer-first when retrieval was confident.
				aiReply = summarizeArticleForCustomer(match.Content)
			}
		}
		aiReply += fmt.Sprintf("\n\n*(Based on: %s)*", match.Title)
		aiOutcome = "answered"
	} else if strings.TrimSpace(match.Content) != "" {
		aiReply = fallbackKnowledgeReply(match)
		aiOutcome = "unanswered"
	} else if customerRequestedHuman {
		aiReply = "I can bring a human support agent into this conversation. I've shared the context so they can pick it up from here."
		aiOutcome = "escalated"
	} else {
		aiReply = "I don't have enough verified information to give a final answer yet. Tell me a little more about the issue or share an order, invoice, or account detail, and I'll narrow it down before we bring in a human agent."
		aiOutcome = "unanswered"
	}

	var hasPreviousAIReply bool
	_ = h.DB.Pool.QueryRow(
		ctx,
		`SELECT EXISTS(SELECT 1 FROM messages WHERE conversation_id = $1 AND is_ai_generated = true)`,
		conversationID,
	).Scan(&hasPreviousAIReply)
	if !hasPreviousAIReply && strings.TrimSpace(settings.Greeting) != "" && !strings.Contains(strings.ToLower(aiReply), strings.ToLower(settings.Greeting)) {
		aiReply = strings.TrimSpace(settings.Greeting) + " " + aiReply
	}

	// ---------------------------------------------------------
	// 5. SAVE AND BROADCAST
	// ---------------------------------------------------------
	// Use an upsert to avoid the race condition where two goroutines both
	// find no row and both try to INSERT, causing a unique-constraint error.
	var aiSenderID string
	if err := h.DB.Pool.QueryRow(ctx,
		`INSERT INTO users (role, name, email, password_hash)
		 VALUES ('admin', $1, 'ai-agent@local.system', '')
		 ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
		 RETURNING id`,
		settings.Name,
	).Scan(&aiSenderID); err != nil {
		fmt.Printf("Failed to upsert AI sender user: %v\n", err)
		return
	}

	aiMessageQuery := `
		INSERT INTO messages (conversation_id, sender_id, content, is_ai_generated)
		VALUES ($1, $2, $3, true)
		RETURNING id, created_at
	`

	var newAIMessage models.Message
	newAIMessage.ConversationID = conversationID
	newAIMessage.SenderID = aiSenderID
	newAIMessage.SenderRole = "admin"
	newAIMessage.Content = aiReply
	newAIMessage.IsAIGenerated = true
	newAIMessage.SenderName = settings.Name

	if err := h.DB.Pool.QueryRow(ctx, aiMessageQuery, conversationID, aiSenderID, aiReply).Scan(&newAIMessage.ID, &newAIMessage.CreatedAt); err != nil {
		fmt.Printf("Failed to save AI message: %v\n", err)
		return
	}

	h.touchConversation(ctx, conversationID)
	h.updateConversationAIAssessment(ctx, conversationID, match, aiOutcome)
	h.broadcastConversationSnapshot(ctx, conversationID)
	ws.Broadcast(conversationID, newAIMessage)
}

func (h *ConversationHandler) lookupBestArticle(ctx context.Context, customerMessage string) articleMatch {
	matches := h.lookupArticleMatches(ctx, customerMessage, 1)
	if len(matches) > 0 {
		return matches[0]
	}

	return articleMatch{
		ConfidenceLabel: "none",
	}
}

func (h *ConversationHandler) lookupArticleMatches(ctx context.Context, customerMessage string, limit int) []articleMatch {
	rows, err := h.DB.Pool.Query(ctx, `SELECT id, title, content FROM articles WHERE status = 'published'`)
	if err == nil {
		defer rows.Close()

		matches := []articleMatch{}
		for rows.Next() {
			var id, title, content string
			if scanErr := rows.Scan(&id, &title, &content); scanErr != nil {
				continue
			}
			match := scoreArticleMatch(customerMessage, title, content)
			if match.Score <= 0 || strings.TrimSpace(match.Content) == "" {
				continue
			}
			match.ID = id
			matches = append(matches, match)
		}

		if len(matches) == 0 {
			return []articleMatch{}
		}

		sort.Slice(matches, func(i, j int) bool {
			if matches[i].ConfidenceScore == matches[j].ConfidenceScore {
				if matches[i].Score == matches[j].Score {
					return matches[i].Title < matches[j].Title
				}
				return matches[i].Score > matches[j].Score
			}
			return matches[i].ConfidenceScore > matches[j].ConfidenceScore
		})

		if limit > 0 && len(matches) > limit {
			matches = matches[:limit]
		}
		return matches
	}

	return []articleMatch{}
}

func summarizeArticleForCustomer(article string) string {
	cleaned := strings.Join(strings.Fields(strings.TrimSpace(article)), " ")
	if cleaned == "" {
		return "I found a relevant help article, but I couldn't format a clean answer from it just now."
	}

	sentences := splitIntoSentences(cleaned)
	if len(sentences) == 1 {
		return sentences[0]
	}
	return strings.TrimSpace(sentences[0] + " " + sentences[1])
}

func containsEscalationLanguage(text string) bool {
	lowered := strings.ToLower(text)
	phrases := []string{
		"human agent",
		"support agent",
		"connect you",
		"transfer you",
		"escalate",
	}
	for _, phrase := range phrases {
		if strings.Contains(lowered, phrase) {
			return true
		}
	}
	return false
}

func customerRequestedHumanSupport(text string) bool {
	lowered := strings.ToLower(text)
	phrases := []string{
		"human",
		"real person",
		"support agent",
		"live agent",
		"talk to someone",
		"speak to someone",
		"connect me to",
		"transfer me",
		"escalate this",
	}
	for _, phrase := range phrases {
		if strings.Contains(lowered, phrase) {
			return true
		}
	}
	return false
}

func fallbackKnowledgeReply(match articleMatch) string {
	if strings.TrimSpace(match.Content) == "" {
		return "I couldn't find verified guidance for that yet. Share a little more detail and I'll keep narrowing it down."
	}

	summary := summarizeArticleForCustomer(match.Content)
	if strings.TrimSpace(match.Title) == "" {
		return "Here is the closest guidance I found: " + summary
	}
	return fmt.Sprintf("Here is the closest guidance I found: %s\n\n*(Closest match: %s)*", summary, match.Title)
}

func (h *ConversationHandler) updateConversationAIAssessment(ctx context.Context, conversationID string, match articleMatch, outcome string) {
	_, err := h.DB.Pool.Exec(
		ctx,
		`UPDATE conversations
		 SET ai_confidence_score = $2,
		     ai_confidence_label = $3,
		     ai_last_outcome = $4,
		     ai_source_title = $5,
		     updated_at = CURRENT_TIMESTAMP
		 WHERE id = $1`,
		conversationID,
		match.ConfidenceScore,
		match.ConfidenceLabel,
		outcome,
		nullableArticleTitle(match.Title),
	)
	if err != nil {
		fmt.Printf("Failed to save AI assessment: %v\n", err)
	}
}

func nullableArticleTitle(title string) interface{} {
	trimmed := strings.TrimSpace(title)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func splitIntoSentences(text string) []string {
	var sentences []string
	start := 0

	for i, r := range text {
		if r != '.' && r != '!' && r != '?' {
			continue
		}

		sentence := strings.TrimSpace(text[start : i+1])
		if sentence != "" {
			sentences = append(sentences, sentence)
		}
		start = i + 1
	}

	if start < len(text) {
		tail := strings.TrimSpace(text[start:])
		if tail != "" {
			sentences = append(sentences, tail)
		}
	}

	if len(sentences) == 0 {
		return []string{text}
	}
	return sentences
}

func scoreArticleMatch(customerMessage string, title string, content string) articleMatch {
	queryTokens := tokenizeSearchText(customerMessage)
	if len(queryTokens) == 0 {
		return articleMatch{}
	}

	titleTokens := tokenizeSearchText(title)
	contentTokens := tokenizeSearchText(content)

	titleSet := make(map[string]struct{}, len(titleTokens))
	for _, token := range titleTokens {
		titleSet[token] = struct{}{}
	}

	contentSet := make(map[string]struct{}, len(contentTokens))
	for _, token := range contentTokens {
		contentSet[token] = struct{}{}
	}

	score := 0
	titleMatches := 0
	contentMatches := 0
	uniqueMatches := map[string]struct{}{}

	for _, token := range queryTokens {
		if _, ok := titleSet[token]; ok {
			score += 3
			titleMatches++
			uniqueMatches[token] = struct{}{}
			continue
		}
		if _, ok := contentSet[token]; ok {
			score++
			contentMatches++
			uniqueMatches[token] = struct{}{}
		}
	}

	coverage := float64(len(uniqueMatches)) / float64(len(queryTokens))
	titleCoverage := float64(titleMatches) / float64(len(queryTokens))
	matchDensity := clampScore(float64(score) / 6.0)
	confidenceScore := clampScore((coverage * 0.6) + (titleCoverage * 0.25) + (matchDensity * 0.15))

	return articleMatch{
		Title:           title,
		Content:         content,
		SourceMode:      "keyword",
		Score:           score,
		QueryTokenCount: len(queryTokens),
		TitleMatches:    titleMatches,
		ContentMatches:  contentMatches,
		UniqueMatches:   len(uniqueMatches),
		ConfidenceScore: confidenceScore,
		ConfidenceLabel: classifyConfidence(confidenceScore),
	}
}

func tokenizeSearchText(text string) []string {
	parts := strings.FieldsFunc(strings.ToLower(text), func(r rune) bool {
		return (r < 'a' || r > 'z') && (r < '0' || r > '9')
	})

	stopWords := map[string]struct{}{
		"a": {}, "an": {}, "and": {}, "are": {}, "after": {}, "can": {}, "do": {}, "for": {}, "how": {},
		"i": {}, "if": {}, "in": {}, "is": {}, "it": {}, "long": {}, "my": {}, "of": {}, "on": {}, "or": {},
		"the": {}, "to": {}, "what": {}, "when": {}, "why": {}, "with": {}, "you": {}, "your": {},
	}

	tokens := make([]string, 0, len(parts))
	for _, part := range parts {
		part = normalizeSearchToken(part)
		if len(part) < 3 {
			continue
		}
		if _, blocked := stopWords[part]; blocked {
			continue
		}
		tokens = append(tokens, part)
	}
	return tokens
}

func normalizeSearchToken(part string) string {
	switch {
	case strings.HasSuffix(part, "ing") && len(part) > 5:
		part = strings.TrimSuffix(part, "ing")
	case strings.HasSuffix(part, "ed") && len(part) > 4:
		part = strings.TrimSuffix(part, "ed")
	case strings.HasSuffix(part, "al") && len(part) > 5:
		part = strings.TrimSuffix(part, "al")
	}
	if strings.HasSuffix(part, "s") && len(part) > 4 {
		part = strings.TrimSuffix(part, "s")
	}
	return part
}

// CopilotResponse is the structured data we expect from the AI provider.
type CopilotResponse struct {
	Summary            string                     `json:"summary"`
	SuggestedReply     string                     `json:"suggested_reply"`
	Articles           []suggestedArticle         `json:"articles"`
	PriorConversations []priorConversationSummary `json:"prior_conversations"`
}

func (h *ConversationHandler) loadPriorConversationSummaries(ctx context.Context, conversationID string, limit int) []priorConversationSummary {
	if limit <= 0 {
		limit = 3
	}

	rows, err := h.DB.Pool.Query(ctx, `
		SELECT
			c.id,
			c.status,
			c.source,
			c.subject,
			TO_CHAR(c.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at,
			COALESCE(
				(
					SELECT m.content
					FROM messages m
					WHERE m.conversation_id = c.id
					ORDER BY m.created_at DESC
					LIMIT 1
				),
				'No messages yet'
			) AS preview,
			COALESCE(c.ai_last_outcome, 'unknown') AS ai_last_outcome
		FROM conversations c
		WHERE c.customer_id = (
			SELECT customer_id FROM conversations WHERE id = $1
		)
		AND c.id <> $1
		AND c.merged_into_id IS NULL
		ORDER BY c.updated_at DESC
		LIMIT $2
	`, conversationID, limit)
	if err != nil {
		return []priorConversationSummary{}
	}
	defer rows.Close()

	summaries := make([]priorConversationSummary, 0, limit)
	for rows.Next() {
		var item priorConversationSummary
		if scanErr := rows.Scan(
			&item.ID,
			&item.Status,
			&item.Source,
			&item.Subject,
			&item.UpdatedAt,
			&item.Preview,
			&item.AILastOutcome,
		); scanErr != nil {
			continue
		}
		item.Preview = excerptText(item.Preview, 180)
		summaries = append(summaries, item)
	}
	return summaries
}

// GenerateCopilotInsights asks the configured AI provider to analyze a thread.
func (h *ConversationHandler) GenerateCopilotInsights(w http.ResponseWriter, r *http.Request) {
	conversationID := chi.URLParam(r, "id")
	ctx := context.Background()
	userID, role, ok := requestIdentity(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if role == "customer" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	allowed, err := h.canAccessConversation(ctx, conversationID, userID, role)
	if err != nil {
		http.Error(w, "Failed to verify conversation access", http.StatusInternalServerError)
		return
	}
	if !allowed {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	fallback := CopilotResponse{
		Summary:            "I could not summarize this thread right now.",
		SuggestedReply:     "Thanks for the update. I am reviewing your conversation and will help you with the next step.",
		Articles:           []suggestedArticle{},
		PriorConversations: []priorConversationSummary{},
	}
	w.Header().Set("Content-Type", "application/json")

	if cached, ok := getCopilotCache(conversationID); ok {
		json.NewEncoder(w).Encode(cached)
		return
	}

	// 1. Fetch the recent message history for this conversation.
	query := `
		SELECT u.name, m.content
		FROM messages m
		JOIN users u ON m.sender_id = u.id
		WHERE m.conversation_id = $1
		ORDER BY m.created_at ASC
		LIMIT 20
	`
	rows, err := h.DB.Pool.Query(ctx, query, conversationID)
	if err != nil {
		http.Error(w, "Failed to fetch history", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var historyBuilder strings.Builder
	for rows.Next() {
		var name, content string
		if err := rows.Scan(&name, &content); err == nil {
			historyBuilder.WriteString(fmt.Sprintf("%s: %s\n", name, content))
		}
	}

	history := historyBuilder.String()
	if history == "" {
		empty := CopilotResponse{
			Summary:            "No messages in this conversation yet.",
			SuggestedReply:     "Hi there! How can I help you today?",
			Articles:           []suggestedArticle{},
			PriorConversations: []priorConversationSummary{},
		}
		setCopilotCache(conversationID, empty, 2*time.Minute)
		json.NewEncoder(w).Encode(empty)
		return
	}

	articleSuggestions := buildSuggestedArticles(h.lookupArticleMatches(ctx, history, 3), 3)
	priorConversations := h.loadPriorConversationSummaries(ctx, conversationID, 4)
	fallback.Articles = articleSuggestions
	fallback.PriorConversations = priorConversations

	var priorHistoryBuilder strings.Builder
	for _, convo := range priorConversations {
		subject := ""
		if convo.Subject != nil && strings.TrimSpace(*convo.Subject) != "" {
			subject = fmt.Sprintf(" | subject: %s", strings.TrimSpace(*convo.Subject))
		}
		priorHistoryBuilder.WriteString(fmt.Sprintf(
			"- [%s] %s via %s%s | AI outcome: %s | last note: %s\n",
			convo.UpdatedAt,
			strings.ToUpper(convo.Status),
			convo.Source,
			subject,
			convo.AILastOutcome,
			convo.Preview,
		))
	}

	priorHistoryBlock := "None"
	if priorHistoryBuilder.Len() > 0 {
		priorHistoryBlock = priorHistoryBuilder.String()
	}

	// 2. Build the Copilot prompt.
	prompt := fmt.Sprintf(`Analyze the following customer support conversation.
Return a JSON object with exactly two keys:
1. "summary": A brief 1-2 sentence summary of the customer's issue.
2. "suggested_reply": A professional, helpful suggested next reply for the human agent to send to the customer.

If the customer has prior support history, use it as context to avoid repeating steps they already completed.
Mention repeat history only when it helps the agent reply more intelligently.

Previous Conversations:

%s

Conversation History:

%s`, priorHistoryBlock, history)

	// 3. Call the API.
	aiJSON, err := h.AI.GenerateCopilotJSON(ctx, prompt)
	if err != nil {
		fmt.Printf("Copilot generation failed: %v\n", err)
		setCopilotCache(conversationID, fallback, 90*time.Second)
		json.NewEncoder(w).Encode(fallback)
		return
	}

	// 4. Extract and send the JSON back to the frontend.
	var parsed CopilotResponse
	if err := json.Unmarshal([]byte(aiJSON), &parsed); err != nil {
		cleaned := strings.TrimSpace(aiJSON)
		cleaned = strings.TrimPrefix(cleaned, "```json")
		cleaned = strings.TrimPrefix(cleaned, "```")
		cleaned = strings.TrimSuffix(cleaned, "```")
		cleaned = strings.TrimSpace(cleaned)
		if err := json.Unmarshal([]byte(cleaned), &parsed); err != nil {
			fmt.Printf("Copilot JSON parse failed: %v\n", err)
			setCopilotCache(conversationID, fallback, 90*time.Second)
			json.NewEncoder(w).Encode(fallback)
			return
		}
	}

	if strings.TrimSpace(parsed.Summary) == "" {
		parsed.Summary = fallback.Summary
	}
	if strings.TrimSpace(parsed.SuggestedReply) == "" {
		parsed.SuggestedReply = fallback.SuggestedReply
	}
	if parsed.Articles == nil {
		parsed.Articles = articleSuggestions
	}
	if parsed.PriorConversations == nil {
		parsed.PriorConversations = priorConversations
	}

	setCopilotCache(conversationID, parsed, copilotSuccessTTL())
	json.NewEncoder(w).Encode(parsed)
}

// SimulateEmail creates an email-sourced conversation for omnichannel demo flows.
// POST /api/protected/conversations/email-sim
func (h *ConversationHandler) SimulateEmail(w http.ResponseWriter, r *http.Request) {
	_, role, ok := requestIdentity(r)
	if !ok || (role != "agent" && role != "admin") {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var payload struct {
		Name    string `json:"name"`
		Email   string `json:"email"`
		Subject string `json:"subject"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	payload.Name = strings.TrimSpace(payload.Name)
	payload.Email = strings.TrimSpace(payload.Email)
	payload.Subject = strings.TrimSpace(payload.Subject)
	payload.Content = strings.TrimSpace(payload.Content)

	if payload.Name == "" || payload.Email == "" || payload.Subject == "" || payload.Content == "" {
		http.Error(w, "Name, email, subject, and content are required", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	customerID, err := h.findOrCreateCustomer(ctx, payload.Name, payload.Email)
	if err != nil {
		http.Error(w, "Failed to load customer", http.StatusInternalServerError)
		return
	}

	var conversationID string
	err = h.DB.Pool.QueryRow(
		ctx,
		`INSERT INTO conversations (customer_id, source, subject, status)
		 VALUES ($1, 'email', $2, 'open')
		 RETURNING id`,
		customerID,
		payload.Subject,
	).Scan(&conversationID)
	if err != nil {
		http.Error(w, "Failed to create email conversation", http.StatusInternalServerError)
		return
	}

	var message models.Message
	err = h.DB.Pool.QueryRow(
		ctx,
		`INSERT INTO messages (conversation_id, sender_id, content, is_ai_generated, is_internal)
		 VALUES ($1, $2, $3, false, false)
		 RETURNING id, created_at`,
		conversationID,
		customerID,
		payload.Content,
	).Scan(&message.ID, &message.CreatedAt)
	if err != nil {
		http.Error(w, "Failed to create email message", http.StatusInternalServerError)
		return
	}

	message.ConversationID = conversationID
	message.SenderID = customerID
	message.SenderRole = "customer"
	message.SenderName = payload.Name
	message.Content = payload.Content

	workflowEngine := &WorkflowHandler{DB: h.DB}
	go workflowEngine.EvaluateNewConversation(context.Background(), conversationID)
	go workflowEngine.EvaluateMessage(context.Background(), conversationID, payload.Content)

	if h.AI != nil && shouldTriggerAI(conversationID) {
		go h.triggerAIAgent(conversationID, payload.Content)
	}

	conversation, err := h.loadConversationSnapshot(ctx, conversationID)
	if err != nil {
		http.Error(w, "Failed to load created conversation", http.StatusInternalServerError)
		return
	}
	ws.BroadcastSupport(map[string]interface{}{
		"type":    "conversation_update",
		"payload": conversation,
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"conversation": conversation,
		"message":      message,
	})
}

// BulkAction applies an action to multiple conversations at once.
// POST /api/protected/conversations/bulk
// Body: { "action": "resolve"|"assign"|"tag"|"snooze", "conversation_ids": [...], "assignee_id"?: "...", "tags"?: [...], "status"?: "..." }
func (h *ConversationHandler) BulkAction(w http.ResponseWriter, r *http.Request) {
	_, role, ok := requestIdentity(r)
	if !ok || (role != "agent" && role != "admin") {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var payload struct {
		Action          string    `json:"action"`
		ConversationIDs []string  `json:"conversation_ids"`
		AssigneeID      *string   `json:"assignee_id,omitempty"`
		Tags            *[]string `json:"tags,omitempty"`
		Status          *string   `json:"status,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}
	if len(payload.ConversationIDs) == 0 {
		http.Error(w, "No conversation IDs provided", http.StatusBadRequest)
		return
	}
	if len(payload.ConversationIDs) > 100 {
		http.Error(w, "Cannot bulk-update more than 100 conversations at once", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	updated := 0

	for _, convID := range payload.ConversationIDs {
		applied := false
		switch payload.Action {
		case "resolve":
			_, err := h.DB.Pool.Exec(ctx, "UPDATE conversations SET status = 'resolved', updated_at = CURRENT_TIMESTAMP WHERE id = $1", convID)
			if err == nil {
				updated++
				applied = true
			}
		case "reopen":
			_, err := h.DB.Pool.Exec(ctx, "UPDATE conversations SET status = 'open', updated_at = CURRENT_TIMESTAMP WHERE id = $1", convID)
			if err == nil {
				updated++
				applied = true
			}
		case "snooze":
			_, err := h.DB.Pool.Exec(ctx, "UPDATE conversations SET status = 'snoozed', updated_at = CURRENT_TIMESTAMP WHERE id = $1", convID)
			if err == nil {
				updated++
				applied = true
			}
		case "assign":
			if payload.AssigneeID != nil {
				_, err := h.DB.Pool.Exec(ctx, "UPDATE conversations SET assignee_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", *payload.AssigneeID, convID)
				if err == nil {
					updated++
					applied = true
				}
			}
		case "tag":
			if payload.Tags != nil {
				normalized := normalizeTags(*payload.Tags)
				_, err := h.DB.Pool.Exec(ctx, `
					UPDATE conversations
					SET tags = ARRAY(
						SELECT DISTINCT tag_value FROM UNNEST(COALESCE(tags, ARRAY[]::TEXT[]) || $1::TEXT[]) AS tag_value ORDER BY tag_value
					), updated_at = CURRENT_TIMESTAMP
					WHERE id = $2`, normalized, convID)
				if err == nil {
					updated++
					applied = true
				}
			}
		case "untag":
			if payload.Tags != nil {
				normalized := normalizeTags(*payload.Tags)
				_, err := h.DB.Pool.Exec(ctx, `
					UPDATE conversations
					SET tags = ARRAY(SELECT tag_val FROM UNNEST(COALESCE(tags, ARRAY[]::TEXT[])) AS tag_val WHERE tag_val != ALL($1::TEXT[])),
						updated_at = CURRENT_TIMESTAMP
					WHERE id = $2`, normalized, convID)
				if err == nil {
					updated++
					applied = true
				}
			}
		}
		if applied {
			h.broadcastConversationSnapshot(ctx, convID)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"updated": updated,
		"message": fmt.Sprintf("%d conversation(s) updated", updated),
	})
}

// MergeConversation merges a source conversation into a target conversation.
// POST /api/protected/conversations/{id}/merge
// Body: { "target_id": "uuid-of-target-conversation" }
// All messages from source are moved to target, source is marked as merged.
func (h *ConversationHandler) MergeConversation(w http.ResponseWriter, r *http.Request) {
	sourceID := chi.URLParam(r, "id")
	_, role, ok := requestIdentity(r)
	if !ok || (role != "agent" && role != "admin") {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var payload struct {
		TargetID string `json:"target_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}
	if payload.TargetID == "" || payload.TargetID == sourceID {
		http.Error(w, "Invalid target conversation ID", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// Move all messages from source to target
	_, err := h.DB.Pool.Exec(ctx,
		"UPDATE messages SET conversation_id = $1 WHERE conversation_id = $2",
		payload.TargetID, sourceID)
	if err != nil {
		http.Error(w, "Failed to move messages", http.StatusInternalServerError)
		return
	}

	// Mark source as resolved with merged_into_id if the column exists (graceful fallback if not)
	_, _ = h.DB.Pool.Exec(ctx,
		"UPDATE conversations SET status = 'resolved', merged_into_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
		payload.TargetID, sourceID)

	// Update target conversation timestamp
	_, _ = h.DB.Pool.Exec(ctx,
		"UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
		payload.TargetID)

	// Return the updated target conversation
	target, err := h.loadConversationSnapshot(ctx, payload.TargetID)
	if err != nil {
		http.Error(w, "Failed to load merged conversation", http.StatusInternalServerError)
		return
	}
	h.broadcastConversationSnapshot(ctx, payload.TargetID)
	h.broadcastConversationSnapshot(ctx, sourceID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":      "Conversations merged successfully",
		"conversation": target,
	})
}
