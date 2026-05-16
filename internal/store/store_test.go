package store

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestStore(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "storetest")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	dbPath := filepath.Join(tmpDir, "test.db")
	s, err := NewStore(dbPath)
	if err != nil {
		t.Fatal(err)
	}

	ctx := context.Background()
	err = s.SaveSnapshot(ctx, "apply-123", "default/Deployment/nginx", "apps/v1/deployments", "{}")
	if err != nil {
		t.Fatal(err)
	}

	snaps, err := s.GetSnapshots(ctx, "apply-123")
	if err != nil {
		t.Fatal(err)
	}

	if len(snaps) != 1 {
		t.Fatalf("expected 1 snap, got %d", len(snaps))
	}
	if snaps[0].ResourceKey != "default/Deployment/nginx" {
		t.Errorf("unexpected resource key: %s", snaps[0].ResourceKey)
	}
}
