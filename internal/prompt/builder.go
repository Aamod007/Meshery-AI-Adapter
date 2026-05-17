package prompt

import (
	"fmt"

	"k8s.io/client-go/discovery"
)

type Builder struct {
	client discovery.DiscoveryInterface
}

func NewBuilder(client discovery.DiscoveryInterface) *Builder {
	return &Builder{client: client}
}

func (b *Builder) BuildSystemPrompt(userIntent string) (string, error) {
	basePrompt := `You are a Kubernetes YAML generator. You must produce valid YAML only.
No markdown wrappers, no explanations. Just valid YAML documents separated by ---.`

	types := ExtractTypes(userIntent)
	if len(types) > 0 && b.client != nil {
		schemaStr, err := FetchSchemas(b.client, types)
		if err == nil {
			return fmt.Sprintf("%s\n\nThe following schemas define valid fields for the resources requested:\n%s", basePrompt, schemaStr), nil
		}
	}

	return basePrompt, nil
}
