package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"deakr/aicm/internal/ws"
)

func setFrontendOriginForTest(t *testing.T, value *string) {
	t.Helper()
	old, had := os.LookupEnv("FRONTEND_ORIGIN")

	if value == nil {
		if err := os.Unsetenv("FRONTEND_ORIGIN"); err != nil {
			t.Fatalf("failed clearing FRONTEND_ORIGIN for test: %v", err)
		}
	} else {
		if err := os.Setenv("FRONTEND_ORIGIN", *value); err != nil {
			t.Fatalf("failed setting FRONTEND_ORIGIN for test: %v", err)
		}
	}

	t.Cleanup(func() {
		if !had {
			_ = os.Unsetenv("FRONTEND_ORIGIN")
			return
		}
		_ = os.Setenv("FRONTEND_ORIGIN", old)
	})
}

func TestWSCanAccessSupportInboxChannel(t *testing.T) {
	allowed, err := wsCanAccessConversation(nil, context.Background(), ws.SupportInboxChannel, "user-1", "agent")
	if err != nil {
		t.Fatalf("expected nil error for agent support inbox access, got %v", err)
	}
	if !allowed {
		t.Fatal("expected agent to access support inbox channel")
	}

	allowed, err = wsCanAccessConversation(nil, context.Background(), ws.SupportInboxChannel, "user-2", "admin")
	if err != nil {
		t.Fatalf("expected nil error for admin support inbox access, got %v", err)
	}
	if !allowed {
		t.Fatal("expected admin to access support inbox channel")
	}

	allowed, err = wsCanAccessConversation(nil, context.Background(), ws.SupportInboxChannel, "user-3", "customer")
	if err != nil {
		t.Fatalf("expected nil error for customer support inbox access check, got %v", err)
	}
	if allowed {
		t.Fatal("expected customer to be denied support inbox channel access")
	}

	allowed, err = wsCanAccessConversation(nil, context.Background(), ws.SupportInboxChannel, "user-4", "viewer")
	if err != nil {
		t.Fatalf("expected nil error for unsupported role support inbox access check, got %v", err)
	}
	if allowed {
		t.Fatal("expected unsupported role to be denied support inbox channel access")
	}
}

func TestWSCanAccessConversationRoleShortCircuit(t *testing.T) {
	allowed, err := wsCanAccessConversation(nil, context.Background(), "conv-1", "user-1", "agent")
	if err != nil {
		t.Fatalf("expected nil error for agent conversation access, got %v", err)
	}
	if !allowed {
		t.Fatal("expected agent to access conversation without DB lookup")
	}

	allowed, err = wsCanAccessConversation(nil, context.Background(), "conv-1", "user-2", "admin")
	if err != nil {
		t.Fatalf("expected nil error for admin conversation access, got %v", err)
	}
	if !allowed {
		t.Fatal("expected admin to access conversation without DB lookup")
	}

	allowed, err = wsCanAccessConversation(nil, context.Background(), "conv-1", "user-3", "viewer")
	if err != nil {
		t.Fatalf("expected nil error for unsupported role conversation access check, got %v", err)
	}
	if allowed {
		t.Fatal("expected unsupported role to be denied conversation access")
	}
}

func TestWebSocketUpgraderCheckOriginPolicy(t *testing.T) {
	defaultOrigin := "http://localhost:7200"
	configuredOrigin := "https://app.example.com"

	t.Run("allows empty origin", func(t *testing.T) {
		setFrontendOriginForTest(t, nil)
		req := httptest.NewRequest(http.MethodGet, "/api/ws/conv-1", nil)
		if !upgrader.CheckOrigin(req) {
			t.Fatal("expected upgrader to allow requests without an Origin header")
		}
	})

	t.Run("uses default origin when env is unset", func(t *testing.T) {
		setFrontendOriginForTest(t, nil)

		reqAllowed := httptest.NewRequest(http.MethodGet, "/api/ws/conv-1", nil)
		reqAllowed.Header.Set("Origin", defaultOrigin)
		if !upgrader.CheckOrigin(reqAllowed) {
			t.Fatalf("expected upgrader to allow default origin %q", defaultOrigin)
		}

		reqDenied := httptest.NewRequest(http.MethodGet, "/api/ws/conv-1", nil)
		reqDenied.Header.Set("Origin", "http://evil.local")
		if upgrader.CheckOrigin(reqDenied) {
			t.Fatal("expected upgrader to deny non-default origin when env is unset")
		}
	})

	t.Run("uses configured origin when env is set", func(t *testing.T) {
		setFrontendOriginForTest(t, &configuredOrigin)

		reqAllowed := httptest.NewRequest(http.MethodGet, "/api/ws/conv-1", nil)
		reqAllowed.Header.Set("Origin", configuredOrigin)
		if !upgrader.CheckOrigin(reqAllowed) {
			t.Fatalf("expected upgrader to allow configured origin %q", configuredOrigin)
		}

		reqDenied := httptest.NewRequest(http.MethodGet, "/api/ws/conv-1", nil)
		reqDenied.Header.Set("Origin", defaultOrigin)
		if upgrader.CheckOrigin(reqDenied) {
			t.Fatalf("expected upgrader to deny default origin when configured origin is %q", configuredOrigin)
		}
	})
}
