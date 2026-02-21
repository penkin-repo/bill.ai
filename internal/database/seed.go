package database

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"strconv"
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

var titleCodeRegex = regexp.MustCompile(`^(.+?)\s*\(([^)]+)\)`)
var htmlTagRegex = regexp.MustCompile(`<[^>]*>`)
var thicknessRegex = regexp.MustCompile(`(?i)(60|80)\s*мм`)
var curbCodeRegex = regexp.MustCompile(`(?i)(\d{2,4})[\.,](\d{1,3})[\.,](\d{1,3})`)
var curbSizeTextRegex = regexp.MustCompile(`(?i)(\d{3,4})\s*[xх×]\s*(\d{2,4})\s*[xх×]\s*(\d{1,3})\s*мм`)

func (d *DB) SeedProductsFromCSV(csvText string) error {
	csvText = strings.TrimSpace(csvText)
	if csvText == "" {
		return fmt.Errorf("csv is empty")
	}

	r := csv.NewReader(strings.NewReader(csvText))
	r.Comma = ';'
	r.LazyQuotes = true
	r.FieldsPerRecord = -1

	header, err := r.Read()
	if err != nil {
		return fmt.Errorf("read csv header: %w", err)
	}

	idx := make(map[string]int, len(header))
	for i, h := range header {
		idx[strings.TrimSpace(strings.Trim(h, `"`))] = i
	}

	get := func(row []string, key string) string {
		i, ok := idx[key]
		if !ok || i < 0 || i >= len(row) {
			return ""
		}
		return strings.TrimSpace(strings.Trim(row[i], `"`))
	}

	parents := map[string]map[string]string{}
	children := make([]map[string]string, 0, 1024)

	for {
		row, readErr := r.Read()
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return fmt.Errorf("read csv rows: %w", readErr)
		}

		m := map[string]string{}
		for key := range idx {
			m[key] = get(row, key)
		}

		uid := strings.TrimSpace(m["Tilda UID"])
		if uid == "" {
			continue
		}
		parentUID := strings.TrimSpace(m["Parent UID"])
		price := parseCSVFloat(m["Price"])
		hasCategory := strings.TrimSpace(m["Category"]) != ""

		if parentUID == "" && (hasCategory || price <= 0) {
			parents[uid] = m
			continue
		}
		children = append(children, m)
	}

	now := time.Now().Format(time.RFC3339)
	out := make([]models.Product, 0, len(children))
	seen := map[string]struct{}{}

	for _, child := range children {
		price := parseCSVFloat(child["Price"])
		if price <= 0 {
			continue
		}

		parentUID := strings.TrimSpace(child["Parent UID"])
		parent := parents[parentUID]
		if parent == nil {
			if byUID := parents[strings.TrimSpace(child["Tilda UID"])]; byUID != nil {
				parent = byUID
			}
		}

		title := firstNotEmpty(field(parent, "Title"), field(child, "Title"))
		name, code := parseNameAndCode(title)
		code = normalizeCodeByThickness(code, child, parent)
		if name == "" {
			name = strings.TrimSpace(title)
		}

		collection, color := extractCollectionAndColor(child)
		if collection == "" || color == "" {
			collection2, color2 := extractCollectionAndColor(parent)
			if collection == "" {
				collection = collection2
			}
			if color == "" {
				color = color2
			}
		}

		isCurb := isCurbProduct(name, code, child, parent)
		unit := detectUnit(firstNotEmpty(field(parent, "Text"), field(child, "Text")), isCurb)
		curbSize := detectCurbSize(code, title, child, parent)
		fullTitle := buildProductFullTitle(name, code, collection, color, isCurb, curbSize)
		if fullTitle == "" {
			continue
		}

		id := strings.TrimSpace(firstNotEmpty(field(child, "External ID"), field(child, "Tilda UID"), fullTitle))
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}

		out = append(out, models.Product{
			ID:          id,
			Name:        fullTitle,
			Category:    strings.TrimSpace(collection),
			Unit:        unit,
			Price:       price,
			Description: strings.TrimSpace(color),
			CreatedAt:   now,
			UpdatedAt:   now,
		})
	}

	if len(out) == 0 {
		return fmt.Errorf("в CSV не найдено товаров с ценой")
	}

	return d.ReplaceProducts(out)
}

func (d *DB) ProductCount() (int, error) {
	if d == nil || d.sql == nil {
		return 0, fmt.Errorf("db is nil")
	}
	var count int
	err := d.sql.QueryRow(`SELECT COUNT(*) FROM products`).Scan(&count)
	return count, err
}

func field(row map[string]string, key string) string {
	if row == nil {
		return ""
	}
	return strings.TrimSpace(row[key])
}

func firstNotEmpty(values ...string) string {
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v != "" {
			return v
		}
	}
	return ""
}

func parseCSVFloat(raw string) float64 {
	raw = strings.TrimSpace(strings.ReplaceAll(raw, ",", "."))
	if raw == "" {
		return 0
	}
	v, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return 0
	}
	return v
}

func parseNameAndCode(title string) (string, string) {
	title = strings.TrimSpace(title)
	m := titleCodeRegex.FindStringSubmatch(title)
	if len(m) == 3 {
		return strings.TrimSpace(m[1]), strings.TrimSpace(m[2])
	}
	return title, ""
}

func normalizeCodeByThickness(code string, rows ...map[string]string) string {
	code = strings.TrimSpace(code)
	if code == "" {
		return ""
	}
	thickness := detectThicknessMM(rows...)
	if thickness == 0 {
		return code
	}

	if strings.Contains(code, "6/8") {
		if thickness >= 80 {
			return strings.ReplaceAll(code, "6/8", "8")
		}
		if thickness <= 60 {
			return strings.ReplaceAll(code, "6/8", "6")
		}
	}

	return code
}

func detectThicknessMM(rows ...map[string]string) int {
	for _, row := range rows {
		if row == nil {
			continue
		}
		sources := []string{
			field(row, "Modifications"),
			field(row, "Editions"),
			field(row, "Title"),
			field(row, "Text"),
		}
		for _, src := range sources {
			m := thicknessRegex.FindStringSubmatch(src)
			if len(m) != 2 {
				continue
			}
			if mm, err := strconv.Atoi(strings.TrimSpace(m[1])); err == nil {
				return mm
			}
		}
	}
	return 0
}

func extractCollectionAndColor(row map[string]string) (string, string) {
	if row == nil {
		return "", ""
	}

	sources := []string{
		field(row, "Modifications"),
		field(row, "Editions"),
		field(row, "Title"),
	}

	for _, src := range sources {
		if src == "" {
			continue
		}
		collection := ""
		color := ""
		parts := strings.Split(src, ";")
		for _, p := range parts {
			pp := strings.TrimSpace(strings.Trim(p, `"`))
			if pp == "" {
				continue
			}
			low := strings.ToLower(pp)
			if strings.Contains(low, "коллекция:") {
				collection = strings.TrimSpace(pp[strings.Index(pp, ":")+1:])
			}
			if strings.Contains(low, "цвет:") {
				color = strings.TrimSpace(pp[strings.Index(pp, ":")+1:])
			}
		}
		if collection != "" || color != "" {
			return collection, color
		}

		if strings.Contains(src, " - ") {
			chunks := strings.Split(src, " - ")
			if len(chunks) >= 3 {
				return strings.TrimSpace(chunks[len(chunks)-2]), strings.TrimSpace(chunks[len(chunks)-1])
			}
		}
	}

	return "", ""
}

func detectUnit(text string, isCurb bool) string {
	if isCurb {
		return "шт."
	}
	plain := strings.ToLower(strings.TrimSpace(htmlTagRegex.ReplaceAllString(text, " ")))
	if strings.Contains(plain, "за 1 кв") || strings.Contains(plain, "за 1 м2") || strings.Contains(plain, "за 1 м²") {
		return "кв.м."
	}
	if strings.Contains(plain, "за 1 шт") {
		return "шт."
	}
	if strings.Contains(plain, "за 1 п.м") || strings.Contains(plain, "за 1 м.п") {
		return "п.м."
	}
	return "кв.м."
}

func buildProductFullTitle(name, code, collection, color string, isCurb bool, curbSize string) string {
	name = strings.TrimSpace(name)
	code = strings.TrimSpace(code)
	if name == "" && !isCurb {
		return ""
	}

	if isCurb {
		base := "Бордюр"
		size := strings.TrimSpace(curbSize)
		if size != "" {
			base += " " + size
		} else if name != "" {
			base += " " + name
		}
		if strings.TrimSpace(color) != "" {
			base += " / " + strings.TrimSpace(color)
		}
		base += " (производство «Выбор»)."
		return strings.TrimSpace(base)
	}

	base := fmt.Sprintf(`Тротуарная плитка "%s"`, name)
	if code != "" {
		base += " " + code
	}
	collection = strings.TrimSpace(collection)
	color = strings.TrimSpace(color)
	if collection != "" || color != "" {
		base += ","
		if collection != "" {
			base += " / " + collection
		}
		if color != "" {
			base += " / " + color
		}
	}
	base += " (производство «Выбор»)."
	return strings.TrimSpace(base)
}

func isCurbProduct(name, code string, rows ...map[string]string) bool {
	sources := []string{name, code}
	for _, row := range rows {
		if row == nil {
			continue
		}
		sources = append(sources,
			field(row, "Title"),
			field(row, "Text"),
			field(row, "Modifications"),
			field(row, "Editions"),
		)
	}
	for _, src := range sources {
		low := strings.ToLower(strings.TrimSpace(src))
		if low == "" {
			continue
		}
		if strings.Contains(low, "бордюр") || strings.HasPrefix(low, "бр ") || strings.Contains(low, " бр ") {
			return true
		}
	}
	return false
}

func detectCurbSize(code, title string, rows ...map[string]string) string {
	sources := []string{code, title}
	for _, row := range rows {
		if row == nil {
			continue
		}
		sources = append(sources,
			field(row, "Modifications"),
			field(row, "Editions"),
			field(row, "Title"),
			field(row, "Text"),
		)
	}

	for _, src := range sources {
		m := curbSizeTextRegex.FindStringSubmatch(src)
		if len(m) != 4 {
			continue
		}
		l, errL := strconv.Atoi(strings.TrimSpace(m[1]))
		w, errW := strconv.Atoi(strings.TrimSpace(m[2]))
		h, errH := strconv.Atoi(strings.TrimSpace(m[3]))
		if errL == nil && errW == nil && errH == nil {
			return fmt.Sprintf("%dх%dх%d мм", l, w, h)
		}
	}

	for _, src := range sources {
		m := curbCodeRegex.FindStringSubmatch(src)
		if len(m) != 4 {
			continue
		}
		l, errL := strconv.Atoi(strings.TrimSpace(m[1]))
		w, errW := strconv.Atoi(strings.TrimSpace(m[2]))
		h, errH := strconv.Atoi(strings.TrimSpace(m[3]))
		if errL != nil || errW != nil || errH != nil {
			continue
		}
		if l < 500 {
			l *= 10
		}
		if w < 100 {
			w *= 10
		}
		if h < 50 {
			h *= 10
		}
		return fmt.Sprintf("%dх%dх%d мм", l, w, h)
	}

	return ""
}
