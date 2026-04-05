package models

import "time"

type AISettings struct {
	Name        string    `json:"name"`
	Greeting    string    `json:"greeting"`
	Tone        string    `json:"tone"`
	BrandName   string    `json:"brand_name"`
	AccentColor string    `json:"accent_color"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type PublicSettings struct {
	AssistantName string `json:"assistant_name"`
	BrandName     string `json:"brand_name"`
	AccentColor   string `json:"accent_color"`
}
