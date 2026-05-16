package adapter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type AnthropicAdapter struct {
	apiKey string
	model  string
}

func NewAnthropicAdapter(cfg Config) (ModelProvider, error) {
	if cfg.AnthropicKey == "" {
		return nil, fmt.Errorf("ANTHROPIC_API_KEY is required for anthropic provider")
	}
	if cfg.AnthropicModel == "" {
		cfg.AnthropicModel = "claude-3-5-sonnet-20240620"
	}
	return &AnthropicAdapter{
		apiKey: cfg.AnthropicKey,
		model:  cfg.AnthropicModel,
	}, nil
}

func (a *AnthropicAdapter) Complete(ctx context.Context, req CompletionRequest) (CompletionResponse, error) {
	start := time.Now()

	payload := map[string]any{
		"model":      a.model,
		"system":     req.SystemPrompt,
		"messages":   []map[string]string{{"role": "user", "content": req.UserPrompt}},
		"max_tokens": req.MaxTokens,
	}
	if req.MaxTokens <= 0 {
		payload["max_tokens"] = 4096
	}
	if req.Temperature > 0 {
		payload["temperature"] = req.Temperature
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return CompletionResponse{}, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return CompletionResponse{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", a.apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return CompletionResponse{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return CompletionResponse{}, fmt.Errorf("anthropic error: status %d", resp.StatusCode)
	}

	var parsed struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
		Usage struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return CompletionResponse{}, err
	}

	if len(parsed.Content) == 0 {
		return CompletionResponse{}, fmt.Errorf("no content returned from anthropic")
	}

	return CompletionResponse{
		Content:      parsed.Content[0].Text,
		InputTokens:  parsed.Usage.InputTokens,
		OutputTokens: parsed.Usage.OutputTokens,
		LatencyMs:    time.Since(start).Milliseconds(),
	}, nil
}

func (a *AnthropicAdapter) Name() string {
	return fmt.Sprintf("anthropic/%s", a.model)
}

func (a *AnthropicAdapter) IsAvailable(ctx context.Context) error {
	// Anthropic does not have a simple models list endpoint like OpenAI,
	// so we check if the key is provided and assume availability,
	// or perform a simple request that errors cleanly if invalid.
	if a.apiKey == "" {
		return fmt.Errorf("anthropic key not set")
	}
	return nil
}
