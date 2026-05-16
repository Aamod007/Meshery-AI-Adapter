package k8s

import (
	"bytes"
	"context"
	"fmt"
	"io"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/restmapper"
)

type ValidationError struct {
	Resource string `json:"resource"`
	Field    string `json:"field,omitempty"`
	Message  string `json:"message"`
}

func (c *Client) ValidateYAML(ctx context.Context, yamlData string) ([]ValidationError, error) {
	decoder := yaml.NewYAMLOrJSONDecoder(bytes.NewReader([]byte(yamlData)), 4096)
	var errors []ValidationError

	mapper := restmapper.NewDeferredDiscoveryRESTMapper(memory.NewMemCacheClient(c.DiscoveryClient))

	for {
		var obj unstructured.Unstructured
		if err := decoder.Decode(&obj); err != nil {
			if err == io.EOF {
				break
			}
			return []ValidationError{{Message: fmt.Sprintf("YAML parse error: %v", err)}}, nil
		}

		if len(obj.Object) == 0 {
			continue
		}

		gvk := obj.GroupVersionKind()
		mapping, err := mapper.RESTMapping(gvk.GroupKind(), gvk.Version)
		if err != nil {
			if meta.IsNoMatchError(err) {
				errors = append(errors, ValidationError{
					Resource: fmt.Sprintf("%s/%s", gvk.GroupVersion().String(), gvk.Kind),
					Message:  "Resource type not recognized by cluster",
				})
			} else {
				errors = append(errors, ValidationError{Message: fmt.Sprintf("Mapper error: %v", err)})
			}
			continue
		}

		ns := obj.GetNamespace()
		if ns == "" && mapping.Scope.Name() == meta.RESTScopeNameNamespace {
			ns = "default"
		}

		dr := c.DynamicClient.Resource(mapping.Resource).Namespace(ns)
		opts := metav1.CreateOptions{DryRun: []string{metav1.DryRunAll}}

		_, err = dr.Create(ctx, &obj, opts)
		if err != nil {
			// Extract field errors if possible from k8s API error, keeping it simple here
			errors = append(errors, ValidationError{
				Resource: fmt.Sprintf("%s/%s", gvk.GroupVersion().String(), gvk.Kind),
				Message:  err.Error(),
			})
		}
	}

	return errors, nil
}

func GetResourceMapping(mapper meta.RESTMapper, gvk schema.GroupVersionKind) (*meta.RESTMapping, error) {
	return mapper.RESTMapping(gvk.GroupKind(), gvk.Version)
}
