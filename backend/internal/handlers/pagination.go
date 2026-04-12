package handlers

import (
	"net/http"
	"strconv"
	"strings"
)

func parsePagination(r *http.Request, defaultLimit int, maxLimit int) (int, int) {
	limit := defaultLimit
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if limit > maxLimit {
		limit = maxLimit
	}

	offset := 0
	if raw := strings.TrimSpace(r.URL.Query().Get("offset")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed >= 0 {
			offset = parsed
			return limit, offset
		}
	}

	if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
		if page, err := strconv.Atoi(raw); err == nil && page > 1 {
			offset = (page - 1) * limit
		}
	}

	return limit, offset
}
