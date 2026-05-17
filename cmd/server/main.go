package main

import (
	"os"

	"github.com/aamod/llm-infra-assistant/internal/adapter"
	"github.com/aamod/llm-infra-assistant/internal/k8s"
	"github.com/aamod/llm-infra-assistant/internal/prompt"
	"github.com/aamod/llm-infra-assistant/internal/server"
	"github.com/aamod/llm-infra-assistant/internal/store"
	"github.com/aamod/llm-infra-assistant/web"
	"go.uber.org/zap"
)

func main() {
	logger, _ := zap.NewDevelopment()
	defer logger.Sync()

	providerCfg := adapter.Config{
		Provider:       getEnv("PROVIDER", "ollama"),
		OllamaHost:     getEnv("OLLAMA_HOST", "http://localhost:11434"),
		OllamaModel:    getEnv("OLLAMA_MODEL", "llama3.2"),
		OpenAIKey:      getEnv("OPENAI_API_KEY", ""),
		OpenAIModel:    getEnv("OPENAI_MODEL", "gpt-4o-mini"),
		AnthropicKey:   getEnv("ANTHROPIC_API_KEY", ""),
		AnthropicModel: getEnv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20240620"),
	}

	modelProvider, err := adapter.New(providerCfg)
	if err != nil {
		logger.Fatal("Failed to initialize model provider", zap.Error(err))
	}

	dbPath := getEnv("DB_PATH", "./data/snapshots.db")
	os.MkdirAll("./data", 0755)
	dbStore, err := store.NewStore(dbPath)
	if err != nil {
		logger.Fatal("Failed to initialize store", zap.Error(err))
	}

	k8sClient, err := k8s.NewClient()
	if err != nil {
		logger.Warn("Failed to init kubernetes client (running without cluster mode)", zap.Error(err))
	}

	var cm *k8s.ClusterManager
	var pb *prompt.Builder
	if k8sClient != nil {
		cm = k8s.NewClusterManager(k8sClient, dbStore)
		pb = prompt.NewBuilder(k8sClient.DiscoveryClient)
	} else {
		pb = prompt.NewBuilder(nil)
	}

	srv := server.NewServer(logger, modelProvider, cm, pb, k8sClient, web.DistFS)

	port := getEnv("PORT", "8080")
	if err := srv.Start(port); err != nil {
		logger.Fatal("Server failed", zap.Error(err))
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
