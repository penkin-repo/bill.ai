package database

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
)

func isSQLiteBusyErr(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "sqlite_busy") || strings.Contains(msg, "database is locked") || strings.Contains(msg, "database is busy")
}

func (d *DB) GetSetting(key string) (string, error) {
	if d == nil || d.sql == nil {
		return "", fmt.Errorf("db is nil")
	}

	var val string
	for attempt := 0; attempt < 3; attempt++ {
		err := d.sql.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&val)
		if err == nil {
			return val, nil
		}
		if err == sql.ErrNoRows {
			return "", nil
		}
		if isSQLiteBusyErr(err) && attempt < 2 {
			time.Sleep(time.Duration(50*(attempt+1)) * time.Millisecond)
			continue
		}
		return "", err
	}

	return "", nil
}

func (d *DB) SetSetting(key, value string) error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}

	for attempt := 0; attempt < 3; attempt++ {
		_, err := d.sql.Exec(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value)
		if err == nil {
			return nil
		}
		if isSQLiteBusyErr(err) && attempt < 2 {
			time.Sleep(time.Duration(50*(attempt+1)) * time.Millisecond)
			continue
		}
		return err
	}
	return nil
}
