package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"deakr/aicm/internal/ai"
	"deakr/aicm/internal/database"
	"deakr/aicm/internal/models"

	"github.com/go-chi/chi/v5"
)

func normalizeArticleTaxonomy(value string, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}

type KnowledgeHandler struct {
	DB *database.Service
	AI *ai.Service
}

// CreateArticle saves a new article for Groq-grounded retrieval.
func (h *KnowledgeHandler) CreateArticle(w http.ResponseWriter, r *http.Request) {
	var payload models.ArticlePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	if payload.Title == "" || payload.Content == "" {
		http.Error(w, "Title and content are required", http.StatusBadRequest)
		return
	}

	if payload.Status == "" {
		payload.Status = "published"
	}
	payload.Collection = normalizeArticleTaxonomy(payload.Collection, "General")
	payload.Section = normalizeArticleTaxonomy(payload.Section, "General")

	ctx := context.Background()
	var embeddingParam *string
	if h.AI != nil {
		embedding, err := h.AI.GenerateEmbedding(ctx, payload.Title+"\n\n"+payload.Content)
		if err != nil {
			fmt.Printf("Warning: failed to generate article embedding: %v\n", err)
		} else {
			embeddingParam = vectorLiteral(embedding)
		}
	}

	query := `
		INSERT INTO articles (title, collection_name, section_name, content, status, embedding)
		VALUES ($1, $2, $3, $4, $5, $6::vector)
		RETURNING id, collection_name, section_name, created_at
	`

	var article models.Article
	article.Title = payload.Title
	article.Collection = payload.Collection
	article.Section = payload.Section
	article.Content = payload.Content
	article.Status = payload.Status

	err := h.DB.Pool.QueryRow(
		ctx,
		query,
		payload.Title,
		payload.Collection,
		payload.Section,
		payload.Content,
		payload.Status,
		embeddingParam,
	).Scan(&article.ID, &article.Collection, &article.Section, &article.CreatedAt)
	if err != nil {
		fmt.Printf("Database insertion error: %v\n", err)
		http.Error(w, "Failed to save article", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(article)
}

// ListArticles returns all articles without the embedding payload.
func (h *KnowledgeHandler) ListArticles(w http.ResponseWriter, r *http.Request) {
	query := `SELECT id, title, collection_name, section_name, content, status, view_count, created_at FROM articles ORDER BY collection_name ASC, section_name ASC, created_at DESC`

	rows, err := h.DB.Pool.Query(context.Background(), query)
	if err != nil {
		http.Error(w, "Failed to fetch articles", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var articles []models.Article
	for rows.Next() {
		var a models.Article
		if err := rows.Scan(&a.ID, &a.Title, &a.Collection, &a.Section, &a.Content, &a.Status, &a.ViewCount, &a.CreatedAt); err != nil {
			http.Error(w, "Error parsing articles", http.StatusInternalServerError)
			return
		}
		articles = append(articles, a)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, "Failed to stream articles", http.StatusInternalServerError)
		return
	}

	if articles == nil {
		articles = []models.Article{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(articles)
}

// ListPublicArticles returns only published articles for the customer-facing Help Center.
func (h *KnowledgeHandler) ListPublicArticles(w http.ResponseWriter, r *http.Request) {
	searchTerm := r.URL.Query().Get("q")
	query := `SELECT id, title, collection_name, section_name, content, status, view_count, created_at FROM articles WHERE status = 'published'`
	args := []interface{}{}

	if searchTerm != "" {
		query += " AND (title ILIKE $1 OR content ILIKE $1 OR collection_name ILIKE $1 OR section_name ILIKE $1)"
		args = append(args, "%"+searchTerm+"%")
	}
	query += " ORDER BY collection_name ASC, section_name ASC, created_at DESC"

	rows, err := h.DB.Pool.Query(context.Background(), query, args...)
	if err != nil {
		http.Error(w, "Failed to fetch public articles", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var articles []models.Article
	for rows.Next() {
		var a models.Article
		if err := rows.Scan(&a.ID, &a.Title, &a.Collection, &a.Section, &a.Content, &a.Status, &a.ViewCount, &a.CreatedAt); err != nil {
			http.Error(w, "Error parsing articles", http.StatusInternalServerError)
			return
		}
		articles = append(articles, a)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, "Failed to stream public articles", http.StatusInternalServerError)
		return
	}

	if articles == nil {
		articles = []models.Article{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(articles)
}

// GetArticle returns a single article and increments its view count.
func (h *KnowledgeHandler) GetArticle(w http.ResponseWriter, r *http.Request) {
	articleID := chi.URLParam(r, "id")
	if articleID == "" {
		http.Error(w, "Article ID is required", http.StatusBadRequest)
		return
	}

	// Increment view count
	_, _ = h.DB.Pool.Exec(context.Background(), "UPDATE articles SET view_count = view_count + 1 WHERE id = $1", articleID)

	var a models.Article
	query := `SELECT id, title, collection_name, section_name, content, status, view_count, created_at FROM articles WHERE id = $1`
	err := h.DB.Pool.QueryRow(context.Background(), query, articleID).Scan(&a.ID, &a.Title, &a.Collection, &a.Section, &a.Content, &a.Status, &a.ViewCount, &a.CreatedAt)
	if err != nil {
		http.Error(w, "Article not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(a)
}

// UpdateArticle updates an existing article's title, content, and/or status.
func (h *KnowledgeHandler) UpdateArticle(w http.ResponseWriter, r *http.Request) {
	articleID := chi.URLParam(r, "id")
	if articleID == "" {
		http.Error(w, "Article ID is required", http.StatusBadRequest)
		return
	}

	var payload models.ArticlePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if payload.Title != "" {
		setClauses = append(setClauses, fmt.Sprintf("title = $%d", argIdx))
		args = append(args, payload.Title)
		argIdx++
	}
	if strings.TrimSpace(payload.Collection) != "" {
		setClauses = append(setClauses, fmt.Sprintf("collection_name = $%d", argIdx))
		args = append(args, normalizeArticleTaxonomy(payload.Collection, "General"))
		argIdx++
	}
	if strings.TrimSpace(payload.Section) != "" {
		setClauses = append(setClauses, fmt.Sprintf("section_name = $%d", argIdx))
		args = append(args, normalizeArticleTaxonomy(payload.Section, "General"))
		argIdx++
	}
	if payload.Content != "" {
		setClauses = append(setClauses, fmt.Sprintf("content = $%d", argIdx))
		args = append(args, payload.Content)
		argIdx++
	}
	if payload.Status != "" {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, payload.Status)
		argIdx++
	}

	// Update embedding if title or content changes
	if (payload.Title != "" || payload.Content != "") && h.AI != nil {
		// Fetch existing to merge
		var existingTitle, existingContent string
		queryExisting := `SELECT title, content FROM articles WHERE id = $1`
		if err := h.DB.Pool.QueryRow(context.Background(), queryExisting, articleID).Scan(&existingTitle, &existingContent); err != nil {
			http.Error(w, "Article not found", http.StatusNotFound)
			return
		}

		newTitle := existingTitle
		if payload.Title != "" {
			newTitle = payload.Title
		}
		newContent := existingContent
		if payload.Content != "" {
			newContent = payload.Content
		}

		embedding, err := h.AI.GenerateEmbedding(context.Background(), newTitle+"\n\n"+newContent)
		if err != nil {
			fmt.Printf("Warning: failed to regenerate article embedding for %s: %v\n", articleID, err)
		} else if literal := vectorLiteral(embedding); literal != nil {
			setClauses = append(setClauses, fmt.Sprintf("embedding = $%d::vector", argIdx))
			args = append(args, *literal)
			argIdx++
		}
	}

	if len(setClauses) == 0 {
		http.Error(w, "No fields to update", http.StatusBadRequest)
		return
	}

	query := fmt.Sprintf(`UPDATE articles SET %s WHERE id = $%d RETURNING id, title, collection_name, section_name, content, status, view_count, created_at`,
		strings.Join(setClauses, ", "), argIdx)
	args = append(args, articleID)

	var a models.Article
	err := h.DB.Pool.QueryRow(context.Background(), query, args...).Scan(
		&a.ID, &a.Title, &a.Collection, &a.Section, &a.Content, &a.Status, &a.ViewCount, &a.CreatedAt,
	)
	if err != nil {
		http.Error(w, "Failed to update article", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(a)
}

// DeleteArticle removes an article by ID.
func (h *KnowledgeHandler) DeleteArticle(w http.ResponseWriter, r *http.Request) {
	articleID := chi.URLParam(r, "id")
	if articleID == "" {
		http.Error(w, "Article ID is required", http.StatusBadRequest)
		return
	}

	_, err := h.DB.Pool.Exec(context.Background(), "DELETE FROM articles WHERE id = $1", articleID)
	if err != nil {
		http.Error(w, "Failed to delete article", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
