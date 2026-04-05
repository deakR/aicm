package handlers

import "testing"

func TestTokenizeAnalyticsTextNormalizesSupportTerms(t *testing.T) {
	tokens := tokenizeAnalyticsText("I was charged twice and my refunds are still pending on the invoices")
	expected := map[string]bool{
		"charge":  true,
		"refund":  true,
		"pend":    true,
		"invoice": true,
	}
	for token := range expected {
		found := false
		for _, current := range tokens {
			if current == token {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("expected token %q in %v", token, tokens)
		}
	}
}

func TestClusterTopicsFromTextsGroupsRelatedMessages(t *testing.T) {
	inputs := []string{
		"I need a refund for a double charge on my invoice",
		"My invoice still shows the wrong charge amount",
		"Can you track my package shipment please",
		"Shipping is delayed and tracking has not updated",
		"I cannot reset my password or access my account",
	}

	topics := clusterTopicsFromTexts(inputs, 6)
	if len(topics) < 3 {
		t.Fatalf("expected at least 3 topic clusters, got %v", topics)
	}

	hasBilling := false
	hasShipping := false
	hasAccount := false
	for _, topic := range topics {
		switch topic.Topic {
		case "Billing & Payments":
			hasBilling = true
			if topic.Count < 2 {
				t.Fatalf("expected billing cluster to combine related messages, got %d", topic.Count)
			}
		case "Shipping & Delivery":
			hasShipping = true
		case "Account & Access":
			hasAccount = true
		}
	}

	if !hasBilling || !hasShipping || !hasAccount {
		t.Fatalf("expected billing, shipping, and account clusters in %v", topics)
	}
}
