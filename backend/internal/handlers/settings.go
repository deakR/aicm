package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"time"

	"deakr/aicm/internal/database"
	"deakr/aicm/internal/models"
)

type SettingsHandler struct {
	DB *database.Service
}

var hexColorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func defaultAISettings() models.AISettings {
	return models.AISettings{
		Name:        "AI Agent",
		Greeting:    "Hi, I'm your AI support assistant.",
		Tone:        "friendly",
		BrandName:   "AICM Support",
		AccentColor: "#2563EB",
		UpdatedAt:   time.Time{},
	}
}

func loadAISettings(ctx context.Context, db *database.Service) (models.AISettings, error) {
	settings := defaultAISettings()
	err := db.Pool.QueryRow(
		ctx,
		`SELECT name, greeting, tone, brand_name, accent_color, updated_at FROM ai_settings WHERE id = 1`,
	).Scan(&settings.Name, &settings.Greeting, &settings.Tone, &settings.BrandName, &settings.AccentColor, &settings.UpdatedAt)
	if err != nil {
		return settings, err
	}
	if strings.TrimSpace(settings.Name) == "" {
		settings.Name = "AI Agent"
	}
	if strings.TrimSpace(settings.Greeting) == "" {
		settings.Greeting = "Hi, I'm your AI support assistant."
	}
	if strings.TrimSpace(settings.Tone) == "" {
		settings.Tone = "friendly"
	}
	if strings.TrimSpace(settings.BrandName) == "" {
		settings.BrandName = "AICM Support"
	}
	if !hexColorPattern.MatchString(strings.TrimSpace(settings.AccentColor)) {
		settings.AccentColor = "#2563EB"
	}
	return settings, nil
}

func (h *SettingsHandler) GetPublicSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := loadAISettings(context.Background(), h.DB)
	if err != nil {
		http.Error(w, "Failed to load public settings", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.PublicSettings{
		AssistantName: settings.Name,
		BrandName:     settings.BrandName,
		AccentColor:   settings.AccentColor,
	})
}

func (h *SettingsHandler) GetAISettings(w http.ResponseWriter, r *http.Request) {
	_, role, ok := requestIdentity(r)
	if !ok || role != "admin" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	settings, err := loadAISettings(context.Background(), h.DB)
	if err != nil {
		http.Error(w, "Failed to load AI settings", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(settings)
}

func (h *SettingsHandler) UpdateAISettings(w http.ResponseWriter, r *http.Request) {
	_, role, ok := requestIdentity(r)
	if !ok || role != "admin" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var payload models.AISettings
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	payload.Name = strings.TrimSpace(payload.Name)
	payload.Greeting = strings.TrimSpace(payload.Greeting)
	payload.Tone = strings.TrimSpace(strings.ToLower(payload.Tone))
	payload.BrandName = strings.TrimSpace(payload.BrandName)
	payload.AccentColor = strings.TrimSpace(payload.AccentColor)

	if payload.Name == "" || payload.Greeting == "" || payload.Tone == "" || payload.BrandName == "" || payload.AccentColor == "" {
		http.Error(w, "Name, greeting, tone, brand name, and accent color are required", http.StatusBadRequest)
		return
	}

	switch payload.Tone {
	case "friendly", "formal", "balanced":
	default:
		http.Error(w, "Tone must be one of friendly, formal, or balanced", http.StatusBadRequest)
		return
	}
	if !hexColorPattern.MatchString(payload.AccentColor) {
		http.Error(w, "Accent color must be a valid hex value like #2563EB", http.StatusBadRequest)
		return
	}

	err := h.DB.Pool.QueryRow(
		context.Background(),
		`INSERT INTO ai_settings (id, name, greeting, tone, brand_name, accent_color, updated_at)
		 VALUES (1, $1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
		 ON CONFLICT (id) DO UPDATE
		 SET name = EXCLUDED.name,
		     greeting = EXCLUDED.greeting,
		     tone = EXCLUDED.tone,
		     brand_name = EXCLUDED.brand_name,
		     accent_color = EXCLUDED.accent_color,
		     updated_at = CURRENT_TIMESTAMP
		 RETURNING updated_at`,
		payload.Name,
		payload.Greeting,
		payload.Tone,
		payload.BrandName,
		payload.AccentColor,
	).Scan(&payload.UpdatedAt)
	if err != nil {
		http.Error(w, "Failed to save AI settings", http.StatusInternalServerError)
		return
	}

	_, _ = h.DB.Pool.Exec(
		context.Background(),
		`UPDATE users SET name = $1 WHERE email = 'ai-agent@local.system'`,
		payload.Name,
	)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(payload)
}
