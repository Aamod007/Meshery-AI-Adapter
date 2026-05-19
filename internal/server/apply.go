package server

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"go.uber.org/zap"
	"github.com/aamod/llm-infra-assistant/internal/k8s"
)

type applyRequest struct {
	YAML string `json:"yaml"`
}

func (s *Server) handleApply(w http.ResponseWriter, r *http.Request) {
	if s.clusterManager == nil {
		http.Error(w, "Cluster manager not initialized", http.StatusServiceUnavailable)
		return
	}

	var req applyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	res, err := s.clusterManager.Apply(r.Context(), req.YAML)
	if err != nil {
		// Extract resource name from error for better classification
		resource := extractResourceFromError(req.YAML)
		applyErr := k8s.ClassifyError(err, resource)

		statusCode := http.StatusInternalServerError
		switch applyErr.Kind {
		case k8s.ErrConflict:
			statusCode = http.StatusConflict
		case k8s.ErrValidation:
			statusCode = http.StatusUnprocessableEntity
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(statusCode)
		json.NewEncoder(w).Encode(applyErr)
		return
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"apply_id":       res.ID,
		"resources":      res.Resources,
		"applied_at":     res.AppliedAt,
		"can_undo_until": res.AppliedAt.Add(60 * time.Second),
	})

	// Stream watch events to all WebSocket clients in the background
	if s.clusterManager != nil {
		go func() {
			// Use a detached context — the HTTP request context is canceled
			// once the response is sent, but the watch needs to keep running.
			watchCtx, cancel := context.WithTimeout(context.Background(), 125*time.Second)
			defer cancel()
			watchCh, err := s.clusterManager.Watch(watchCtx, res)
			if err != nil {
				s.logger.Warn("Watch failed", zap.Error(err))
				return
			}
			for status := range watchCh {
				hub.Broadcast(wsMessage{
					Kind:     "status",
					Resource: status.Resource,
					Ready:    status.Ready,
					Message:  status.Message,
				})
			}
		}()
	}
}

func (s *Server) handleRollback(w http.ResponseWriter, r *http.Request) {
	if s.clusterManager == nil {
		http.Error(w, "Cluster manager not initialized", http.StatusServiceUnavailable)
		return
	}

	vars := mux.Vars(r)
	id := vars["id"]

	// Enforce the 60-second rollback TTL
	if err := s.clusterManager.CheckRollbackTTL(r.Context(), id); err != nil {
		respondJSON(w, http.StatusGone, map[string]any{
			"error": err.Error(),
		})
		return
	}

	err := s.clusterManager.Rollback(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
	})
}

// extractResourceFromError parses the YAML to find the resource name for error classification.
func extractResourceFromError(yamlData string) string {
	lines := strings.Split(yamlData, "\n")
	var kind, name string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "kind:") {
			kind = strings.TrimSpace(strings.TrimPrefix(trimmed, "kind:"))
		}
		if strings.HasPrefix(trimmed, "name:") && name == "" {
			name = strings.TrimSpace(strings.TrimPrefix(trimmed, "name:"))
		}
	}
	if kind != "" && name != "" {
		return kind + "/" + name
	}
	return "unknown"
}
