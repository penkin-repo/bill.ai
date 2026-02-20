package database

import (
	"fmt"
	"strings"

	"bill.ai/internal/models"
)

func (d *DB) ReplaceProducts(products []models.Product) error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}

	tx, err := d.sql.Begin()
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if _, err := tx.Exec(`DELETE FROM products`); err != nil {
		return err
	}

	stmt, err := tx.Prepare(`
		INSERT INTO products (
			id, name, category, unit, price, description, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, p := range products {
		if _, err := stmt.Exec(
			p.ID,
			p.Name,
			p.Category,
			p.Unit,
			p.Price,
			p.Description,
			p.CreatedAt,
			p.UpdatedAt,
		); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (d *DB) GetAllProducts() ([]models.Product, error) {
	if d == nil || d.sql == nil {
		return nil, fmt.Errorf("db is nil")
	}

	rows, err := d.sql.Query(`
		SELECT id, name, category, unit, price, description, created_at, updated_at
		FROM products
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []models.Product
	for rows.Next() {
		var p models.Product
		err := rows.Scan(
			&p.ID,
			&p.Name,
			&p.Category,
			&p.Unit,
			&p.Price,
			&p.Description,
			&p.CreatedAt,
			&p.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		res = append(res, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return res, nil
}

func (d *DB) DeleteProduct(id string) error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}
	_, err := d.sql.Exec(`DELETE FROM products WHERE id = ?`, id)
	return err
}

func (d *DB) SearchProducts(query string) ([]models.Product, error) {
	if d == nil || d.sql == nil {
		return nil, fmt.Errorf("db is nil")
	}

	words := strings.Fields(strings.TrimSpace(query))
	if len(words) == 0 {
		return d.GetAllProducts()
	}

	// SQLite LIKE / LOWER() don't handle Unicode (Cyrillic) case folding,
	// so we load all products and filter in Go.
	all, err := d.GetAllProducts()
	if err != nil {
		return nil, err
	}

	// Lowercase search words once
	lowerWords := make([]string, len(words))
	for i, w := range words {
		lowerWords[i] = strings.ToLower(w)
	}

	var res []models.Product
	for _, p := range all {
		nameLower := strings.ToLower(p.Name)
		catLower := strings.ToLower(p.Category)
		match := true
		for _, lw := range lowerWords {
			if !strings.Contains(nameLower, lw) && !strings.Contains(catLower, lw) {
				match = false
				break
			}
		}
		if match {
			res = append(res, p)
		}
	}

	return res, nil
}
