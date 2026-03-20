package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"deakr/aicm/internal/database"
	"deakr/aicm/internal/server"

	"github.com/joho/godotenv"
)

func main() {
	// 1. Load Environment
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: No .env file found")
	}

	// 2. Initialize Database
	db := database.New()
	defer db.Close() // Ensures the pool closes when main exits

	// 3. Initialize Server
	srv := server.New(db)

	// 4. Start Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Starting server on port %s...\n", port)
	log.Fatal(http.ListenAndServe(":"+port, srv.Router))
}
