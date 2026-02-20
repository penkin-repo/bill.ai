package database

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"bill.ai/internal/models"
)

type productTemplate struct {
	NameTemplate string   `json:"name_template"`
	Colors       []string `json:"colors"`
	Price        float64  `json:"price"`
}

type productCatalog struct {
	PavingSlabs []productTemplate `json:"paving_slabs"`
	Curbs       []productTemplate `json:"curbs"`
}

func expandTemplates(templates []productTemplate, category, unit string) []models.Product {
	now := time.Now().Format(time.RFC3339)
	var products []models.Product

	for _, t := range templates {
		for _, color := range t.Colors {
			name := strings.ReplaceAll(t.NameTemplate, "{color}", color)
			name = strings.TrimSpace(name)
			for strings.Contains(name, "  ") {
				name = strings.ReplaceAll(name, "  ", " ")
			}

			id := fmt.Sprintf("%s|%.0f", name, t.Price)

			products = append(products, models.Product{
				ID:        id,
				Name:      name,
				Category:  category,
				Unit:      unit,
				Price:     t.Price,
				CreatedAt: now,
				UpdatedAt: now,
			})
		}
	}
	return products
}

func (d *DB) SeedProductsFromJSON(jsonData string) error {
	var catalog productCatalog
	if err := json.Unmarshal([]byte(jsonData), &catalog); err != nil {
		return fmt.Errorf("parse products JSON: %w", err)
	}

	var all []models.Product
	all = append(all, expandTemplates(catalog.PavingSlabs, "Тротуарная плита", "м²")...)
	all = append(all, expandTemplates(catalog.Curbs, "Бордюр", "шт")...)

	return d.ReplaceProducts(all)
}

func (d *DB) ProductCount() (int, error) {
	if d == nil || d.sql == nil {
		return 0, fmt.Errorf("db is nil")
	}
	var count int
	err := d.sql.QueryRow(`SELECT COUNT(*) FROM products`).Scan(&count)
	return count, err
}
