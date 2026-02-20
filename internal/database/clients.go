package database

import (
	"fmt"
	"strings"

	"bill.ai/internal/models"
)

func (d *DB) GetAllClients() ([]models.Client, error) {
	if d == nil || d.sql == nil {
		return nil, fmt.Errorf("db is nil")
	}

	rows, err := d.sql.Query(`
		SELECT id, name, inn, kpp, address, bank_name, bank_bik, bank_account, bank_corr_account,
		       contact_person, phone, email, comment, created_at, updated_at
		FROM clients
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []models.Client
	for rows.Next() {
		var c models.Client
		err := rows.Scan(
			&c.ID,
			&c.Name,
			&c.INN,
			&c.KPP,
			&c.Address,
			&c.BankName,
			&c.BankBIK,
			&c.BankAccount,
			&c.BankCorrAccount,
			&c.ContactPerson,
			&c.Phone,
			&c.Email,
			&c.Comment,
			&c.CreatedAt,
			&c.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		res = append(res, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return res, nil
}

func (d *DB) SearchClients(query string) ([]models.Client, error) {
	if d == nil || d.sql == nil {
		return nil, fmt.Errorf("db is nil")
	}

	words := strings.Fields(strings.TrimSpace(query))
	if len(words) == 0 {
		return d.GetAllClients()
	}

	// SQLite LIKE / LOWER() don't handle Unicode (Cyrillic) case folding reliably,
	// so we load all clients and filter in Go.
	all, err := d.GetAllClients()
	if err != nil {
		return nil, err
	}

	lowerWords := make([]string, len(words))
	for i, w := range words {
		lowerWords[i] = strings.ToLower(w)
	}

	var res []models.Client
	for _, c := range all {
		nameLower := strings.ToLower(c.Name)
		innLower := strings.ToLower(c.INN)
		match := true
		for _, lw := range lowerWords {
			if !strings.Contains(nameLower, lw) && !strings.Contains(innLower, lw) {
				match = false
				break
			}
		}
		if match {
			res = append(res, c)
		}
	}

	return res, nil
}
