package database

import (
	"fmt"

	"bill.ai/internal/models"
)

func (d *DB) GetAllMyCompanies() ([]models.MyCompany, error) {
	if d == nil || d.sql == nil {
		return nil, fmt.Errorf("db is nil")
	}

	rows, err := d.sql.Query(`
		SELECT
			id, name, short_name, inn, kpp, ogrn, address,
			bank_name, bank_bik, bank_account, bank_corr_account,
			director_name, director_title, phone, email,
			comment
		FROM my_companies
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.MyCompany
	for rows.Next() {
		var c models.MyCompany
		err := rows.Scan(
			&c.ID,
			&c.Name,
			&c.ShortName,
			&c.INN,
			&c.KPP,
			&c.OGRN,
			&c.Address,
			&c.BankName,
			&c.BankBIK,
			&c.BankAccount,
			&c.BankCorrAccount,
			&c.DirectorName,
			&c.DirectorTitle,
			&c.Phone,
			&c.Email,
			&c.Comment,
		)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return out, nil
}
