package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

const rollbackTTL = 60 * time.Second

type Store struct {
	db *sql.DB
}

type Snapshot struct {
	ApplyID     string
	ResourceKey string
	GVRKey      string // "group/version/resource" for REST mapping
	StateJSON   string
	CreatedAt   time.Time
}

func NewStore(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	query := `
	CREATE TABLE IF NOT EXISTS snapshots (
		apply_id TEXT,
		resource_key TEXT,
		gvr_key TEXT DEFAULT '',
		state_json TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`
	if _, err := db.Exec(query); err != nil {
		return nil, fmt.Errorf("failed to create table: %v", err)
	}

	// Add gvr_key column if upgrading from an older DB schema
	_, _ = db.Exec("ALTER TABLE snapshots ADD COLUMN gvr_key TEXT DEFAULT ''")

	return &Store{db: db}, nil
}

func (s *Store) SaveSnapshot(ctx context.Context, applyID, resourceKey, gvrKey, stateJSON string) error {
	_, err := s.db.ExecContext(ctx,
		"INSERT INTO snapshots (apply_id, resource_key, gvr_key, state_json) VALUES (?, ?, ?, ?)",
		applyID, resourceKey, gvrKey, stateJSON)
	return err
}

func (s *Store) GetSnapshots(ctx context.Context, applyID string) ([]Snapshot, error) {
	rows, err := s.db.QueryContext(ctx,
		"SELECT resource_key, gvr_key, state_json, created_at FROM snapshots WHERE apply_id = ?", applyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var snaps []Snapshot
	for rows.Next() {
		var snap Snapshot
		snap.ApplyID = applyID
		if err := rows.Scan(&snap.ResourceKey, &snap.GVRKey, &snap.StateJSON, &snap.CreatedAt); err != nil {
			return nil, err
		}
		snaps = append(snaps, snap)
	}
	return snaps, nil
}

// CheckRollbackTTL returns an error if the rollback window (60s) has expired.
func (s *Store) CheckRollbackTTL(ctx context.Context, applyID string) error {
	var createdAt time.Time
	err := s.db.QueryRowContext(ctx,
		"SELECT created_at FROM snapshots WHERE apply_id = ? LIMIT 1", applyID).Scan(&createdAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("no snapshots found for apply_id %s", applyID)
		}
		return err
	}

	elapsed := time.Since(createdAt)
	if elapsed > rollbackTTL {
		return fmt.Errorf("rollback window expired: apply was %s ago (max %s)", elapsed.Round(time.Second), rollbackTTL)
	}
	return nil
}
