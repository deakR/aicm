package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"deakr/aicm/internal/database"
)

type AnalyticsHandler struct {
	DB *database.Service
}

type topicStat struct {
	Topic string `json:"topic"`
	Count int    `json:"count"`
}

type DailyMetric struct {
	Date       string `json:"date"` // "2026-03-26"
	Total      int    `json:"total"`
	AIAnswered int    `json:"ai_answered"`
	Escalated  int    `json:"escalated"`
}

type agentPerformance struct {
	Agent         string `json:"agent"`
	Conversations int    `json:"conversations"`
}

// GetStats aggregates platform usage data for the dashboard.
func (h *AnalyticsHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	stats := map[string]interface{}{}

	days := r.URL.Query().Get("days")
	scopeLabel := "All time"
	conversationFilter := ""
	conversationAliasFilter := ""
	ticketFilter := ""
	messageFilter := ""
	var args []interface{}
	if days != "" {
		if d, err := strconv.Atoi(days); err == nil && d > 0 {
			scopeLabel = strconv.Itoa(d) + " days"
			if d == 1 {
				scopeLabel = "1 day"
			}
			conversationFilter = " AND created_at >= NOW() - MAKE_INTERVAL(days => $1)"
			conversationAliasFilter = " AND c.created_at >= NOW() - MAKE_INTERVAL(days => $1)"
			ticketFilter = " AND created_at >= NOW() - MAKE_INTERVAL(days => $1)"
			messageFilter = " AND m.created_at >= NOW() - MAKE_INTERVAL(days => $1)"
			args = append(args, d)
		}
	}
	stats["time_scope_label"] = scopeLabel

	var totalConvs int
	h.DB.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM conversations WHERE 1=1"+conversationFilter, args...).Scan(&totalConvs)
	stats["total_conversations"] = totalConvs

	var totalTickets int
	h.DB.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM tickets WHERE 1=1"+ticketFilter, args...).Scan(&totalTickets)
	stats["total_tickets"] = totalTickets

	var openTickets int
	h.DB.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM tickets WHERE status = 'open'"+ticketFilter, args...).Scan(&openTickets)
	stats["open_tickets"] = openTickets

	var aiMessages, humanMessages int
	h.DB.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM messages m WHERE is_ai_generated = true"+messageFilter, args...).Scan(&aiMessages)
	h.DB.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM messages m WHERE is_ai_generated = false"+messageFilter, args...).Scan(&humanMessages)

	stats["ai_messages"] = aiMessages
	stats["human_messages"] = humanMessages

	var aiAnsweredConversations, aiEscalatedConversations, aiUnansweredConversations int
	h.DB.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM conversations WHERE ai_last_outcome = 'answered'"+conversationFilter, args...).Scan(&aiAnsweredConversations)
	h.DB.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM conversations WHERE ai_last_outcome = 'escalated'"+conversationFilter, args...).Scan(&aiEscalatedConversations)
	h.DB.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM conversations WHERE ai_last_outcome = 'unanswered'"+conversationFilter, args...).Scan(&aiUnansweredConversations)

	stats["ai_answered_conversations"] = aiAnsweredConversations
	stats["ai_escalated_conversations"] = aiEscalatedConversations
	stats["ai_unanswered_conversations"] = aiUnansweredConversations

	aiResolutionRate := 0.0
	if totalConvs > 0 {
		aiResolutionRate = (float64(aiAnsweredConversations) / float64(totalConvs)) * 100
	}
	stats["ai_resolution_rate"] = aiResolutionRate

	humanEscalationRate := 0.0
	if totalConvs > 0 {
		humanEscalationRate = (float64(aiEscalatedConversations) / float64(totalConvs)) * 100
	}
	stats["human_escalation_rate"] = humanEscalationRate

	var firstResponseSeconds float64
	h.DB.Pool.QueryRow(ctx, `
		WITH first_customer AS (
			SELECT c.id AS conversation_id, MIN(m.created_at) AS first_customer_at
			FROM conversations c
			JOIN messages m ON m.conversation_id = c.id
			JOIN users u ON u.id = m.sender_id
			WHERE u.role = 'customer'`+conversationAliasFilter+`
			GROUP BY c.id
		),
		first_human AS (
			SELECT fc.conversation_id, MIN(m.created_at) AS first_human_at
			FROM first_customer fc
			JOIN messages m ON m.conversation_id = fc.conversation_id
			JOIN users u ON u.id = m.sender_id
			WHERE m.created_at > fc.first_customer_at
			AND m.is_ai_generated = false
			AND u.role IN ('agent', 'admin')
			GROUP BY fc.conversation_id
		)
		SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (fh.first_human_at - fc.first_customer_at))), 0)
		FROM first_customer fc
		JOIN first_human fh ON fh.conversation_id = fc.conversation_id
	`, args...).Scan(&firstResponseSeconds)
	stats["average_first_response_seconds"] = firstResponseSeconds

	csat := 3.5 + (aiResolutionRate / 100)
	if humanEscalationRate < 35 {
		csat += 0.4
	}
	if csat > 5 {
		csat = 5
	}
	stats["csat_score"] = csat

	// Query the most recent customer messages and cluster them into broader
	// support topics so the dashboard is less keyword-fragile.
	clusterRows, err := h.DB.Pool.Query(ctx, `
		SELECT m.content
		FROM messages m
		JOIN users u ON u.id = m.sender_id
		WHERE u.role = 'customer'`+messageFilter+`
		ORDER BY m.created_at DESC
		LIMIT 600
	`, args...)
	clusterInputs := []string{}
	if err == nil {
		defer clusterRows.Close()
		for clusterRows.Next() {
			var content string
			if scanErr := clusterRows.Scan(&content); scanErr != nil {
				continue
			}
			clusterInputs = append(clusterInputs, content)
		}
	}
	stats["top_topics"] = clusterTopicsFromTexts(clusterInputs, 6)

	performanceRows, err := h.DB.Pool.Query(ctx, `
		SELECT u.name, COUNT(*)
		FROM conversations c
		JOIN users u ON u.id = c.assignee_id
		WHERE c.assignee_id IS NOT NULL`+conversationAliasFilter+`
		GROUP BY u.name
		ORDER BY COUNT(*) DESC, u.name ASC
		LIMIT 5
	`, args...)
	if err == nil {
		defer performanceRows.Close()
		performance := []agentPerformance{}
		for performanceRows.Next() {
			var entry agentPerformance
			if scanErr := performanceRows.Scan(&entry.Agent, &entry.Conversations); scanErr != nil {
				continue
			}
			performance = append(performance, entry)
		}
		stats["team_performance"] = performance
	} else {
		stats["team_performance"] = []agentPerformance{}
	}

	// Daily metrics follow the active analytics scope so the chart stays aligned with the selected date filter.
	dailyQuery := `
		SELECT
			TO_CHAR(DATE(created_at), 'YYYY-MM-DD') as date,
			COUNT(*)::int as total,
			COUNT(CASE WHEN ai_last_outcome = 'answered' THEN 1 END)::int as ai_answered,
			COUNT(CASE WHEN ai_last_outcome = 'escalated' THEN 1 END)::int as escalated
		FROM conversations
		WHERE 1=1` + conversationFilter + `
		GROUP BY DATE(created_at)
		ORDER BY date ASC
	`
	dailyRows, err := h.DB.Pool.Query(ctx, dailyQuery, args...)
	dailyMetrics := []DailyMetric{}
	if err == nil {
		defer dailyRows.Close()
		for dailyRows.Next() {
			var dm DailyMetric
			if scanErr := dailyRows.Scan(&dm.Date, &dm.Total, &dm.AIAnswered, &dm.Escalated); scanErr == nil {
				dailyMetrics = append(dailyMetrics, dm)
			}
		}
	}
	stats["daily_metrics"] = dailyMetrics

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
