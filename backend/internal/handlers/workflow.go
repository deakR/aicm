package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"deakr/aicm/internal/database"
	"deakr/aicm/internal/models"
	"deakr/aicm/internal/ws"

	"github.com/go-chi/chi/v5"
)

type WorkflowHandler struct {
	DB *database.Service
}

// CreateWorkflow saves a new automation rule.
func (h *WorkflowHandler) CreateWorkflow(w http.ResponseWriter, r *http.Request) {
	_, role, ok := requestIdentity(r)
	if !ok || (role != "agent" && role != "admin") {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var wf models.Workflow
	if err := json.NewDecoder(r.Body).Decode(&wf); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	wf.Name = strings.TrimSpace(wf.Name)
	wf.TriggerType = strings.TrimSpace(wf.TriggerType)
	wf.TriggerCondition = strings.TrimSpace(wf.TriggerCondition)
	wf.ActionType = strings.TrimSpace(wf.ActionType)
	wf.ActionPayload = strings.TrimSpace(wf.ActionPayload)

	// Only require trigger_condition if no conditions array provided
	hasConditions := len(wf.Conditions) > 0
	if wf.Name == "" || wf.TriggerType == "" || wf.ActionType == "" {
		http.Error(w, "Missing required workflow fields", http.StatusBadRequest)
		return
	}
	if !hasConditions && wf.TriggerType != "new_conversation" && wf.TriggerType != "time_elapsed" && wf.TriggerCondition == "" {
		http.Error(w, "Missing trigger condition", http.StatusBadRequest)
		return
	}
	if wf.ActionType != "escalate_to_human" && wf.ActionPayload == "" {
		http.Error(w, "Missing action payload", http.StatusBadRequest)
		return
	}

	var condJSON []byte
	if hasConditions {
		var err error
		condJSON, err = models.ConditionsToJSON(wf.Conditions)
		if err != nil {
			http.Error(w, "Failed to encode conditions", http.StatusInternalServerError)
			return
		}
	}

	condLogic := strings.TrimSpace(wf.ConditionLogic)
	if condLogic == "" {
		condLogic = "and"
	}

	query := `
		INSERT INTO workflows (name, trigger_type, trigger_condition, conditions, condition_logic, action_type, action_payload, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at
	`
	err := h.DB.Pool.QueryRow(
		context.Background(),
		query,
		wf.Name,
		wf.TriggerType,
		wf.TriggerCondition,
		condJSON,
		condLogic,
		wf.ActionType,
		wf.ActionPayload,
		true,
	).Scan(&wf.ID, &wf.CreatedAt)
	if err != nil {
		http.Error(w, "Failed to create workflow", http.StatusInternalServerError)
		return
	}
	wf.IsActive = true
	wf.Conditions = models.ParseConditions(condJSON)
	wf.ConditionLogic = condLogic

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(wf)
}

// ListWorkflows returns all rules.
func (h *WorkflowHandler) ListWorkflows(w http.ResponseWriter, r *http.Request) {
	_, role, ok := requestIdentity(r)
	if !ok || (role != "agent" && role != "admin") {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	limit, offset := parsePagination(r, 50, 200)

	rows, err := h.DB.Pool.Query(context.Background(),
		`SELECT id, name, trigger_type, trigger_condition, action_type, action_payload, is_active, created_at, conditions, condition_logic
		 FROM workflows ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
		limit,
		offset,
	)
	if err != nil {
		http.Error(w, "Failed to fetch workflows", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var workflows []models.Workflow
	for rows.Next() {
		var wf models.Workflow
		var conditionsRaw []byte
		var conditionLogic *string
		if err := rows.Scan(
			&wf.ID, &wf.Name, &wf.TriggerType, &wf.TriggerCondition,
			&wf.ActionType, &wf.ActionPayload, &wf.IsActive, &wf.CreatedAt,
			&conditionsRaw, &conditionLogic,
		); err != nil {
			http.Error(w, "Error parsing workflows", http.StatusInternalServerError)
			return
		}
		wf.Conditions = models.ParseConditions(conditionsRaw)
		if conditionLogic != nil {
			wf.ConditionLogic = *conditionLogic
		} else {
			wf.ConditionLogic = "and"
		}
		workflows = append(workflows, wf)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, "Failed to stream workflows", http.StatusInternalServerError)
		return
	}

	if workflows == nil {
		workflows = []models.Workflow{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(workflows)
}

// ListWorkflowLogs returns the most recent workflow executions.
func (h *WorkflowHandler) ListWorkflowLogs(w http.ResponseWriter, r *http.Request) {
	_, role, ok := requestIdentity(r)
	if !ok || (role != "agent" && role != "admin") {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	limit := 10
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	rows, err := h.DB.Pool.Query(
		context.Background(),
		`SELECT wl.id, wl.workflow_id, wl.conversation_id, wl.executed_at, w.name
		 FROM workflow_logs wl
		 JOIN workflows w ON w.id = wl.workflow_id
		 ORDER BY wl.executed_at DESC
		 LIMIT $1`,
		limit,
	)
	if err != nil {
		http.Error(w, "Failed to fetch workflow logs", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var logs []models.WorkflowLog
	for rows.Next() {
		var wfLog models.WorkflowLog
		if err := rows.Scan(&wfLog.ID, &wfLog.WorkflowID, &wfLog.ConversationID, &wfLog.ExecutedAt, &wfLog.WorkflowName); err != nil {
			http.Error(w, "Error parsing workflow logs", http.StatusInternalServerError)
			return
		}
		logs = append(logs, wfLog)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, "Failed to stream workflow logs", http.StatusInternalServerError)
		return
	}

	if logs == nil {
		logs = []models.WorkflowLog{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}

// UpdateWorkflow toggles a workflow's active status.
func (h *WorkflowHandler) UpdateWorkflow(w http.ResponseWriter, r *http.Request) {
	workflowID := chi.URLParam(r, "id")
	_, role, ok := requestIdentity(r)
	if !ok || (role != "agent" && role != "admin") {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var payload struct {
		IsActive bool `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	query := `UPDATE workflows SET is_active = $1 WHERE id = $2`
	_, err := h.DB.Pool.Exec(context.Background(), query, payload.IsActive, workflowID)
	if err != nil {
		http.Error(w, "Failed to update workflow", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "Workflow updated"}`))
}

// EvaluateMessage checks active workflows against incoming customer message.
func (h *WorkflowHandler) EvaluateMessage(ctx context.Context, conversationID string, messageContent string) {
	h.evaluateWorkflows(ctx, conversationID, "message_contains", messageContent)
}

// EvaluateNewConversation fires workflows with trigger_type = 'new_conversation'.
func (h *WorkflowHandler) EvaluateNewConversation(ctx context.Context, conversationID string) {
	h.evaluateWorkflows(ctx, conversationID, "new_conversation", "")
}

// evaluateWorkflows is the shared engine for matching and executing workflow rules.
func (h *WorkflowHandler) evaluateWorkflows(ctx context.Context, conversationID string, eventType string, messageContent string) {
	rows, err := h.DB.Pool.Query(ctx,
		`SELECT id, trigger_type, trigger_condition, action_type, action_payload, conditions, condition_logic
		 FROM workflows WHERE is_active = true`)
	if err != nil {
		log.Printf("workflow evaluation query failed for conversation %s: %v", conversationID, err)
		return
	}
	defer rows.Close()

	contentLower := strings.ToLower(messageContent)

	for rows.Next() {
		var id, tType, tCond, aType, aPayload string
		var conditionsRaw []byte
		var conditionLogic *string
		if err := rows.Scan(&id, &tType, &tCond, &aType, &aPayload, &conditionsRaw, &conditionLogic); err != nil {
			continue
		}

		conditions := models.ParseConditions(conditionsRaw)

		logic := "and"
		if conditionLogic != nil {
			logic = *conditionLogic
		}

		matched := false
		if len(conditions) > 0 {
			// Multi-condition path
			customerAttrs := h.loadCustomerAttrs(ctx, conversationID)
			matched = h.evaluateConditions(conditions, logic, eventType, messageContent, customerAttrs)
		} else {
			// Legacy single-condition path
			switch tType {
			case "message_contains":
				if eventType == "message_contains" && strings.Contains(contentLower, strings.ToLower(tCond)) {
					matched = true
				}
			case "new_conversation":
				if eventType == "new_conversation" {
					matched = true
				}
			}
		}

		if matched {
			fmt.Printf("Workflow Engine: Rule '%s' matched on conversation %s (event: %s)\n", id, conversationID, eventType)
			if err := h.executeAction(ctx, conversationID, aType, aPayload); err != nil {
				log.Printf("workflow action failed (workflow=%s conversation=%s action=%s): %v", id, conversationID, aType, err)
			}
			h.recordWorkflowExecution(ctx, id, conversationID)
		}
	}
	if err := rows.Err(); err != nil {
		log.Printf("workflow evaluation stream failed for conversation %s: %v", conversationID, err)
	}
}

// evaluateConditions evaluates a set of conditions using AND/OR logic.
func (h *WorkflowHandler) evaluateConditions(conditions []models.WorkflowCondition, logic string, eventType string, messageContent string, customerAttrs map[string]string) bool {
	if len(conditions) == 0 {
		return false
	}

	results := make([]bool, len(conditions))
	for i, cond := range conditions {
		switch cond.Type {
		case "message_contains":
			results[i] = eventType == "message_contains" &&
				strings.Contains(strings.ToLower(messageContent), strings.ToLower(cond.Value))
		case "customer_attribute":
			if v, ok := customerAttrs[cond.Field]; ok {
				switch cond.Operator {
				case "equals":
					results[i] = strings.EqualFold(v, cond.Value)
				case "not_equals":
					results[i] = !strings.EqualFold(v, cond.Value)
				case "contains":
					results[i] = strings.Contains(strings.ToLower(v), strings.ToLower(cond.Value))
				default:
					results[i] = false
				}
			}
		case "status_equals":
			results[i] = strings.EqualFold(customerAttrs["status"], cond.Value)
		default:
			results[i] = false
		}
	}

	if strings.ToLower(logic) == "or" {
		for _, r := range results {
			if r {
				return true
			}
		}
		return false
	}
	// Default: AND logic
	for _, r := range results {
		if !r {
			return false
		}
	}
	return true
}

// loadCustomerAttrs fetches the customer's custom_attributes and conversation status
// for use in multi-condition evaluation.
func (h *WorkflowHandler) loadCustomerAttrs(ctx context.Context, conversationID string) map[string]string {
	attrs := make(map[string]string)
	var attrsRaw []byte
	var convStatus string
	err := h.DB.Pool.QueryRow(ctx, `
		SELECT u.custom_attributes, c.status
		FROM conversations c
		JOIN users u ON u.id = c.customer_id
		WHERE c.id = $1
	`, conversationID).Scan(&attrsRaw, &convStatus)
	if err != nil {
		return attrs
	}
	attrs["status"] = convStatus
	if len(attrsRaw) > 0 {
		var raw map[string]interface{}
		if err := json.Unmarshal(attrsRaw, &raw); err == nil {
			for k, v := range raw {
				if sv, ok := v.(string); ok {
					attrs[k] = sv
				}
			}
		}
	}
	return attrs
}

// StartScheduler starts the background time-based workflow evaluation loop.
func (h *WorkflowHandler) StartScheduler(ctx context.Context) {
	ticker := time.NewTicker(2 * time.Minute)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				h.runTimedWorkflows(context.Background())
			case <-ctx.Done():
				return
			}
		}
	}()
	log.Println("Workflow scheduler started (2-minute tick)")
}

// runTimedWorkflows fires time_elapsed workflows on stale open conversations.
func (h *WorkflowHandler) runTimedWorkflows(ctx context.Context) {
	rows, err := h.DB.Pool.Query(ctx,
		`SELECT id, trigger_condition, action_type, action_payload FROM workflows
		 WHERE is_active = true AND trigger_type = 'time_elapsed'`)
	if err != nil {
		log.Printf("timed workflow query failed: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id, tCond, aType, aPayload string
		if err := rows.Scan(&id, &tCond, &aType, &aPayload); err != nil {
			log.Printf("failed scanning timed workflow row: %v", err)
			continue
		}

		hours, err := strconv.ParseFloat(strings.TrimSpace(tCond), 64)
		if err != nil || hours <= 0 {
			continue
		}

		// Find open/pending conversations not updated in X hours, and not yet fired today for this workflow
		convRows, err := h.DB.Pool.Query(ctx, `
			SELECT c.id FROM conversations c
			WHERE c.status IN ('open', 'pending')
			AND c.updated_at < NOW() - ($1 * INTERVAL '1 hour')
			AND NOT EXISTS (
				SELECT 1 FROM workflow_logs wl
				WHERE wl.workflow_id = $2
				AND wl.conversation_id = c.id
				AND wl.executed_at > NOW() - INTERVAL '24 hours'
			)
			LIMIT 20
		`, hours, id)
		if err != nil {
			log.Printf("failed loading timed workflow conversations for workflow %s: %v", id, err)
			continue
		}

		var convIDs []string
		for convRows.Next() {
			var cid string
			if scanErr := convRows.Scan(&cid); scanErr != nil {
				log.Printf("failed scanning timed workflow conversation row for workflow %s: %v", id, scanErr)
				continue
			}
			convIDs = append(convIDs, cid)
		}
		if err := convRows.Err(); err != nil {
			log.Printf("timed workflow conversation stream failed for workflow %s: %v", id, err)
		}
		convRows.Close()

		for _, cid := range convIDs {
			log.Printf("Time-elapsed workflow %s firing on conversation %s\n", id, cid)
			if err := h.executeAction(ctx, cid, aType, aPayload); err != nil {
				log.Printf("timed workflow action failed (workflow=%s conversation=%s action=%s): %v", id, cid, aType, err)
			}
			h.recordWorkflowExecution(ctx, id, cid)
		}
	}
	if err := rows.Err(); err != nil {
		log.Printf("timed workflow stream failed: %v", err)
	}
}

// executeAction runs the workflow action.
func (h *WorkflowHandler) executeAction(ctx context.Context, conversationID string, actionType string, actionPayload string) error {
	switch actionType {
	case "assign_agent":
		if _, err := h.DB.Pool.Exec(ctx, "UPDATE conversations SET assignee_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", actionPayload, conversationID); err != nil {
			return fmt.Errorf("assign_agent failed: %w", err)
		}
		h.broadcastConversationUpdate(ctx, conversationID)
		return nil

	case "auto_reply":
		var botID string
		query := `
			INSERT INTO users (role, name, email, password_hash)
			VALUES ('admin', 'Automation Bot', 'bot@local.system', '')
			ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
			RETURNING id
		`
		if err := h.DB.Pool.QueryRow(ctx, query).Scan(&botID); err != nil {
			return fmt.Errorf("auto_reply bot upsert failed: %w", err)
		}

		var msg models.Message
		err := h.DB.Pool.QueryRow(ctx,
			"INSERT INTO messages (conversation_id, sender_id, content, is_ai_generated) VALUES ($1, $2, $3, false) RETURNING id, created_at",
			conversationID, botID, actionPayload,
		).Scan(&msg.ID, &msg.CreatedAt)
		if err != nil {
			return fmt.Errorf("auto_reply message insert failed: %w", err)
		}

		msg.ConversationID = conversationID
		msg.SenderID = botID
		msg.SenderRole = "admin"
		msg.Content = actionPayload
		msg.SenderName = "Automation Bot"
		ws.Broadcast(conversationID, msg)
		h.broadcastConversationUpdate(ctx, conversationID)
		return nil

	case "add_tag":
		tag := strings.ToLower(strings.TrimSpace(actionPayload))
		if tag != "" {
			if _, err := h.DB.Pool.Exec(ctx, `
				UPDATE conversations
				SET tags = ARRAY(
					SELECT DISTINCT tag_value
					FROM UNNEST(COALESCE(tags, ARRAY[]::TEXT[]) || ARRAY[$1]::TEXT[]) AS tag_value
					ORDER BY tag_value
				),
				    updated_at = CURRENT_TIMESTAMP
				WHERE id = $2
			`, tag, conversationID); err != nil {
				return fmt.Errorf("add_tag failed: %w", err)
			}
			h.broadcastConversationUpdate(ctx, conversationID)
		}
		return nil

	case "change_status":
		allowed := map[string]bool{"open": true, "pending": true, "resolved": true, "snoozed": true}
		if allowed[actionPayload] {
			if _, err := h.DB.Pool.Exec(ctx, "UPDATE conversations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", actionPayload, conversationID); err != nil {
				return fmt.Errorf("change_status failed: %w", err)
			}
			h.broadcastConversationUpdate(ctx, conversationID)
			return nil
		}
		return fmt.Errorf("change_status received invalid payload %q", actionPayload)

	case "escalate_to_human":
		// Unassign AI / mark as needing human (set assignee to nil) and add escalation tag
		if _, err := h.DB.Pool.Exec(ctx, `
			UPDATE conversations
			SET tags = ARRAY(
				SELECT DISTINCT tag_value
				FROM UNNEST(COALESCE(tags, ARRAY[]::TEXT[]) || ARRAY['needs-human']::TEXT[]) AS tag_value
				ORDER BY tag_value
			),
			    assignee_id = NULL,
			    status = 'open',
			    updated_at = CURRENT_TIMESTAMP
			WHERE id = $1
		`, conversationID); err != nil {
			return fmt.Errorf("escalate_to_human failed: %w", err)
		}
		h.broadcastConversationUpdate(ctx, conversationID)
		return nil
	}

	return fmt.Errorf("unsupported workflow action type %q", actionType)
}

func (h *WorkflowHandler) recordWorkflowExecution(ctx context.Context, workflowID string, conversationID string) {
	if _, err := h.DB.Pool.Exec(ctx, "INSERT INTO workflow_logs (workflow_id, conversation_id) VALUES ($1, $2)", workflowID, conversationID); err != nil {
		log.Printf("failed to record workflow execution (workflow=%s conversation=%s): %v", workflowID, conversationID, err)
	}
}

func (h *WorkflowHandler) broadcastConversationUpdate(ctx context.Context, conversationID string) {
	conversationHandler := &ConversationHandler{DB: h.DB}
	conversation, err := conversationHandler.loadConversationSnapshot(ctx, conversationID)
	if err != nil {
		return
	}

	ws.Broadcast(conversationID, map[string]interface{}{
		"type":    "conversation_update",
		"payload": conversation,
	})
	ws.BroadcastSupport(map[string]interface{}{
		"type":    "conversation_update",
		"payload": conversation,
	})
}
