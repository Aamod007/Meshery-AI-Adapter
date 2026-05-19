package k8s

import (
	"encoding/json"
	"strings"
)

// ErrorKind categorizes the type of error returned by the apply pipeline.
type ErrorKind string

const (
	// ErrValidation means the YAML is syntactically invalid or fails server-side dry-run.
	ErrValidation ErrorKind = "VALIDATION"
	// ErrConflict means the resource already exists or there is a version conflict.
	ErrConflict ErrorKind = "CONFLICT"
	// ErrApplyFailed means an unexpected server error occurred during apply.
	ErrApplyFailed ErrorKind = "APPLY_FAILED"
)

// ApplyError is a structured error returned by the apply pipeline.
type ApplyError struct {
	Kind        ErrorKind `json:"kind"`
	Resource    string    `json:"resource,omitempty"`
	Message     string    `json:"message"`
	Suggestion  string    `json:"suggestion,omitempty"`
}

func (e *ApplyError) Error() string {
	return e.Message
}

// ClassifyError inspects a raw Kubernetes error message and returns a structured ApplyError.
func ClassifyError(err error, resource string) *ApplyError {
	if err == nil {
		return nil
	}

	msg := err.Error()

	// Conflict / already exists
	if strings.Contains(msg, "already exists") {
		return &ApplyError{
			Kind:       ErrConflict,
			Resource:   resource,
			Message:    msg,
			Suggestion: "Resource already exists. Delete it first with 'kubectl delete " + resource + "' or use a different name in your prompt.",
		}
	}

	// Version conflict / modified
	if strings.Contains(msg, "the object has been modified") {
		return &ApplyError{
			Kind:       ErrConflict,
			Resource:   resource,
			Message:    msg,
			Suggestion: "The resource was modified concurrently. Try again.",
		}
	}

	// Validation / dry-run failures
	if strings.Contains(msg, "invalid") || strings.Contains(msg, "required field") ||
		strings.Contains(msg, "unknown field") || strings.Contains(msg, "expected") ||
		strings.Contains(msg, "DryRun") {
		return &ApplyError{
			Kind:       ErrValidation,
			Resource:   resource,
			Message:    msg,
			Suggestion: "Fix the YAML and try again. Use 'Retry with error context' to let the LLM correct it.",
		}
	}

	// Generic apply failure
	return &ApplyError{
		Kind:       ErrApplyFailed,
		Resource:   resource,
		Message:    msg,
		Suggestion: "Check cluster connectivity and RBAC permissions.",
	}
}

// MarshalJSON implements json.Marshaler for ApplyError to include the error kind in responses.
func (e *ApplyError) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]any{
		"kind":       e.Kind,
		"resource":   e.Resource,
		"message":    e.Message,
		"suggestion": e.Suggestion,
	})
}
