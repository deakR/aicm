package handlers

import (
	"net/http"

	"deakr/aicm/internal/ws"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func ServeWS(w http.ResponseWriter, r *http.Request) {
	conversationID := chi.URLParam(r, "id")

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	ws.AddClient(conversationID, conn)

	go func() {
		defer ws.RemoveClient(conversationID, conn)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				break
			}
		}
	}()
}
