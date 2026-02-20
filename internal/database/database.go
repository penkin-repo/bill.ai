package database

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

type DB struct {
	sql *sql.DB
}

func New(dbPath string) *DB {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		panic(err)
	}

	return &DB{sql: db}
}

func (d *DB) Close() error {
	if d == nil || d.sql == nil {
		return nil
	}
	return d.sql.Close()
}

func (d *DB) Migrate() error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}

	stmts := []string{
		`CREATE TABLE IF NOT EXISTS clients (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			inn TEXT,
			kpp TEXT,
			address TEXT,
			bank_name TEXT,
			bank_bik TEXT,
			bank_account TEXT,
			bank_corr_account TEXT,
			contact_person TEXT,
			phone TEXT,
			email TEXT,
			comment TEXT,
			created_at TEXT DEFAULT (datetime('now')),
			updated_at TEXT DEFAULT (datetime('now'))
		);`,
		`CREATE TABLE IF NOT EXISTS products (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			category TEXT,
			unit TEXT DEFAULT 'шт',
			price REAL DEFAULT 0,
			description TEXT,
			created_at TEXT DEFAULT (datetime('now')),
			updated_at TEXT DEFAULT (datetime('now'))
		);`,
		`CREATE TABLE IF NOT EXISTS my_companies (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			short_name TEXT,
			inn TEXT,
			kpp TEXT,
			ogrn TEXT,
			address TEXT,
			bank_name TEXT,
			bank_bik TEXT,
			bank_account TEXT,
			bank_corr_account TEXT,
			director_name TEXT,
			director_title TEXT,
			phone TEXT,
			email TEXT,
			comment TEXT,
			stamp_image_path TEXT,
			signature_image_path TEXT
		);`,
		`CREATE TABLE IF NOT EXISTS invoices (
			id TEXT PRIMARY KEY,
			invoice_number TEXT NOT NULL,
			invoice_date TEXT NOT NULL,
			my_company_id TEXT,
			client_id TEXT,
			vat_mode TEXT DEFAULT 'no_vat',
			vat_rate REAL DEFAULT 0,
			items_json TEXT DEFAULT '[]',
			subtotal REAL DEFAULT 0,
			vat_amount REAL DEFAULT 0,
			total REAL DEFAULT 0,
			total_words TEXT,
			comment TEXT,
			created_at TEXT DEFAULT (datetime('now')),
			updated_at TEXT DEFAULT (datetime('now')),
			FOREIGN KEY (my_company_id) REFERENCES my_companies(id),
			FOREIGN KEY (client_id) REFERENCES clients(id)
		);`,
		`CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT
		);`,
		`CREATE TABLE IF NOT EXISTS invoice_templates (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			file_path TEXT NOT NULL,
			vat_mode TEXT NOT NULL,
			is_active INTEGER DEFAULT 1,
			created_at TEXT DEFAULT (datetime('now')),
			updated_at TEXT DEFAULT (datetime('now'))
		);`,
		`CREATE TABLE IF NOT EXISTS client_invoice_templates (
			client_id TEXT NOT NULL,
			template_id TEXT NOT NULL,
			is_default INTEGER DEFAULT 0,
			created_at TEXT DEFAULT (datetime('now')),
			PRIMARY KEY (client_id, template_id),
			FOREIGN KEY (client_id) REFERENCES clients(id),
			FOREIGN KEY (template_id) REFERENCES invoice_templates(id)
		);`,
		`CREATE TABLE IF NOT EXISTS my_company_invoice_templates (
			my_company_id TEXT NOT NULL,
			template_id TEXT NOT NULL,
			is_default INTEGER DEFAULT 0,
			created_at TEXT DEFAULT (datetime('now')),
			PRIMARY KEY (my_company_id, template_id),
			FOREIGN KEY (my_company_id) REFERENCES my_companies(id),
			FOREIGN KEY (template_id) REFERENCES invoice_templates(id)
		);`,
		`CREATE TABLE IF NOT EXISTS sync_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			entity TEXT NOT NULL,
			direction TEXT NOT NULL,
			records_count INTEGER DEFAULT 0,
			status TEXT DEFAULT 'success',
			error_message TEXT,
			synced_at TEXT DEFAULT (datetime('now'))
		);`,
		`CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);`,
		`CREATE INDEX IF NOT EXISTS idx_clients_inn ON clients(inn);`,
		`CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);`,
		`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);`,
		`CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);`,
		`CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);`,
		`CREATE INDEX IF NOT EXISTS idx_invoice_templates_vat_mode ON invoice_templates(vat_mode);`,
		`CREATE INDEX IF NOT EXISTS idx_client_invoice_templates_client ON client_invoice_templates(client_id);`,
		`CREATE INDEX IF NOT EXISTS idx_my_company_invoice_templates_company ON my_company_invoice_templates(my_company_id);`,
	}

	for _, stmt := range stmts {
		if _, err := d.sql.Exec(stmt); err != nil {
			return err
		}
	}

	if _, err := d.sql.Exec(`ALTER TABLE my_companies ADD COLUMN comment TEXT`); err != nil {
		errText := err.Error()
		if !strings.Contains(errText, "duplicate column") {
			return err
		}
	}

	return nil
}

func (d *DB) SeedTestData() error {
	if d == nil || d.sql == nil {
		return fmt.Errorf("db is nil")
	}

	var companiesCount int
	if err := d.sql.QueryRow(`SELECT COUNT(*) FROM my_companies`).Scan(&companiesCount); err != nil {
		return err
	}
	if companiesCount > 0 {
		return nil
	}

	tx, err := d.sql.Begin()
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	now := "2026-02-16 00:00:00"

	company1ID := uuid.NewString()
	company2ID := uuid.NewString()

	_, err = tx.Exec(`
		INSERT INTO my_companies (
			id, name, short_name, inn, kpp, ogrn, address,
			bank_name, bank_bik, bank_account, bank_corr_account,
			director_name, director_title, phone, email,
			comment,
			stamp_image_path, signature_image_path
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		company1ID,
		"ИП Ковальчук Андрей Сергеевич",
		"ИП Ковальчук",
		"667801234567",
		"",
		"",
		"Екатеринбург",
		"Сбербанк",
		"",
		"",
		"",
		"Ковальчук Андрей Сергеевич",
		"Индивидуальный предприниматель",
		"",
		"",
		"",
		"",
		"",
	)
	if err != nil {
		return err
	}

	_, err = tx.Exec(`
		INSERT INTO my_companies (
			id, name, short_name, inn, kpp, ogrn, address,
			bank_name, bank_bik, bank_account, bank_corr_account,
			director_name, director_title, phone, email,
			comment,
			stamp_image_path, signature_image_path
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		company2ID,
		"ООО \"Завод Тротуарной Плитки\"",
		"Завод Плитки",
		"6678054321",
		"667801001",
		"",
		"Екатеринбург",
		"Альфа-Банк",
		"",
		"",
		"",
		"",
		"Директор",
		"",
		"",
		"",
		"",
		"",
	)
	if err != nil {
		return err
	}

	// Products are seeded separately from Products.json via SeedProductsFromJSON (see app.go startup).
	// Clients are added manually or via Google Sheets sync — no test data.

	if _, err := tx.Exec(`INSERT OR REPLACE INTO settings (key, value) VALUES ('last_sync_all', ?)`, now); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	return nil
}
