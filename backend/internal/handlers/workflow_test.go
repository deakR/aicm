package handlers

import (
	"testing"

	"deakr/aicm/internal/models"
)

func TestEvaluateConditionsAND(t *testing.T) {
	handler := &WorkflowHandler{}
	conditions := []models.WorkflowCondition{
		{Type: "message_contains", Value: "refund"},
		{Type: "customer_attribute", Field: "plan", Operator: "equals", Value: "vip"},
	}

	got := handler.evaluateConditions(
		conditions,
		"and",
		"message_contains",
		"Can you help with my refund status?",
		map[string]string{"plan": "VIP"},
	)

	if !got {
		t.Fatalf("expected AND conditions to match")
	}
}

func TestEvaluateConditionsOR(t *testing.T) {
	handler := &WorkflowHandler{}
	conditions := []models.WorkflowCondition{
		{Type: "message_contains", Value: "refund"},
		{Type: "customer_attribute", Field: "tier", Operator: "equals", Value: "priority"},
	}

	got := handler.evaluateConditions(
		conditions,
		"or",
		"message_contains",
		"I need to update my shipping address",
		map[string]string{"tier": "priority"},
	)

	if !got {
		t.Fatalf("expected OR conditions to match when one branch is true")
	}
}

func TestEvaluateConditionsCustomerAttributeContains(t *testing.T) {
	handler := &WorkflowHandler{}
	conditions := []models.WorkflowCondition{
		{Type: "customer_attribute", Field: "notes", Operator: "contains", Value: "chargeback"},
	}

	got := handler.evaluateConditions(
		conditions,
		"and",
		"new_conversation",
		"",
		map[string]string{"notes": "previous chargeback review completed"},
	)

	if !got {
		t.Fatalf("expected contains operator to match customer attribute")
	}
}

func TestEvaluateConditionsMissingAttributeDoesNotMatch(t *testing.T) {
	handler := &WorkflowHandler{}
	conditions := []models.WorkflowCondition{
		{Type: "customer_attribute", Field: "plan", Operator: "equals", Value: "vip"},
	}

	got := handler.evaluateConditions(
		conditions,
		"and",
		"new_conversation",
		"",
		map[string]string{},
	)

	if got {
		t.Fatalf("expected missing customer attribute to fail the condition")
	}
}

func TestEvaluateConditionsMessageContainsRequiresMatchingEvent(t *testing.T) {
	handler := &WorkflowHandler{}
	conditions := []models.WorkflowCondition{
		{Type: "message_contains", Value: "refund"},
	}

	got := handler.evaluateConditions(
		conditions,
		"and",
		"new_conversation",
		"Can I get a refund?",
		map[string]string{},
	)

	if got {
		t.Fatalf("expected message_contains to fail outside a message_contains event")
	}
}
