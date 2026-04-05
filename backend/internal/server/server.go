package server

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"deakr/aicm/internal/ai"
	"deakr/aicm/internal/database"
	"deakr/aicm/internal/handlers"
	"deakr/aicm/internal/middleware"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/golang-jwt/jwt/v5"
)

type Server struct {
	Router *chi.Mux
	DB     *database.Service
	AI     *ai.Service
}

func extractIdentityFromContext(ctx context.Context) (string, string, bool) {
	claims, ok := ctx.Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		return "", "", false
	}

	rawUserID, ok := claims["user_id"]
	if !ok {
		return "", "", false
	}
	rawRole, ok := claims["role"]
	if !ok {
		return "", "", false
	}

	userID, ok := rawUserID.(string)
	if !ok || strings.TrimSpace(userID) == "" {
		return "", "", false
	}
	role, ok := rawRole.(string)
	if !ok || strings.TrimSpace(role) == "" {
		return "", "", false
	}

	return userID, role, true
}

func New(db *database.Service, aiService *ai.Service) *Server {
	r := chi.NewRouter()

	frontendOrigin := os.Getenv("FRONTEND_ORIGIN")
	if frontendOrigin == "" {
		frontendOrigin = "http://localhost:7200"
	}

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{frontendOrigin},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("Referrer-Policy", "no-referrer")
			w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
			w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
			w.Header().Set("Cross-Origin-Resource-Policy", "same-site")
			w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'")
			if r.TLS != nil {
				w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
			}
			next.ServeHTTP(w, r)
		})
	})

	s := &Server{
		Router: r,
		DB:     db,
		AI:     aiService,
	}

	s.registerRoutes()
	return s
}

func (s *Server) registerRoutes() {
	authHandler := &handlers.AuthHandler{DB: s.DB}
	conversationHandler := &handlers.ConversationHandler{DB: s.DB, AI: s.AI}
	knowledgeHandler := &handlers.KnowledgeHandler{DB: s.DB, AI: s.AI}
	ticketHandler := &handlers.TicketHandler{DB: s.DB}
	workflowHandler := &handlers.WorkflowHandler{DB: s.DB}
	analyticsHandler := &handlers.AnalyticsHandler{DB: s.DB}
	settingsHandler := &handlers.SettingsHandler{DB: s.DB}
	uploadHandler := &handlers.UploadHandler{}
	customerHandler := &handlers.CustomerHandler{DB: s.DB}

	s.Router.Options("/*", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	s.Router.Get("/favicon.ico", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	s.Router.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/favicon.ico" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	})

	s.Router.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("AI Support Platform API is running!"))
	})
	s.registerDocsRoutes()

	s.Router.Route("/api/auth", func(r chi.Router) {
		r.With(middleware.RateLimitByIP(5, time.Minute)).Post("/register", authHandler.Register)
		r.With(middleware.RateLimitByIP(5, time.Minute)).Post("/customer/register", authHandler.RegisterCustomer)
		r.With(middleware.RateLimitByIP(2, time.Minute)).Post("/bootstrap-admin", authHandler.BootstrapAdmin)
		r.With(middleware.RateLimitByIP(8, time.Minute)).Post("/login", authHandler.Login)
		r.With(middleware.RateLimitByIP(8, time.Minute)).Post("/admin/login", authHandler.LoginAdmin)
		r.With(middleware.RateLimitByIP(8, time.Minute)).Post("/agent/login", authHandler.LoginAgent)
		r.With(middleware.RateLimitByIP(8, time.Minute)).Post("/customer/login", authHandler.LoginCustomer)
	})

	s.Router.Get("/api/ws/{id}", handlers.ServeWS(s.DB))
	s.Router.Get("/api/settings/public", settingsHandler.GetPublicSettings)
	s.Router.Get("/api/articles", knowledgeHandler.ListPublicArticles)
	s.Router.Get("/api/articles/{id}", knowledgeHandler.GetArticle)

	// Serve the static uploads directory
	uploadDir := filepath.Join(".", "uploads")
	s.Router.Get("/uploads/*", func(w http.ResponseWriter, r *http.Request) {
		rctx := chi.RouteContext(r.Context())
		pathPrefix := strings.TrimSuffix(rctx.RoutePattern(), "/*")
		fs := http.StripPrefix(pathPrefix, http.FileServer(http.Dir(uploadDir)))
		fs.ServeHTTP(w, r)
	})

	s.Router.Route("/api/protected", func(r chi.Router) {
		r.Use(middleware.RequireAuth)

		r.Post("/upload", uploadHandler.UploadFile)

		r.Get("/me", func(w http.ResponseWriter, r *http.Request) {
			userID, role, ok := extractIdentityFromContext(r.Context())
			if !ok {
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{
				"user_id": userID,
				"role":    role,
			})
		})

		r.Get("/customer/overview", customerHandler.GetOverview)
		r.Post("/customer/chat-session", customerHandler.EnsureChatSession)

		r.Get("/conversations", conversationHandler.ListConversations)
		r.Post("/conversations/email-sim", conversationHandler.SimulateEmail)
		r.Post("/conversations/bulk", conversationHandler.BulkAction)
		r.Get("/conversations/{id}/messages", conversationHandler.GetMessages)
		r.Post("/conversations/{id}/messages", conversationHandler.SendMessage)
		r.Put("/conversations/{id}/assign", conversationHandler.AssignConversation)
		r.Get("/conversations/{id}/copilot", conversationHandler.GenerateCopilotInsights)
		r.Post("/conversations/{id}/merge", conversationHandler.MergeConversation)

		r.Get("/articles", knowledgeHandler.ListArticles)
		r.Post("/articles", knowledgeHandler.CreateArticle)
		r.Get("/articles/{id}", knowledgeHandler.GetArticle)
		r.Put("/articles/{id}", knowledgeHandler.UpdateArticle)
		r.Delete("/articles/{id}", knowledgeHandler.DeleteArticle)

		r.Get("/tickets", ticketHandler.ListTickets)
		r.Post("/tickets", ticketHandler.CreateTicket)
		r.Put("/tickets/{id}", ticketHandler.UpdateTicket)
		r.Get("/tickets/{id}/comments", ticketHandler.ListComments)
		r.Post("/tickets/{id}/comments", ticketHandler.AddComment)
		r.Get("/tickets/{id}/notifications", ticketHandler.ListNotifications)

		r.Get("/workflows", workflowHandler.ListWorkflows)
		r.Post("/workflows", workflowHandler.CreateWorkflow)
		r.Get("/workflows/logs", workflowHandler.ListWorkflowLogs)
		r.Put("/workflows/{id}", workflowHandler.UpdateWorkflow)
		r.Get("/analytics", analyticsHandler.GetStats)
		r.Get("/users", authHandler.ListUsers)
		r.Post("/users", authHandler.CreateUser)
		r.Put("/users/{id}/attributes", authHandler.UpdateUserCustomAttributes)
		r.Get("/settings/ai", settingsHandler.GetAISettings)
		r.Put("/settings/ai", settingsHandler.UpdateAISettings)
	})
}

// StartScheduler starts background automation (time-based workflows etc).
func (s *Server) StartScheduler(ctx context.Context) {
	wh := &handlers.WorkflowHandler{DB: s.DB}
	wh.StartScheduler(ctx)
}
