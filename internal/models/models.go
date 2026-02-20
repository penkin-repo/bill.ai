package models

type Client struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	INN             string `json:"inn"`
	KPP             string `json:"kpp"`
	Address         string `json:"address"`
	BankName        string `json:"bank_name"`
	BankBIK         string `json:"bank_bik"`
	BankAccount     string `json:"bank_account"`
	BankCorrAccount string `json:"bank_corr_account"`
	ContactPerson   string `json:"contact_person"`
	Phone           string `json:"phone"`
	Email           string `json:"email"`
	Comment         string `json:"comment"`
	CreatedAt       string `json:"created_at"`
	UpdatedAt       string `json:"updated_at"`
}

type Product struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Category    string  `json:"category"`
	Unit        string  `json:"unit"`
	Price       float64 `json:"price"`
	Description string  `json:"description"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

type MyCompany struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	ShortName       string `json:"short_name"`
	INN             string `json:"inn"`
	KPP             string `json:"kpp"`
	OGRN            string `json:"ogrn"`
	Address         string `json:"address"`
	BankName        string `json:"bank_name"`
	BankBIK         string `json:"bank_bik"`
	BankAccount     string `json:"bank_account"`
	BankCorrAccount string `json:"bank_corr_account"`
	DirectorName    string `json:"director_name"`
	DirectorTitle   string `json:"director_title"`
	Phone           string `json:"phone"`
	Email           string `json:"email"`
	Comment         string `json:"comment"`
}

type InvoiceItem struct {
	ProductID string  `json:"product_id"`
	Name      string  `json:"name"`
	Unit      string  `json:"unit"`
	Quantity  float64 `json:"quantity"`
	Price     float64 `json:"price"`
	Sum       float64 `json:"sum"`
}

type Invoice struct {
	ID            string  `json:"id"`
	InvoiceNumber string  `json:"invoice_number"`
	InvoiceDate   string  `json:"invoice_date"`
	MyCompanyID   string  `json:"my_company_id"`
	ClientID      string  `json:"client_id"`
	VatMode       string  `json:"vat_mode"`
	VatRate       float64 `json:"vat_rate"`
	ItemsJSON     string  `json:"items_json"`
	Subtotal      float64 `json:"subtotal"`
	VatAmount     float64 `json:"vat_amount"`
	Total         float64 `json:"total"`
	TotalWords    string  `json:"total_words"`
	Comment       string  `json:"comment"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     string  `json:"updated_at"`
}

type InvoiceTemplate struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	FilePath  string `json:"file_path"`
	VatMode   string `json:"vat_mode"`
	IsDefault bool   `json:"is_default"`
	IsActive  bool   `json:"is_active"`
}

type SyncResult struct {
	Entity       string `json:"entity"`
	Downloaded   int    `json:"downloaded"`
	Uploaded     int    `json:"uploaded"`
	Errors       int    `json:"errors"`
	ErrorMessage string `json:"error_message,omitempty"`
	SyncedAt     string `json:"synced_at"`
}
