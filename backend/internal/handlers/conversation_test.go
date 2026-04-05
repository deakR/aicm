package handlers

import "testing"

func TestClassifyConfidence(t *testing.T) {
	tests := []struct {
		name  string
		score float64
		want  string
	}{
		{name: "high threshold", score: 0.75, want: "high"},
		{name: "medium threshold", score: 0.5, want: "medium"},
		{name: "low positive", score: 0.2, want: "low"},
		{name: "none", score: 0, want: "none"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := classifyConfidence(tt.score); got != tt.want {
				t.Fatalf("classifyConfidence(%v) = %q, want %q", tt.score, got, tt.want)
			}
		})
	}
}

func TestClampScore(t *testing.T) {
	tests := []struct {
		input float64
		want  float64
	}{
		{input: -0.2, want: 0},
		{input: 0.42, want: 0.42},
		{input: 1.7, want: 1},
	}

	for _, tt := range tests {
		if got := clampScore(tt.input); got != tt.want {
			t.Fatalf("clampScore(%v) = %v, want %v", tt.input, got, tt.want)
		}
	}
}

func TestTokenizeSearchText(t *testing.T) {
	got := tokenizeSearchText("How do I reset my password, and why is the email late?")

	wantContains := map[string]bool{
		"reset":    true,
		"password": true,
		"email":    true,
		"late":     true,
	}
	wantMissing := map[string]bool{
		"how": true,
		"do":  true,
		"i":   true,
		"my":  true,
		"and": true,
		"the": true,
		"is":  true,
	}

	tokenSet := make(map[string]bool, len(got))
	for _, token := range got {
		tokenSet[token] = true
	}

	for token := range wantContains {
		if !tokenSet[token] {
			t.Fatalf("expected token %q to be present in %v", token, got)
		}
	}
	for token := range wantMissing {
		if tokenSet[token] {
			t.Fatalf("expected stop-word %q to be removed from %v", token, got)
		}
	}
}

func TestScoreArticleMatch(t *testing.T) {
	match := scoreArticleMatch(
		"I still have a duplicate charge on my statement after five days",
		"Billing and Duplicate Charges",
		"Pending duplicate charges usually disappear in 3 to 5 business days unless both charges fully settle.",
	)

	if match.Score <= 0 {
		t.Fatalf("expected a positive score, got %d", match.Score)
	}
	if match.SourceMode != "keyword" {
		t.Fatalf("expected keyword source mode, got %q", match.SourceMode)
	}
	if match.ConfidenceScore <= 0 {
		t.Fatalf("expected positive confidence score, got %v", match.ConfidenceScore)
	}
	if match.ConfidenceLabel == "none" || match.ConfidenceLabel == "unknown" {
		t.Fatalf("expected meaningful confidence label, got %q", match.ConfidenceLabel)
	}
	if match.UniqueMatches < 2 {
		t.Fatalf("expected at least two unique matches, got %d", match.UniqueMatches)
	}
}

func TestScoreArticleMatchNoUsefulTokens(t *testing.T) {
	match := scoreArticleMatch("and the if", "Refund Policy", "Refunds are available within 30 days.")
	if match.Score != 0 {
		t.Fatalf("expected zero score for stop-word-only query, got %d", match.Score)
	}
}
