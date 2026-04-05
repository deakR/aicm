package models

import (
	"encoding/json"
	"time"
)

// WorkflowCondition represents a single condition in a multi-condition workflow rule.
type WorkflowCondition struct {
	Type     string `json:"type"`               // "message_contains", "customer_attribute", "status_equals"
	Field    string `json:"field,omitempty"`    // for customer_attribute: attribute key
	Operator string `json:"operator,omitempty"` // "contains", "equals", "not_equals"
	Value    string `json:"value"`
}

type Workflow struct {
	ID               string              `json:"id"`
	Name             string              `json:"name"`
	TriggerType      string              `json:"trigger_type"`
	TriggerCondition string              `json:"trigger_condition"`
	Conditions       []WorkflowCondition `json:"conditions,omitempty"`
	ConditionLogic   string              `json:"condition_logic"`
	ActionType       string              `json:"action_type"`
	ActionPayload    string              `json:"action_payload"`
	IsActive         bool                `json:"is_active"`
	CreatedAt        time.Time           `json:"created_at"`
}

// ConditionsToJSON marshals conditions to JSON for DB storage.
func ConditionsToJSON(conditions []WorkflowCondition) ([]byte, error) {
	if len(conditions) == 0 {
		return nil, nil
	}
	return json.Marshal(conditions)
}

// ParseConditions unmarshals conditions from DB JSON.
func ParseConditions(data []byte) []WorkflowCondition {
	if len(data) == 0 {
		return nil
	}
	var conditions []WorkflowCondition
	if err := json.Unmarshal(data, &conditions); err != nil {
		return nil
	}
	return conditions
}

type WorkflowLog struct {
	ID             string    `json:"id"`
	WorkflowID     string    `json:"workflow_id"`
	ConversationID string    `json:"conversation_id"`
	ExecutedAt     time.Time `json:"executed_at"`
	WorkflowName   string    `json:"workflow_name,omitempty"`
}
