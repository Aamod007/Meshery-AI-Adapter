package k8s

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/restmapper"
	"github.com/aamod/llm-infra-assistant/internal/store"
)

type ApplyResult struct {
	ID        string
	Resources []string
	AppliedAt time.Time
	CanUndo   bool
}

type ClusterManager struct {
	client *Client
	store  *store.Store
}

func NewClusterManager(client *Client, dbStore *store.Store) *ClusterManager {
	return &ClusterManager{
		client: client,
		store:  dbStore,
	}
}

func (cm *ClusterManager) Apply(ctx context.Context, yamlData string) (ApplyResult, error) {
	decoder := yaml.NewYAMLOrJSONDecoder(bytes.NewReader([]byte(yamlData)), 4096)
	mapper := restmapper.NewDeferredDiscoveryRESTMapper(memory.NewMemCacheClient(cm.client.DiscoveryClient))

	var appliedResources []string
	applyID := fmt.Sprintf("apply-%d", time.Now().UnixNano())

	for {
		var obj unstructured.Unstructured
		if err := decoder.Decode(&obj); err != nil {
			if err == io.EOF {
				break
			}
			return ApplyResult{}, err
		}
		if len(obj.Object) == 0 {
			continue
		}

		gvk := obj.GroupVersionKind()
		mapping, err := mapper.RESTMapping(gvk.GroupKind(), gvk.Version)
		if err != nil {
			return ApplyResult{}, fmt.Errorf("failed to map %s: %v", gvk, err)
		}

		ns := obj.GetNamespace()
		if ns == "" && mapping.Scope.Name() == "namespace" {
			ns = "default"
		}

		dr := cm.client.DynamicClient.Resource(mapping.Resource).Namespace(ns)
		name := obj.GetName()

		// Snapshot previous state
		var prevJSON []byte
		existing, err := dr.Get(ctx, name, metav1.GetOptions{})
		if err == nil {
			prevJSON, _ = existing.MarshalJSON()
		} else if !errors.IsNotFound(err) {
			return ApplyResult{}, fmt.Errorf("failed to get existing %s: %v", name, err)
		}

		// Apply
		data, _ := json.Marshal(obj.Object)
		_, err = dr.Patch(ctx, name, types.ApplyPatchType, data, metav1.PatchOptions{FieldManager: "llm-infra"})
		if err != nil {
			return ApplyResult{}, fmt.Errorf("failed to apply %s: %v", name, err)
		}

		resKey := fmt.Sprintf("%s/%s/%s", ns, gvk.Kind, name)
		appliedResources = append(appliedResources, resKey)

		// Build a GVR key: "group/version/resource" so rollback can map back
		gvrKey := fmt.Sprintf("%s/%s/%s", mapping.Resource.Group, mapping.Resource.Version, mapping.Resource.Resource)

		// Record snapshot (pass gvrKey for rollback)
		if err := cm.store.SaveSnapshot(ctx, applyID, resKey, gvrKey, string(prevJSON)); err != nil {
			return ApplyResult{}, fmt.Errorf("failed to save snapshot: %v", err)
		}
	}

	return ApplyResult{
		ID:        applyID,
		Resources: appliedResources,
		AppliedAt: time.Now(),
		CanUndo:   true,
	}, nil
}

func (cm *ClusterManager) CheckRollbackTTL(ctx context.Context, applyID string) error {
	return cm.store.CheckRollbackTTL(ctx, applyID)
}

func (cm *ClusterManager) Rollback(ctx context.Context, applyID string) error {
	snapshots, err := cm.store.GetSnapshots(ctx, applyID)
	if err != nil {
		return err
	}
	if len(snapshots) == 0 {
		return fmt.Errorf("no snapshots found for %s or TTL expired", applyID)
	}

	for _, snap := range snapshots {
		// Parse resource key "namespace/Kind/name"
		parts := strings.SplitN(snap.ResourceKey, "/", 3)
		if len(parts) != 3 {
			return fmt.Errorf("invalid resource key format: %s", snap.ResourceKey)
		}
		ns, _, name := parts[0], parts[1], parts[2]

		// Parse GVR key "group/version/resource"
		gvrParts := strings.SplitN(snap.GVRKey, "/", 3)
		if len(gvrParts) != 3 {
			return fmt.Errorf("invalid gvr key format: %s", snap.GVRKey)
		}
		gvr := schema.GroupVersionResource{
			Group:    gvrParts[0],
			Version:  gvrParts[1],
			Resource: gvrParts[2],
		}

		dr := cm.client.DynamicClient.Resource(gvr).Namespace(ns)

		if snap.StateJSON == "" {
			// Resource didn't exist before apply — delete it to roll back
			err := dr.Delete(ctx, name, metav1.DeleteOptions{})
			if err != nil && !errors.IsNotFound(err) {
				return fmt.Errorf("rollback delete failed for %s: %v", snap.ResourceKey, err)
			}
		} else {
			// Resource existed before — patch it back to its original state
			var obj unstructured.Unstructured
			if jsonErr := json.Unmarshal([]byte(snap.StateJSON), &obj); jsonErr != nil {
				return fmt.Errorf("rollback unmarshal failed for %s: %v", snap.ResourceKey, jsonErr)
			}
			// Clear resource version to avoid conflicts with the current state
			obj.SetResourceVersion("")
			patchData, _ := json.Marshal(obj.Object)
			_, err := dr.Patch(ctx, name, types.MergePatchType, patchData, metav1.PatchOptions{})
			if err != nil {
				// If it no longer exists, recreate it
				if errors.IsNotFound(err) {
					_, createErr := dr.Create(ctx, &obj, metav1.CreateOptions{FieldManager: "llm-infra"})
					if createErr != nil {
						return fmt.Errorf("rollback recreate failed for %s: %v", snap.ResourceKey, createErr)
					}
				} else {
					return fmt.Errorf("rollback patch failed for %s: %v", snap.ResourceKey, err)
				}
			}
		}
	}

	return nil
}
