package ws

import (
	"sync"

	"github.com/gorilla/websocket"
)

var (
	// Clients maps a conversation ID to active websocket connections.
	Clients = make(map[string]map[*websocket.Conn]bool)
	Mutex   = &sync.Mutex{}
)

func AddClient(conversationID string, conn *websocket.Conn) {
	Mutex.Lock()
	defer Mutex.Unlock()

	if Clients[conversationID] == nil {
		Clients[conversationID] = make(map[*websocket.Conn]bool)
	}
	Clients[conversationID][conn] = true
}

func RemoveClient(conversationID string, conn *websocket.Conn) {
	Mutex.Lock()
	defer Mutex.Unlock()

	if _, ok := Clients[conversationID]; ok {
		delete(Clients[conversationID], conn)
		if len(Clients[conversationID]) == 0 {
			delete(Clients, conversationID)
		}
	}

	_ = conn.Close()
}

// Broadcast sends a JSON message to everyone viewing a conversation.
func Broadcast(conversationID string, message interface{}) {
	Mutex.Lock()
	defer Mutex.Unlock()

	for conn := range Clients[conversationID] {
		if err := conn.WriteJSON(message); err != nil {
			delete(Clients[conversationID], conn)
			_ = conn.Close()
		}
	}

	if len(Clients[conversationID]) == 0 {
		delete(Clients, conversationID)
	}
}
