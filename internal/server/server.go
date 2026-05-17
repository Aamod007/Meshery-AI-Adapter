package server

import (
	"embed"
	"io/fs"
	"net/http"
	"time"

	"github.com/aamod/llm-infra-assistant/internal/adapter"
	"github.com/aamod/llm-infra-assistant/internal/k8s"
	"github.com/aamod/llm-infra-assistant/internal/prompt"
	"github.com/gorilla/mux"
	"go.uber.org/zap"
)

type Server struct {
	logger         *zap.Logger
	provider       adapter.ModelProvider
	clusterManager *k8s.ClusterManager
	promptBuilder  *prompt.Builder
	k8sClient      *k8s.Client
	webDist        embed.FS
}

func NewServer(logger *zap.Logger, provider adapter.ModelProvider, cm *k8s.ClusterManager, pb *prompt.Builder, kc *k8s.Client, webDist embed.FS) *Server {
	return &Server{
		logger:         logger,
		provider:       provider,
		clusterManager: cm,
		promptBuilder:  pb,
		k8sClient:      kc,
		webDist:        webDist,
	}
}

func (s *Server) SetupRouter() *mux.Router {
	r := mux.NewRouter()

	r.Use(s.middlewareLogger)
	r.Use(middlewareCORS)

	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/generate", s.handleGenerate).Methods(http.MethodPost)
	api.HandleFunc("/apply", s.handleApply).Methods(http.MethodPost)
	api.HandleFunc("/apply/{id}", s.handleRollback).Methods(http.MethodDelete)
	api.HandleFunc("/ws", s.handleWS).Methods(http.MethodGet)
	api.HandleFunc("/health", s.handleHealth).Methods(http.MethodGet)

	// Top-level /health alias (used in the test plan)
	r.HandleFunc("/health", s.handleHealth).Methods(http.MethodGet)

	distFS, err := fs.Sub(s.webDist, "dist")
	if err == nil {
		r.PathPrefix("/").Handler(http.FileServer(http.FS(distFS)))
	}

	return r
}

func (s *Server) Start(port string) error {
	r := s.SetupRouter()
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 120 * time.Second,
	}

	s.logger.Info("Starting server", zap.String("port", port))
	return srv.ListenAndServe()
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	providerOk := s.provider.IsAvailable(ctx) == nil
	clusterOk := s.k8sClient != nil && s.k8sClient.IsAvailable(ctx) == nil

	clusterContext := "none"
	if s.k8sClient != nil && clusterOk {
		clusterContext = "connected"
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"provider":        s.provider.Name(),
		"provider_ok":     providerOk,
		"cluster_ok":      clusterOk,
		"cluster_context": clusterContext,
	})
}
