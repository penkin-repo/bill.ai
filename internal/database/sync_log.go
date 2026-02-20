package database

import (
	"fmt"
	"time"
)

func (d *DB) LogSync(entity, direction string, recordsCount int, status string, errorMessage string) error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}

	_, err := d.sql.Exec(`
		INSERT INTO sync_log (entity, direction, records_count, status, error_message, synced_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, entity, direction, recordsCount, status, errorMessage, time.Now().Format("2006-01-02 15:04:05"))
	return err
}

func (d *DB) GetLastSyncTime(entity string) (string, error) {
	if d == nil || d.sql == nil {
		return "", fmt.Errorf("db is nil")
	}

	var t string
	err := d.sql.QueryRow(`SELECT synced_at FROM sync_log WHERE entity = ? ORDER BY id DESC LIMIT 1`, entity).Scan(&t)
	if err != nil {
		return "", nil
	}
	return t, nil
}
