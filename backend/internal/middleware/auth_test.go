package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/golang-jwt/jwt/v5"
)

func setJWTSecretForTest(t *testing.T, value string) {
	t.Helper()
	old, had := os.LookupEnv("JWT_SECRET")
	if err := os.Setenv("JWT_SECRET", value); err != nil {
		t.Fatalf("failed setting JWT_SECRET for test: %v", err)
	}
	t.Cleanup(func() {
		if !had {
			_ = os.Unsetenv("JWT_SECRET")
			return
		}
		_ = os.Setenv("JWT_SECRET", old)
	})
}

func TestRequireAuthRejectsMissingAuthorization(t *testing.T) {
	setJWTSecretForTest(t, "test-secret")

	h := RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/protected/me", nil)
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for missing auth header, got %d", rr.Code)
	}
}

func TestRequireAuthRejectsInvalidToken(t *testing.T) {
	setJWTSecretForTest(t, "test-secret")

	h := RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/protected/me", nil)
	req.Header.Set("Authorization", "Bearer not-a-valid-token")
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for invalid token, got %d", rr.Code)
	}
}

func TestRequireAuthAcceptsValidToken(t *testing.T) {
	setJWTSecretForTest(t, "test-secret")

	claims := jwt.MapClaims{
		"user_id": "user-123",
		"role":    "admin",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("failed creating signed token: %v", err)
	}

	hit := false
	h := RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hit = true
		if r.Context().Value(UserContextKey) == nil {
			t.Fatal("expected claims in context for valid token")
		}
		w.WriteHeader(http.StatusOK)
	}))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/protected/me", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for valid token, got %d", rr.Code)
	}
	if !hit {
		t.Fatal("expected downstream handler to run for valid token")
	}
}
