package prompt

import (
	"fmt"
	"strings"

	"k8s.io/client-go/discovery"
)

// FetchSchemas retrieves OpenAPI schema info for the requested Kubernetes resource types.
// It uses the discovery client to list all API resources and correlates the requested
// type names against them. For each matched type, it emits the apiVersion, kind,
// and a note about where to find the spec — so the LLM is grounded in what the cluster
// actually supports, including CRDs.
func FetchSchemas(client discovery.DiscoveryInterface, types []string) (string, error) {
	// Fetch all server API resource groups
	_, apiResourceLists, err := client.ServerGroupsAndResources()
	if err != nil && apiResourceLists == nil {
		return "", fmt.Errorf("failed to fetch API resources: %v", err)
	}

	// Build a map: lowercase kind → (apiVersion, kind)
	type resourceInfo struct {
		APIVersion string
		Kind       string
	}
	catalog := make(map[string]resourceInfo)

	for _, list := range apiResourceLists {
		if list == nil {
			continue
		}
		for _, r := range list.APIResources {
			if r.Kind == "" {
				continue
			}
			catalog[strings.ToLower(r.Kind)] = resourceInfo{
				APIVersion: list.GroupVersion,
				Kind:       r.Kind,
			}
		}
	}

	var sb strings.Builder
	matched := 0

	for _, t := range types {
		info, ok := catalog[strings.ToLower(t)]
		if !ok {
			sb.WriteString(fmt.Sprintf("# %s — not found in cluster API server\n", t))
			continue
		}
		matched++
		sb.WriteString(fmt.Sprintf(
			"# %s\napiVersion: %s\nkind: %s\n# Required: metadata.name\n\n",
			info.Kind, info.APIVersion, info.Kind,
		))
	}

	if matched == 0 {
		return "", fmt.Errorf("none of the requested types found in cluster")
	}

	return sb.String(), nil
}

// ExtractTypes parses the user prompt for mentions of Kubernetes resource types,
// including well-known built-ins and common CRD patterns.
func ExtractTypes(userPrompt string) []string {
	prompt := strings.ToLower(userPrompt)
	var mentioned []string

	builtins := []string{
		"deployment", "service", "configmap", "secret",
		"namespace", "pod", "statefulset", "daemonset",
		"ingress", "persistentvolumeclaim", "pvc",
		"serviceaccount", "role", "rolebinding",
		"clusterrole", "clusterrolebinding", "horizontalpodautoscaler",
		"job", "cronjob",
	}
	// Canonical capitalization for known types
	canonical := map[string]string{
		"pvc": "PersistentVolumeClaim",
	}

	for _, b := range builtins {
		if strings.Contains(prompt, b) {
			if c, ok := canonical[b]; ok {
				mentioned = append(mentioned, c)
			} else {
				// Title-case the type
				mentioned = append(mentioned, strings.Title(b))
			}
		}
	}

	// Extract CRD-like words: CamelCase words that start with a capital letter
	// e.g. "MesheryPattern", "VirtualService", "Gateway"
	words := strings.Fields(userPrompt)
	seen := make(map[string]bool)
	for _, w := range words {
		// Strip punctuation
		w = strings.Trim(w, `.,;:"'()`)
		if len(w) < 3 {
			continue
		}
		// Heuristic: starts with uppercase, contains at least one more uppercase (CamelCase)
		if w[0] >= 'A' && w[0] <= 'Z' {
			hasCamel := false
			for _, ch := range w[1:] {
				if ch >= 'A' && ch <= 'Z' {
					hasCamel = true
					break
				}
			}
			if hasCamel && !seen[w] {
				seen[w] = true
				mentioned = append(mentioned, w)
			}
		}
	}

	return mentioned
}
