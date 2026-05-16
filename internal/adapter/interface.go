package adapter

import "context"

// ModelProvider is the single interface all LLM backends implement.
type ModelProvider interface {
	Complete(ctx context.Context, req CompletionRequest) (CompletionResponse, error)
	Name() string
	IsAvailable(ctx context.Context) error
}

type CompletionRequest struct {
	SystemPrompt string
	UserPrompt   string
	MaxTokens    int
	Temperature  float64
}

type CompletionResponse struct {
	Content      string
	InputTokens  int
	OutputTokens int
	LatencyMs    int64
}

type Config struct {
	Provider       string
	OllamaHost     string
	OllamaModel    string
	OpenAIKey      string
	OpenAIModel    string
	AnthropicKey   string
	AnthropicModel string
}

// New returns the configured provider based on the Provider string.
func New(cfg Config) (ModelProvider, error) {
	switch cfg.Provider {
	case "openai":
		return NewOpenAIAdapter(cfg)
	case "anthropic":
		return NewAnthropicAdapter(cfg)
	default:
		return NewOllamaAdapter(cfg)
	}
}
