package database

import (
	"database/sql"
	"fmt"
)

func (d *DB) GetSetting(key string) (string, error) {
	if d == nil || d.sql == nil {
		return "", fmt.Errorf("db is nil")
	}

	var val string
	err := d.sql.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&val)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", err
	}

	return val, nil
}

func (d *DB) SetSetting(key, value string) error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}

	_, err := d.sql.Exec(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value)
	return err
}
