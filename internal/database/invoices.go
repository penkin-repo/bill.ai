package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"bill.ai/internal/models"
)

type invoiceSearchRow struct {
	inv         models.Invoice
	clientName  string
	companyName string
}

type invoiceSearchFilter struct {
	Text    string `json:"text"`
	Company string `json:"company"`
	Number  string `json:"number"`
}

func parseInvoiceSearchFilter(query string) invoiceSearchFilter {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return invoiceSearchFilter{}
	}

	if strings.HasPrefix(trimmed, "{") {
		var payload invoiceSearchFilter
		if err := json.Unmarshal([]byte(trimmed), &payload); err == nil {
			payload.Text = strings.TrimSpace(payload.Text)
			payload.Company = strings.TrimSpace(payload.Company)
			payload.Number = strings.TrimSpace(payload.Number)
			return payload
		}
	}

	return invoiceSearchFilter{Text: trimmed}
}

func buildInvoiceSearchWords(text string) []string {
	words := strings.Fields(strings.TrimSpace(text))
	if len(words) == 0 {
		return nil
	}
	out := make([]string, 0, len(words))
	for _, w := range words {
		lw := strings.ToLower(strings.TrimSpace(w))
		if lw != "" {
			out = append(out, lw)
		}
	}
	return out
}

func invoiceMatchesQuery(row invoiceSearchRow, filter invoiceSearchFilter, lowerWords []string) bool {
	if filter.Number != "" {
		if !strings.Contains(strings.ToLower(row.inv.InvoiceNumber), strings.ToLower(filter.Number)) {
			return false
		}
	}

	if filter.Company != "" {
		if !strings.Contains(strings.ToLower(row.companyName), strings.ToLower(filter.Company)) {
			return false
		}
	}

	if len(lowerWords) == 0 {
		return filter.Number != "" || filter.Company != "" || strings.TrimSpace(filter.Text) == ""
	}

	hay := strings.ToLower(strings.Join([]string{
		row.inv.InvoiceNumber,
		row.inv.InvoiceDate,
		row.inv.MyCompanyID,
		row.inv.ClientID,
		row.inv.Comment,
		row.clientName,
		row.companyName,
	}, " "))
	for _, lw := range lowerWords {
		if !strings.Contains(hay, lw) {
			return false
		}
	}
	return true
}

func (d *DB) getInvoiceSearchRows() ([]invoiceSearchRow, error) {
	rows, err := d.sql.Query(`
		SELECT i.id, i.invoice_number, i.invoice_date, i.my_company_id, i.client_id,
			i.vat_mode, i.vat_rate, i.items_json, i.subtotal, i.vat_amount, i.total,
			i.total_words, i.comment, i.created_at, i.updated_at,
			COALESCE(c.name, ''),
			TRIM(COALESCE(mc.short_name, '') || ' ' || COALESCE(mc.name, ''))
		FROM invoices i
		LEFT JOIN clients c ON c.id = i.client_id
		LEFT JOIN my_companies mc ON mc.id = i.my_company_id
		ORDER BY i.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]invoiceSearchRow, 0, 128)
	for rows.Next() {
		var inv models.Invoice
		var clientName sql.NullString
		var companyName sql.NullString
		if err := rows.Scan(
			&inv.ID,
			&inv.InvoiceNumber,
			&inv.InvoiceDate,
			&inv.MyCompanyID,
			&inv.ClientID,
			&inv.VatMode,
			&inv.VatRate,
			&inv.ItemsJSON,
			&inv.Subtotal,
			&inv.VatAmount,
			&inv.Total,
			&inv.TotalWords,
			&inv.Comment,
			&inv.CreatedAt,
			&inv.UpdatedAt,
			&clientName,
			&companyName,
		); err != nil {
			return nil, err
		}
		out = append(out, invoiceSearchRow{
			inv:         inv,
			clientName:  clientName.String,
			companyName: companyName.String,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return out, nil
}

func scanInvoiceRow(rows interface{ Scan(dest ...any) error }) (models.Invoice, error) {
	var inv models.Invoice
	err := rows.Scan(
		&inv.ID,
		&inv.InvoiceNumber,
		&inv.InvoiceDate,
		&inv.MyCompanyID,
		&inv.ClientID,
		&inv.VatMode,
		&inv.VatRate,
		&inv.ItemsJSON,
		&inv.Subtotal,
		&inv.VatAmount,
		&inv.Total,
		&inv.TotalWords,
		&inv.Comment,
		&inv.CreatedAt,
		&inv.UpdatedAt,
	)
	return inv, err
}

func (d *DB) GetAllInvoices() ([]models.Invoice, error) {
	if d == nil || d.sql == nil {
		return nil, fmt.Errorf("db is nil")
	}

	rows, err := d.sql.Query(`
		SELECT id, invoice_number, invoice_date, my_company_id, client_id,
			vat_mode, vat_rate, items_json, subtotal, vat_amount, total,
			total_words, comment, created_at, updated_at
		FROM invoices
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.Invoice
	for rows.Next() {
		inv, err := scanInvoiceRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, inv)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (d *DB) CountInvoices(query string) (int, error) {
	if d == nil || d.sql == nil {
		return 0, fmt.Errorf("db is nil")
	}

	filter := parseInvoiceSearchFilter(query)
	lowerWords := buildInvoiceSearchWords(filter.Text)
	rows, err := d.getInvoiceSearchRows()
	if err != nil {
		return 0, err
	}

	count := 0
	for _, row := range rows {
		if invoiceMatchesQuery(row, filter, lowerWords) {
			count++
		}
	}
	return count, nil
}

func (d *DB) SearchInvoices(query string, limit, offset int) ([]models.Invoice, error) {
	if d == nil || d.sql == nil {
		return nil, fmt.Errorf("db is nil")
	}

	filter := parseInvoiceSearchFilter(query)
	lowerWords := buildInvoiceSearchWords(filter.Text)
	rows, err := d.getInvoiceSearchRows()
	if err != nil {
		return nil, err
	}

	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	out := make([]models.Invoice, 0, limit)
	matched := 0
	for _, row := range rows {
		if !invoiceMatchesQuery(row, filter, lowerWords) {
			continue
		}
		if matched < offset {
			matched++
			continue
		}
		if len(out) >= limit {
			break
		}
		out = append(out, row.inv)
		matched++
	}

	return out, nil
}

func (d *DB) ClientExists(id string) (bool, error) {
	if d == nil || d.sql == nil {
		return false, fmt.Errorf("db is nil")
	}
	var count int
	err := d.sql.QueryRow(`SELECT COUNT(*) FROM clients WHERE id = ?`, id).Scan(&count)
	return count > 0, err
}

func (d *DB) MyCompanyExists(id string) (bool, error) {
	if d == nil || d.sql == nil {
		return false, fmt.Errorf("db is nil")
	}
	var count int
	err := d.sql.QueryRow(`SELECT COUNT(*) FROM my_companies WHERE id = ?`, id).Scan(&count)
	return count > 0, err
}

func (d *DB) InvoiceExists(id string) (bool, error) {
	if d == nil || d.sql == nil {
		return false, fmt.Errorf("db is nil")
	}
	var count int
	err := d.sql.QueryRow(`SELECT COUNT(*) FROM invoices WHERE id = ?`, id).Scan(&count)
	return count > 0, err
}

func (d *DB) ClearClients() error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}
	_, err := d.sql.Exec(`DELETE FROM clients`)
	return err
}

func (d *DB) ClearMyCompanies() error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}
	_, err := d.sql.Exec(`DELETE FROM my_companies`)
	return err
}

func (d *DB) ClearInvoices() error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}
	_, err := d.sql.Exec(`DELETE FROM invoices`)
	return err
}

func (d *DB) DeleteInvoice(id string) error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}
	_, err := d.sql.Exec(`DELETE FROM invoices WHERE id = ?`, strings.TrimSpace(id))
	return err
}

func parseInvoiceNumber(raw string) (int, bool) {
	n := strings.TrimSpace(raw)
	if n == "" {
		return 0, false
	}
	v, err := strconv.Atoi(n)
	if err != nil {
		return 0, false
	}
	return v, true
}

// GetNextInvoiceNumberForCompany returns the next invoice number for a company.
// Rule: use the latest invoice date for this company; inside that date use max numeric invoice number + 1.
// Fallback: if latest-date invoices contain no numeric numbers, use global max numeric number for this company + 1.
func (d *DB) GetNextInvoiceNumberForCompany(companyID string) (string, error) {
	if d == nil || d.sql == nil {
		return "", fmt.Errorf("db is nil")
	}
	companyID = strings.TrimSpace(companyID)
	if companyID == "" {
		return "1", nil
	}

	rows, err := d.sql.Query(`
		SELECT invoice_date, invoice_number
		FROM invoices
		WHERE my_company_id = ?
		ORDER BY invoice_date DESC, created_at DESC
	`, companyID)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	firstDate := ""
	latestDateMax := 0
	hasLatestDateNumeric := false
	globalMax := 0
	hasAnyNumeric := false

	for rows.Next() {
		var invoiceDate, invoiceNumber string
		if err := rows.Scan(&invoiceDate, &invoiceNumber); err != nil {
			return "", err
		}
		if firstDate == "" {
			firstDate = invoiceDate
		}
		v, ok := parseInvoiceNumber(invoiceNumber)
		if !ok {
			continue
		}
		hasAnyNumeric = true
		if v > globalMax {
			globalMax = v
		}
		if invoiceDate == firstDate {
			hasLatestDateNumeric = true
			if v > latestDateMax {
				latestDateMax = v
			}
		}
	}
	if err := rows.Err(); err != nil {
		return "", err
	}

	if hasLatestDateNumeric {
		return strconv.Itoa(latestDateMax + 1), nil
	}
	if hasAnyNumeric {
		return strconv.Itoa(globalMax + 1), nil
	}
	return "1", nil
}
