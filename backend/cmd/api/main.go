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

	srv := server.New(db)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Starting server on port %s...\n", port)
	log.Fatal(http.ListenAndServe(":"+port, srv.Router))
}
