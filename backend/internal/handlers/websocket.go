package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	"deakr/aicm/internal/database"
	"deakr/aicm/internal/ws"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if origin == "" {
			return true
		}
		allowed := strings.TrimSpace(os.Getenv("FRONTEND_ORIGIN"))
		if allowed == "" {
			allowed = "http://localhost:7200"
		}
		return origin == allowed
	},
}

func wsCanAccessConversation(db *database.Service, ctx context.Context, conversationID string, userID string, role string) (bool, error) {
	if conversationID == ws.SupportInboxChannel {
		return role == "agent" || role == "admin", nil
	}
	if role == "agent" || role == "admin" {
		return true, nil
	}
	if role != "customer" {
		return false, nil
	}
	var exists bool
	err := db.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM conversations WHERE id = $1 AND customer_id = $2)", conversationID, userID).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

func ServeWS(db *database.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conversationID := chi.URLParam(r, "id")
		tokenString := strings.TrimSpace(r.URL.Query().Get("token"))
		if tokenString == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		jwtSecret := os.Getenv("JWT_SECRET")
		if strings.TrimSpace(jwtSecret) == "" {
			http.Error(w, "Server auth is not configured", http.StatusInternalServerError)
			return
		}
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, http.ErrAbortHandler
			}
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		userID, ok := claims["user_id"].(string)
		if !ok || strings.TrimSpace(userID) == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		role, ok := claims["role"].(string)
		if !ok || strings.TrimSpace(role) == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		allowed, err := wsCanAccessConversation(db, context.Background(), conversationID, userID, role)
		if err != nil {
			http.Error(w, "Failed to verify conversation access", http.StatusInternalServerError)
			return
		}
		if !allowed {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		var userName string
		_ = db.Pool.QueryRow(context.Background(), "SELECT COALESCE(name, '') FROM users WHERE id = $1", userID).Scan(&userName)

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}

		ws.AddClient(conversationID, &ws.Client{
			Conn:   conn,
			UserID: userID,
			Role:   role,
			Name:   userName,
		})

		go func() {
			defer ws.RemoveClient(conversationID, conn)
			for {
				_, raw, err := conn.ReadMessage()
				if err != nil {
					break
				}

				var event struct {
					Type     string `json:"type"`
					IsTyping bool   `json:"is_typing"`
				}
				if err := json.Unmarshal(raw, &event); err != nil {
					continue
				}

				switch event.Type {
				case "typing":
					if conversationID == ws.SupportInboxChannel {
						continue
					}
					ws.Broadcast(conversationID, map[string]interface{}{
						"type": "typing",
						"payload": map[string]interface{}{
							"conversation_id": conversationID,
							"user_id":         userID,
							"role":            role,
							"name":            userName,
							"is_typing":       event.IsTyping,
						},
					})
				case "read_receipt":
					if conversationID == ws.SupportInboxChannel {
						continue
					}
					column := "agent_last_read_at"
					if role == "customer" {
						column = "customer_last_read_at"
					}

					var customerLastReadAt, agentLastReadAt *time.Time
					query := "UPDATE conversations SET " + column + " = CURRENT_TIMESTAMP WHERE id = $1 RETURNING customer_last_read_at, agent_last_read_at"
					if err := db.Pool.QueryRow(context.Background(), query, conversationID).Scan(&customerLastReadAt, &agentLastReadAt); err != nil {
						continue
					}

					ws.Broadcast(conversationID, map[string]interface{}{
						"type": "read_receipt",
						"payload": map[string]interface{}{
							"conversation_id":       conversationID,
							"viewer_role":           role,
							"customer_last_read_at": customerLastReadAt,
							"agent_last_read_at":    agentLastReadAt,
						},
					})
				}
			}
		}()
	}
}
