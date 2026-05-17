package server

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins
	},
}

// wsMessage is the envelope sent over the WebSocket connection.
type wsMessage struct {
	Kind     string `json:"kind"`     // "status" | "error" | "ping"
	Resource string `json:"resource"` // "namespace/Kind/name"
	Ready    bool   `json:"ready"`
	Message  string `json:"message"`
}

// connHub tracks active WebSocket connections so the server can broadcast.
type connHub struct {
	mu    sync.Mutex
	conns map[*websocket.Conn]struct{}
}

var hub = &connHub{conns: make(map[*websocket.Conn]struct{})}

func (h *connHub) add(c *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.conns[c] = struct{}{}
}

func (h *connHub) remove(c *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.conns, c)
}

// Broadcast sends a JSON message to all connected WebSocket clients.
func (h *connHub) Broadcast(msg wsMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.conns {
		_ = c.WriteMessage(websocket.TextMessage, data)
	}
}

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		s.logger.Error("Failed to upgrade websocket", zap.Error(err))
		return
	}
	hub.add(c)
	defer func() {
		hub.remove(c)
		c.Close()
	}()

	s.logger.Info("WebSocket client connected")

	// Keep connection alive — read loop drains pings/pongs from client
	for {
		_, _, err := c.ReadMessage()
		if err != nil {
			break
		}
	}
}
