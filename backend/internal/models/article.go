package models

import "time"

// Article represents a help center document.
type Article struct {
	ID         string    `json:"id"`
	Title      string    `json:"title"`
	Collection string    `json:"collection"`
	Section    string    `json:"section"`
	Content    string    `json:"content"`
	Status     string    `json:"status"`
	ViewCount  int       `json:"view_count"`
	CreatedAt  time.Time `json:"created_at"`
}

// ArticlePayload is the JSON expected when creating an article.
type ArticlePayload struct {
	Title      string `json:"title"`
	Collection string `json:"collection"`
	Section    string `json:"section"`
	Content    string `json:"content"`
	Status     string `json:"status"`
}
