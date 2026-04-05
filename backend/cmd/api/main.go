package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"deakr/aicm/internal/ai"
	"deakr/aicm/internal/database"
	"deakr/aicm/internal/server"

	"github.com/joho/godotenv"
)

func main() {
	loaded := false
	for _, path := range []string{"../.env", ".env"} {
		if err := godotenv.Load(path); err == nil {
			loaded = true
			break
		}
	}
	if !loaded {
		log.Println("Warning: No .env file found")
	}

	db := database.New()
	defer db.Close()

	aiService := ai.New()
	defer aiService.Close()

	srv := server.New(db, aiService)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	srv.StartScheduler(ctx)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Starting server on port %s...\n", port)
	httpServer := &http.Server{
		Addr:              ":" + port,
		Handler:           srv.Router,
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}
	log.Fatal(httpServer.ListenAndServe())
}
