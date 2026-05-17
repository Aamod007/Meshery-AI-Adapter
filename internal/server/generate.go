package server

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/aamod/llm-infra-assistant/internal/adapter"
	"github.com/aamod/llm-infra-assistant/internal/k8s"
)

type generateRequest struct {
	Prompt   string `json:"prompt"`
	Provider string `json:"provider"`
	Validate bool   `json:"validate"`
}

type generateResponse struct {
	YAML       string `json:"yaml"`
	Validation struct {
		Passed bool                  `json:"passed"`
		Errors []k8s.ValidationError `json:"errors"`
	} `json:"validation"`
	Meta struct {
		Provider     string `json:"provider"`
		InputTokens  int    `json:"input_tokens"`
		OutputTokens int    `json:"output_tokens"`
		LatencyMs    int64  `json:"latency_ms"`
	} `json:"meta"`
}

func (s *Server) handleGenerate(w http.ResponseWriter, r *http.Request) {
	var req generateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	sysPrompt, err := s.promptBuilder.BuildSystemPrompt(req.Prompt)
	if err != nil {
		http.Error(w, "Failed to build prompt", http.StatusInternalServerError)
		return
	}

	compResp, err := s.provider.Complete(r.Context(), adapter.CompletionRequest{
		SystemPrompt: sysPrompt,
		UserPrompt:   req.Prompt,
		Temperature:  0.2,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	yamlStr := cleanYAML(compResp.Content)

	resp := generateResponse{YAML: yamlStr}
	resp.Validation.Passed = true
	resp.Meta.Provider = s.provider.Name()
	resp.Meta.InputTokens = compResp.InputTokens
	resp.Meta.OutputTokens = compResp.OutputTokens
	resp.Meta.LatencyMs = compResp.LatencyMs

	if req.Validate && s.k8sClient != nil {
		errs, valErr := s.k8sClient.ValidateYAML(r.Context(), yamlStr)
		if valErr != nil {
			resp.Validation.Passed = false
			resp.Validation.Errors = []k8s.ValidationError{{Message: valErr.Error()}}
		} else if len(errs) > 0 {
			resp.Validation.Passed = false
			resp.Validation.Errors = errs
		}
	}

	if !resp.Validation.Passed {
		respondJSON(w, http.StatusUnprocessableEntity, resp)
		return
	}

	respondJSON(w, http.StatusOK, resp)
}

func cleanYAML(content string) string {
	content = strings.TrimSpace(content)
	if strings.HasPrefix(content, "```yaml") {
		content = strings.TrimPrefix(content, "```yaml")
		content = strings.TrimSuffix(content, "```")
	} else if strings.HasPrefix(content, "```") {
		content = strings.TrimPrefix(content, "```")
		content = strings.TrimSuffix(content, "```")
	}
	return strings.TrimSpace(content)
}
