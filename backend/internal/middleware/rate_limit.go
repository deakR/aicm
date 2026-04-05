package middleware

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type rateLimitEntry struct {
	windowStart time.Time
	count       int
}

type ipRateLimiter struct {
	mu          sync.Mutex
	entries     map[string]rateLimitEntry
	maxRequests int
	window      time.Duration
	lastCleanup time.Time
}

// RateLimitByIP limits requests per client IP within a time window.
//
// It is intended for public-facing routes (auth, widget init) to reduce
// brute force and scripted abuse.
func RateLimitByIP(maxRequests int, window time.Duration) func(http.Handler) http.Handler {
	if maxRequests < 1 {
		maxRequests = 1
	}
	if window <= 0 {
		window = time.Minute
	}

	limiter := &ipRateLimiter{
		entries:     map[string]rateLimitEntry{},
		maxRequests: maxRequests,
		window:      window,
		lastCleanup: time.Now(),
	}

	return limiter.middleware
}

func (l *ipRateLimiter) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		now := time.Now()
		key := clientIPFromRequest(r) + "|" + r.URL.Path

		l.mu.Lock()
		if now.Sub(l.lastCleanup) > 2*l.window {
			l.cleanupStaleEntries(now)
			l.lastCleanup = now
		}

		entry := l.entries[key]
		if entry.windowStart.IsZero() || now.Sub(entry.windowStart) >= l.window {
			entry.windowStart = now
			entry.count = 0
		}

		if entry.count >= l.maxRequests {
			retryAfter := int((l.window - now.Sub(entry.windowStart)).Seconds())
			if retryAfter < 1 {
				retryAfter = 1
			}
			remaining := 0
			resetIn := retryAfter
			l.mu.Unlock()

			setRateLimitHeaders(w, l.maxRequests, remaining, resetIn)
			w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
			http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
			return
		}

		entry.count++
		l.entries[key] = entry

		remaining := l.maxRequests - entry.count
		if remaining < 0 {
			remaining = 0
		}
		resetIn := int((l.window - now.Sub(entry.windowStart)).Seconds())
		if resetIn < 0 {
			resetIn = 0
		}
		l.mu.Unlock()

		setRateLimitHeaders(w, l.maxRequests, remaining, resetIn)
		next.ServeHTTP(w, r)
	})
}

func (l *ipRateLimiter) cleanupStaleEntries(now time.Time) {
	for key, entry := range l.entries {
		if now.Sub(entry.windowStart) > 3*l.window {
			delete(l.entries, key)
		}
	}
}

func setRateLimitHeaders(w http.ResponseWriter, max, remaining, resetSeconds int) {
	w.Header().Set("X-RateLimit-Limit", strconv.Itoa(max))
	w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
	w.Header().Set("X-RateLimit-Reset", strconv.Itoa(resetSeconds))
}

func clientIPFromRequest(r *http.Request) string {
	if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); forwarded != "" {
		parts := strings.Split(forwarded, ",")
		if len(parts) > 0 {
			candidate := strings.TrimSpace(parts[0])
			if candidate != "" {
				return candidate
			}
		}
	}

	if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); realIP != "" {
		return realIP
	}

	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}

	if strings.TrimSpace(r.RemoteAddr) == "" {
		return "unknown"
	}

	return strings.TrimSpace(r.RemoteAddr)
}
