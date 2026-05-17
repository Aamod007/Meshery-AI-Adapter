package k8s

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/restmapper"
)

type ResourceStatus struct {
	Kind      string `json:"kind"`
	Resource  string `json:"resource"` // "namespace/Kind/name"
	Ready     bool   `json:"ready"`
	Message   string `json:"message"`
}

// Watch polls resource readiness after an apply and streams status events.
// It understands Deployment replica counts, and falls back to a simple
// existence check for all other kinds.
func (cm *ClusterManager) Watch(ctx context.Context, result ApplyResult) (<-chan ResourceStatus, error) {
	ch := make(chan ResourceStatus, 32)

	go func() {
		defer close(ch)
		mapper := restmapper.NewDeferredDiscoveryRESTMapper(memory.NewMemCacheClient(cm.client.DiscoveryClient))

		for _, resKey := range result.Resources {
			parts := strings.SplitN(resKey, "/", 3)
			if len(parts) != 3 {
				continue
			}
			ns, kind, name := parts[0], parts[1], parts[2]

			gvk, err := mapper.KindFor(schema.GroupVersionResource{Resource: strings.ToLower(kind) + "s"})
			if err != nil {
				// Try singular form
				gvk, err = mapper.KindFor(schema.GroupVersionResource{Resource: strings.ToLower(kind)})
				if err != nil {
					ch <- ResourceStatus{Kind: kind, Resource: resKey, Ready: true, Message: "Applied (watch unavailable)"}
					continue
				}
			}
			mapping, err := mapper.RESTMapping(gvk.GroupKind(), gvk.Version)
			if err != nil {
				ch <- ResourceStatus{Kind: kind, Resource: resKey, Ready: true, Message: "Applied (mapping unavailable)"}
				continue
			}

			dr := cm.client.DynamicClient.Resource(mapping.Resource).Namespace(ns)

			// Poll up to 120s with 2s intervals
			deadline := time.Now().Add(120 * time.Second)
			for time.Now().Before(deadline) {
				obj, err := dr.Get(ctx, name, metav1.GetOptions{})
				if err != nil {
					ch <- ResourceStatus{Kind: kind, Resource: resKey, Ready: false, Message: fmt.Sprintf("Waiting: %v", err)}
					time.Sleep(2 * time.Second)
					continue
				}

				ready, msg := checkReadiness(kind, obj.Object)
				ch <- ResourceStatus{Kind: kind, Resource: resKey, Ready: ready, Message: msg}
				if ready {
					break
				}
				time.Sleep(2 * time.Second)
			}
		}
	}()

	return ch, nil
}

// checkReadiness inspects an unstructured object and returns (ready, message).
func checkReadiness(kind string, obj map[string]any) (bool, string) {
	switch strings.ToLower(kind) {
	case "deployment":
		return checkDeploymentReadiness(obj)
	case "statefulset":
		return checkStatefulSetReadiness(obj)
	default:
		// For Namespace, ConfigMap, Service etc. — existence is enough
		return true, "Applied"
	}
}

func checkDeploymentReadiness(obj map[string]any) (bool, string) {
	spec, _ := obj["spec"].(map[string]any)
	status, _ := obj["status"].(map[string]any)

	desired := int64(1)
	if r, ok := spec["replicas"]; ok {
		desired = toInt64(r)
	}

	available := toInt64(status["availableReplicas"])
	ready := toInt64(status["readyReplicas"])

	if available >= desired && ready >= desired {
		return true, fmt.Sprintf("%d/%d replicas available", available, desired)
	}
	return false, fmt.Sprintf("%d/%d replicas available", available, desired)
}

func checkStatefulSetReadiness(obj map[string]any) (bool, string) {
	spec, _ := obj["spec"].(map[string]any)
	status, _ := obj["status"].(map[string]any)

	desired := int64(1)
	if r, ok := spec["replicas"]; ok {
		desired = toInt64(r)
	}
	ready := toInt64(status["readyReplicas"])

	if ready >= desired {
		return true, fmt.Sprintf("%d/%d replicas ready", ready, desired)
	}
	return false, fmt.Sprintf("%d/%d replicas ready", ready, desired)
}

func toInt64(v any) int64 {
	if v == nil {
		return 0
	}
	b, _ := json.Marshal(v)
	var n int64
	json.Unmarshal(b, &n)
	return n
}
