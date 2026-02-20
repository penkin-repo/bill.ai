package database

import (
	"fmt"

	"bill.ai/internal/models"
)

func (d *DB) UpsertClient(c models.Client) error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}

	_, err := d.sql.Exec(`
		INSERT INTO clients (
			id, name, inn, kpp, address, bank_name, bank_bik, bank_account, bank_corr_account,
			contact_person, phone, email, comment, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name,
			inn=excluded.inn,
			kpp=excluded.kpp,
			address=excluded.address,
			bank_name=excluded.bank_name,
			bank_bik=excluded.bank_bik,
			bank_account=excluded.bank_account,
			bank_corr_account=excluded.bank_corr_account,
			contact_person=excluded.contact_person,
			phone=excluded.phone,
			email=excluded.email,
			comment=excluded.comment,
			created_at=excluded.created_at,
			updated_at=excluded.updated_at
	`,
		c.ID,
		c.Name,
		c.INN,
		c.KPP,
		c.Address,
		c.BankName,
		c.BankBIK,
		c.BankAccount,
		c.BankCorrAccount,
		c.ContactPerson,
		c.Phone,
		c.Email,
		c.Comment,
		c.CreatedAt,
		c.UpdatedAt,
	)
	return err
}

func (d *DB) UpsertProduct(p models.Product) error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}

	_, err := d.sql.Exec(`
		INSERT INTO products (
			id, name, category, unit, price, description, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name,
			category=excluded.category,
			unit=excluded.unit,
			price=excluded.price,
			description=excluded.description,
			created_at=excluded.created_at,
			updated_at=excluded.updated_at
	`,
		p.ID,
		p.Name,
		p.Category,
		p.Unit,
		p.Price,
		p.Description,
		p.CreatedAt,
		p.UpdatedAt,
	)
	return err
}

func (d *DB) UpsertMyCompany(c models.MyCompany) error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}

	_, err := d.sql.Exec(`
		INSERT INTO my_companies (
			id, name, short_name, inn, kpp, ogrn, address,
			bank_name, bank_bik, bank_account, bank_corr_account,
			director_name, director_title, phone, email,
			comment
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name,
			short_name=excluded.short_name,
			inn=excluded.inn,
			kpp=excluded.kpp,
			ogrn=excluded.ogrn,
			address=excluded.address,
			bank_name=excluded.bank_name,
			bank_bik=excluded.bank_bik,
			bank_account=excluded.bank_account,
			bank_corr_account=excluded.bank_corr_account,
			director_name=excluded.director_name,
			director_title=excluded.director_title,
			phone=excluded.phone,
			email=excluded.email,
			comment=excluded.comment
	`,
		c.ID,
		c.Name,
		c.ShortName,
		c.INN,
		c.KPP,
		c.OGRN,
		c.Address,
		c.BankName,
		c.BankBIK,
		c.BankAccount,
		c.BankCorrAccount,
		c.DirectorName,
		c.DirectorTitle,
		c.Phone,
		c.Email,
		c.Comment,
	)
	return err
}

func (d *DB) UpsertInvoice(inv models.Invoice) error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}

	_, err := d.sql.Exec(`
		INSERT INTO invoices (
			id, invoice_number, invoice_date, my_company_id, client_id,
			vat_mode, vat_rate, items_json, subtotal, vat_amount, total,
			total_words, comment, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			invoice_number=excluded.invoice_number,
			invoice_date=excluded.invoice_date,
			my_company_id=excluded.my_company_id,
			client_id=excluded.client_id,
			vat_mode=excluded.vat_mode,
			vat_rate=excluded.vat_rate,
			items_json=excluded.items_json,
			subtotal=excluded.subtotal,
			vat_amount=excluded.vat_amount,
			total=excluded.total,
			total_words=excluded.total_words,
			comment=excluded.comment,
			created_at=excluded.created_at,
			updated_at=excluded.updated_at
	`,
		inv.ID,
		inv.InvoiceNumber,
		inv.InvoiceDate,
		inv.MyCompanyID,
		inv.ClientID,
		inv.VatMode,
		inv.VatRate,
		inv.ItemsJSON,
		inv.Subtotal,
		inv.VatAmount,
		inv.Total,
		inv.TotalWords,
		inv.Comment,
		inv.CreatedAt,
		inv.UpdatedAt,
	)
	return err
}
