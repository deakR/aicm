package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimitByIPBlocksAfterLimit(t *testing.T) {
	handler := RateLimitByIP(2, time.Minute)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
		req.RemoteAddr = "203.0.113.10:5050"
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("request %d expected 200, got %d", i+1, rr.Code)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	req.RemoteAddr = "203.0.113.10:5050"
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 after exceeding limit, got %d", rr.Code)
	}
	if rr.Header().Get("Retry-After") == "" {
		t.Fatal("expected Retry-After header on throttled response")
	}
}

func TestRateLimitByIPSeparatesDifferentIPs(t *testing.T) {
	handler := RateLimitByIP(1, time.Minute)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	reqA := httptest.NewRequest(http.MethodGet, "/api/auth/register", nil)
	reqA.RemoteAddr = "203.0.113.11:5050"
	rrA := httptest.NewRecorder()
	handler.ServeHTTP(rrA, reqA)
	if rrA.Code != http.StatusOK {
		t.Fatalf("first IP expected 200, got %d", rrA.Code)
	}

	reqA2 := httptest.NewRequest(http.MethodGet, "/api/auth/register", nil)
	reqA2.RemoteAddr = "203.0.113.11:5050"
	rrA2 := httptest.NewRecorder()
	handler.ServeHTTP(rrA2, reqA2)
	if rrA2.Code != http.StatusTooManyRequests {
		t.Fatalf("first IP second request expected 429, got %d", rrA2.Code)
	}

	reqB := httptest.NewRequest(http.MethodGet, "/api/auth/register", nil)
	reqB.RemoteAddr = "203.0.113.12:5050"
	rrB := httptest.NewRecorder()
	handler.ServeHTTP(rrB, reqB)
	if rrB.Code != http.StatusOK {
		t.Fatalf("second IP expected independent 200, got %d", rrB.Code)
	}
}

func TestRateLimitByIPResetsAfterWindow(t *testing.T) {
	handler := RateLimitByIP(1, 30*time.Millisecond)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/widget/init", nil)
	req.RemoteAddr = "203.0.113.13:5050"

	rr1 := httptest.NewRecorder()
	handler.ServeHTTP(rr1, req)
	if rr1.Code != http.StatusOK {
		t.Fatalf("first request expected 200, got %d", rr1.Code)
	}

	rr2 := httptest.NewRecorder()
	handler.ServeHTTP(rr2, req)
	if rr2.Code != http.StatusTooManyRequests {
		t.Fatalf("second request before reset expected 429, got %d", rr2.Code)
	}

	time.Sleep(50 * time.Millisecond)

	rr3 := httptest.NewRecorder()
	handler.ServeHTTP(rr3, req)
	if rr3.Code != http.StatusOK {
		t.Fatalf("request after window reset expected 200, got %d", rr3.Code)
	}
}
