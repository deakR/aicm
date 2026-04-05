package ws

import (
	"sync"

	"github.com/gorilla/websocket"
)

var (
	// Clients maps a conversation ID to active websocket connections.
	Clients = make(map[string]map[*websocket.Conn]*Client)
	Mutex   = &sync.RWMutex{}
	// WriteMutex serializes websocket writes and avoids concurrent write corruption.
	WriteMutex = &sync.Mutex{}
)

const SupportInboxChannel = "__support_inbox__"

type Client struct {
	Conn   *websocket.Conn
	UserID string
	Role   string
	Name   string
}

func AddClient(conversationID string, client *Client) {
	Mutex.Lock()
	defer Mutex.Unlock()

	if Clients[conversationID] == nil {
		Clients[conversationID] = make(map[*websocket.Conn]*Client)
	}
	Clients[conversationID][client.Conn] = client
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
	Mutex.RLock()
	conns := []*websocket.Conn{}
	for conn := range Clients[conversationID] {
		conns = append(conns, conn)
	}
	Mutex.RUnlock()

	WriteMutex.Lock()
	defer WriteMutex.Unlock()

	for _, conn := range conns {
		if err := conn.WriteJSON(message); err != nil {
			// If write fails, remove the client.
			Mutex.Lock()
			if _, ok := Clients[conversationID]; ok {
				delete(Clients[conversationID], conn)
				if len(Clients[conversationID]) == 0 {
					delete(Clients, conversationID)
				}
			}
			Mutex.Unlock()
			_ = conn.Close()
		}
	}
}

// BroadcastSupport sends a JSON message to all support users subscribed to the
// shared inbox channel.
func BroadcastSupport(message interface{}) {
	Mutex.RLock()
	clients := []*Client{}
	for _, client := range Clients[SupportInboxChannel] {
		if client.Role == "agent" || client.Role == "admin" {
			clients = append(clients, client)
		}
	}
	Mutex.RUnlock()

	WriteMutex.Lock()
	defer WriteMutex.Unlock()

	for _, client := range clients {
		if err := client.Conn.WriteJSON(message); err != nil {
			Mutex.Lock()
			if _, ok := Clients[SupportInboxChannel]; ok {
				delete(Clients[SupportInboxChannel], client.Conn)
				if len(Clients[SupportInboxChannel]) == 0 {
					delete(Clients, SupportInboxChannel)
				}
			}
			Mutex.Unlock()
			_ = client.Conn.Close()
		}
	}
}
