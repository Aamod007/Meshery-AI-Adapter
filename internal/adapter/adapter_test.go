package adapter

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOllamaAdapter(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/api/chat" {
			w.Write([]byte(`{
				"message": {"role": "assistant", "content": "mock ollama response"},
				"prompt_eval_count": 10,
				"eval_count": 20
			}`))
			return
		}
		if r.URL.Path == "/api/version" {
			w.WriteHeader(http.StatusOK)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer ts.Close()

	cfg := Config{
		Provider:   "ollama",
		OllamaHost: ts.URL,
	}

	provider, err := New(cfg)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if provider.Name() != "ollama/llama3.2" {
		t.Errorf("expected ollama/llama3.2, got %s", provider.Name())
	}

	err = provider.IsAvailable(context.Background())
	if err != nil {
		t.Errorf("expected ollama to be available, got error: %v", err)
	}

	resp, err := provider.Complete(context.Background(), CompletionRequest{
		SystemPrompt: "sys",
		UserPrompt:   "user",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.Content != "mock ollama response" {
		t.Errorf("unexpected content: %s", resp.Content)
	}
}
