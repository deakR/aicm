package server

import (
	"fmt"
	"net/http"

	"deakr/aicm/internal/database"
	"deakr/aicm/internal/handlers"
	"deakr/aicm/internal/middleware" // Our custom auth middleware

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware" // Aliased Chi middleware
	"github.com/go-chi/cors"
)

type Server struct {
	Router *chi.Mux
	DB     *database.Service
}

func New(db *database.Service) *Server {
	r := chi.NewRouter()

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:7200"}, // Allow your React app
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Use Chi's robust, built-in middleware via the alias
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)

	s := &Server{
		Router: r,
		DB:     db,
	}

	s.registerRoutes()
	return s
}

func (s *Server) registerRoutes() {
	authHandler := &handlers.AuthHandler{DB: s.DB}
	widgetHandler := &handlers.WidgetHandler{DB: s.DB}
	conversationHandler := &handlers.ConversationHandler{DB: s.DB}

	// Ensure CORS preflight requests always get a valid response.
	s.Router.Options("/*", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	s.Router.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("AI Support Platform API is running!"))
	})

	// Public Auth Routes
	s.Router.Route("/api/auth", func(r chi.Router) {
		r.Post("/register", authHandler.Register)
		r.Post("/login", authHandler.Login)
	})

	// Public Widget Route
	s.Router.Post("/api/widget/init", widgetHandler.InitWidget)
	s.Router.Get("/api/ws/{id}", handlers.ServeWS)

	// Protected Routes (Require valid JWT)
	s.Router.Route("/api/protected", func(r chi.Router) {
		// Apply the RequireAuth middleware to all routes in this group
		r.Use(middleware.RequireAuth)

		r.Get("/me", func(w http.ResponseWriter, r *http.Request) {
			claims := r.Context().Value(middleware.UserContextKey)
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(fmt.Sprintf("You are authenticated! Your token claims: %v", claims)))
		})

		// Add our new conversation API endpoints
		r.Get("/conversations", conversationHandler.ListConversations)
		r.Get("/conversations/{id}/messages", conversationHandler.GetMessages)
		r.Post("/conversations/{id}/messages", conversationHandler.SendMessage) // ADD THIS LINE
	})
}
