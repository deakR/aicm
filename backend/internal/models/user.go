package models

import "time"

type User struct {
	ID           string    `json:"id"`
	Role         string    `json:"role"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"` // The "-" ensures the password hash is never sent in JSON responses
	CreatedAt    time.Time `json:"created_at"`
}

// AuthPayload is the JSON structure we expect when a user logs in or registers
type AuthPayload struct {
	Name     string `json:"name,omitempty"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role,omitempty"` // customer, agent, or admin
}