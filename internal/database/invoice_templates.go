package database

import (
	"fmt"
	"strings"
	"time"

	"bill.ai/internal/models"
)

func (d *DB) UpsertInvoiceTemplate(t models.InvoiceTemplate) error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}
	now := time.Now().Format(time.RFC3339)
	if strings.TrimSpace(t.ID) == "" {
		return fmt.Errorf("template id is empty")
	}
	if strings.TrimSpace(t.Name) == "" {
		return fmt.Errorf("template name is empty")
	}
	if strings.TrimSpace(t.FilePath) == "" {
		return fmt.Errorf("template file path is empty")
	}
	if strings.TrimSpace(t.VatMode) == "" {
		return fmt.Errorf("template vat mode is empty")
	}
	isActive := 0
	if t.IsActive {
		isActive = 1
	}
	_, err := d.sql.Exec(`
		INSERT INTO invoice_templates (id, name, file_path, vat_mode, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name,
			file_path=excluded.file_path,
			vat_mode=excluded.vat_mode,
			is_active=excluded.is_active,
			updated_at=excluded.updated_at
	`, t.ID, t.Name, t.FilePath, t.VatMode, isActive, now, now)
	return err
}

func (d *DB) EnsureDefaultInvoiceTemplates() error {
	return nil
}

func (d *DB) SetMyCompanyInvoiceTemplate(companyID, templateID string, isDefault bool) error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}
	companyID = strings.TrimSpace(companyID)
	templateID = strings.TrimSpace(templateID)
	if companyID == "" {
		return fmt.Errorf("my company id is empty")
	}
	if templateID == "" {
		return fmt.Errorf("template id is empty")
	}

	if isDefault {
		if _, err := d.sql.Exec(`UPDATE my_company_invoice_templates SET is_default = 0 WHERE my_company_id = ?`, companyID); err != nil {
			return err
		}
	}
	def := 0
	if isDefault {
		def = 1
	}
	_, err := d.sql.Exec(`
		INSERT INTO my_company_invoice_templates (my_company_id, template_id, is_default, created_at)
		VALUES (?, ?, ?, datetime('now'))
		ON CONFLICT(my_company_id, template_id) DO UPDATE SET
			is_default=excluded.is_default
	`, companyID, templateID, def)
	return err
}

func (d *DB) RemoveMyCompanyInvoiceTemplate(companyID, templateID string) error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}
	companyID = strings.TrimSpace(companyID)
	templateID = strings.TrimSpace(templateID)
	if companyID == "" {
		return fmt.Errorf("my company id is empty")
	}
	if templateID == "" {
		return fmt.Errorf("template id is empty")
	}
	_, err := d.sql.Exec(`
		DELETE FROM my_company_invoice_templates
		WHERE my_company_id = ? AND template_id = ?
	`, companyID, templateID)
	return err
}

func (d *DB) RemoveMyCompanyTemplateBindings(companyID string) error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}
	companyID = strings.TrimSpace(companyID)
	if companyID == "" {
		return nil
	}
	_, err := d.sql.Exec(`DELETE FROM my_company_invoice_templates WHERE my_company_id = ?`, companyID)
	return err
}

func (d *DB) RemoveClientTemplateBindings(clientID string) error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}
	clientID = strings.TrimSpace(clientID)
	if clientID == "" {
		return nil
	}
	_, err := d.sql.Exec(`DELETE FROM client_invoice_templates WHERE client_id = ?`, clientID)
	return err
}

func (d *DB) ClearTemplateBindings() error {
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

	if _, err := tx.Exec(`DELETE FROM client_invoice_templates`); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM my_company_invoice_templates`); err != nil {
		return err
	}

	return tx.Commit()
}

func (d *DB) EnsureMyCompanyTemplateBootstrap(companyID string) error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}
	companyID = strings.TrimSpace(companyID)
	if companyID == "" {
		return nil
	}
	return nil
}

func (d *DB) GetMyCompanyInvoiceTemplates(companyID string) ([]models.InvoiceTemplate, error) {
	if d == nil || d.sql == nil {
		return nil, fmt.Errorf("db is nil")
	}
	companyID = strings.TrimSpace(companyID)
	if companyID == "" {
		return []models.InvoiceTemplate{}, nil
	}
	rows, err := d.sql.Query(`
		SELECT t.id, t.name, t.file_path, t.vat_mode, t.is_active, cit.is_default
		FROM my_company_invoice_templates cit
		JOIN invoice_templates t ON t.id = cit.template_id
		WHERE cit.my_company_id = ?
		ORDER BY cit.is_default DESC, t.vat_mode, t.name
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.InvoiceTemplate
	for rows.Next() {
		var t models.InvoiceTemplate
		var isActive, isDefault int
		if err := rows.Scan(&t.ID, &t.Name, &t.FilePath, &t.VatMode, &isActive, &isDefault); err != nil {
			return nil, err
		}
		t.IsActive = isActive == 1
		t.IsDefault = isDefault == 1
		out = append(out, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (d *DB) DeleteInvoiceTemplate(templateID string) error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}
	templateID = strings.TrimSpace(templateID)
	if templateID == "" {
		return fmt.Errorf("template id is empty")
	}

	tx, err := d.sql.Begin()
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if _, err := tx.Exec(`DELETE FROM my_company_invoice_templates WHERE template_id = ?`, templateID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM client_invoice_templates WHERE template_id = ?`, templateID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM invoice_templates WHERE id = ?`, templateID); err != nil {
		return err
	}

	return tx.Commit()
}

func (d *DB) GetAllInvoiceTemplates() ([]models.InvoiceTemplate, error) {
	if d == nil || d.sql == nil {
		return nil, fmt.Errorf("db is nil")
	}
	rows, err := d.sql.Query(`
		SELECT id, name, file_path, vat_mode, is_active, 0 as is_default
		FROM invoice_templates
		WHERE is_active = 1
		ORDER BY vat_mode, name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.InvoiceTemplate
	for rows.Next() {
		var t models.InvoiceTemplate
		var isActive, isDefault int
		if err := rows.Scan(&t.ID, &t.Name, &t.FilePath, &t.VatMode, &isActive, &isDefault); err != nil {
			return nil, err
		}
		t.IsActive = isActive == 1
		t.IsDefault = isDefault == 1
		out = append(out, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}
