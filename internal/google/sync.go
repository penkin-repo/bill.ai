package google

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"bill.ai/internal/database"
	"bill.ai/internal/models"
)

// ---------------------------------------------------------------------------
// Header definitions — these MUST match the Google Sheets column names (row 1).
// ---------------------------------------------------------------------------

var clientHeaders = []string{
	"id", "name", "inn", "kpp", "address",
	"bank_name", "bank_bik", "bank_account", "bank_corr_account",
	"contact_person", "phone", "email", "comment",
}

var companyHeaders = []string{
	"id", "name", "short_name", "inn", "kpp", "ogrn", "address",
	"bank_name", "bank_bik", "bank_account", "bank_corr_account",
	"director_name", "director_title", "phone", "email",
	"comment",
}

var invoiceHeaders = []string{
	"id", "date", "client", "my_company_name", "sum, rub", "comment", "technical_json",
}

// ---------------------------------------------------------------------------
// Header-based row parsing helpers
// ---------------------------------------------------------------------------

// headerIndex builds a map[columnName]->colIndex from the first row of a sheet.
func headerIndex(headerRow []interface{}) map[string]int {
	m := make(map[string]int, len(headerRow))
	for i, cell := range headerRow {
		name := strings.TrimSpace(strings.ToLower(fmt.Sprintf("%v", cell)))
		if name != "" {
			m[name] = i
		}
	}
	return m
}

func hStr(row []interface{}, idx map[string]int, key string) string {
	i, ok := idx[key]
	if !ok {
		return ""
	}
	return cellString(row, i)
}

func hFloat(row []interface{}, idx map[string]int, key string) float64 {
	s := hStr(row, idx, key)
	if s == "" {
		return 0
	}
	cleaned := strings.TrimSpace(strings.ReplaceAll(s, ",", "."))
	f, err := strconv.ParseFloat(cleaned, 64)
	if err != nil {
		return 0
	}
	return f
}

// ---------------------------------------------------------------------------
// Row → Model (header-based)
// ---------------------------------------------------------------------------

func clientFromRow(row []interface{}, h map[string]int) models.Client {
	return models.Client{
		ID:              hStr(row, h, "id"),
		Name:            hStr(row, h, "name"),
		INN:             hStr(row, h, "inn"),
		KPP:             hStr(row, h, "kpp"),
		Address:         hStr(row, h, "address"),
		BankName:        hStr(row, h, "bank_name"),
		BankBIK:         hStr(row, h, "bank_bik"),
		BankAccount:     hStr(row, h, "bank_account"),
		BankCorrAccount: hStr(row, h, "bank_corr_account"),
		ContactPerson:   hStr(row, h, "contact_person"),
		Phone:           hStr(row, h, "phone"),
		Email:           hStr(row, h, "email"),
		Comment:         hStr(row, h, "comment"),
	}
}

func companyFromRow(row []interface{}, h map[string]int) models.MyCompany {
	return models.MyCompany{
		ID:              hStr(row, h, "id"),
		Name:            hStr(row, h, "name"),
		ShortName:       hStr(row, h, "short_name"),
		INN:             hStr(row, h, "inn"),
		KPP:             hStr(row, h, "kpp"),
		OGRN:            hStr(row, h, "ogrn"),
		Address:         hStr(row, h, "address"),
		BankName:        hStr(row, h, "bank_name"),
		BankBIK:         hStr(row, h, "bank_bik"),
		BankAccount:     hStr(row, h, "bank_account"),
		BankCorrAccount: hStr(row, h, "bank_corr_account"),
		DirectorName:    hStr(row, h, "director_name"),
		DirectorTitle:   hStr(row, h, "director_title"),
		Phone:           hStr(row, h, "phone"),
		Email:           hStr(row, h, "email"),
		Comment:         hStr(row, h, "comment"),
	}
}

func invoiceFromRow(row []interface{}, h map[string]int, clientNameToID map[string]string, companyNameToID map[string]string) (models.Invoice, string, string) {
	id := strings.TrimSpace(hStr(row, h, "id"))
	if id == "" {
		id = strings.TrimSpace(hStr(row, h, "invoice_number"))
	}
	date := strings.TrimSpace(hStr(row, h, "date"))
	if date == "" {
		date = strings.TrimSpace(hStr(row, h, "invoice_date"))
	}
	clientName := strings.TrimSpace(hStr(row, h, "client"))
	companyName := strings.TrimSpace(hStr(row, h, "my_company_name"))
	comment := hStr(row, h, "comment")
	total := hFloat(row, h, "sum, rub")
	if total == 0 {
		total = hFloat(row, h, "total")
	}

	technicalJSON := strings.TrimSpace(hStr(row, h, "technical_json"))
	if technicalJSON != "" {
		var inv models.Invoice
		if err := json.Unmarshal([]byte(technicalJSON), &inv); err == nil {
			if inv.ID == "" {
				inv.ID = id
			}
			if inv.InvoiceNumber == "" {
				inv.InvoiceNumber = inv.ID
			}
			if inv.InvoiceDate == "" {
				inv.InvoiceDate = date
			}
			if inv.Comment == "" {
				inv.Comment = comment
			}
			if inv.Total == 0 {
				inv.Total = total
			}
			if inv.Subtotal == 0 {
				inv.Subtotal = inv.Total
			}
			if inv.ClientID == "" && clientName != "" {
				inv.ClientID = clientNameToID[strings.ToLower(clientName)]
			}
			if inv.MyCompanyID == "" && companyName != "" {
				inv.MyCompanyID = companyNameToID[strings.ToLower(companyName)]
			}
			return ensureInvoiceDefaults(inv), clientName, companyName
		}
	}

	clientID := ""
	if clientName != "" {
		clientID = clientNameToID[strings.ToLower(clientName)]
	}

	companyID := ""
	if companyName != "" {
		companyID = companyNameToID[strings.ToLower(companyName)]
	}

	inv := models.Invoice{
		ID:            id,
		InvoiceNumber: id,
		InvoiceDate:   date,
		MyCompanyID:   companyID,
		ClientID:      clientID,
		VatMode:       "none",
		VatRate:       0,
		ItemsJSON:     "[]",
		Subtotal:      total,
		VatAmount:     0,
		Total:         total,
		TotalWords:    "",
		Comment:       comment,
	}
	return ensureInvoiceDefaults(inv), clientName, companyName
}

// ---------------------------------------------------------------------------
// Model → Row (for upload)
// ---------------------------------------------------------------------------

func clientToRow(c models.Client) []interface{} {
	return []interface{}{
		c.ID, c.Name, c.INN, c.KPP, c.Address,
		c.BankName, c.BankBIK, c.BankAccount, c.BankCorrAccount,
		c.ContactPerson, c.Phone, c.Email, c.Comment,
	}
}

func companyToRow(c models.MyCompany) []interface{} {
	return []interface{}{
		c.ID, c.Name, c.ShortName, c.INN, c.KPP, c.OGRN, c.Address,
		c.BankName, c.BankBIK, c.BankAccount, c.BankCorrAccount,
		c.DirectorName, c.DirectorTitle, c.Phone, c.Email,
		c.Comment,
	}
}

func invoiceToRow(inv models.Invoice, clientName, companyName string) []interface{} {
	inv = ensureInvoiceDefaults(inv)
	technicalJSON := invoiceTechnicalJSON(inv)
	return []interface{}{
		inv.ID,
		inv.InvoiceDate,
		clientName,
		companyName,
		inv.Total,
		inv.Comment,
		technicalJSON,
	}
}

func ensureInvoiceDefaults(inv models.Invoice) models.Invoice {
	if strings.TrimSpace(inv.InvoiceNumber) == "" {
		inv.InvoiceNumber = strings.TrimSpace(inv.ID)
	}
	if strings.TrimSpace(inv.ID) == "" {
		inv.ID = strings.TrimSpace(inv.InvoiceNumber)
	}
	now := time.Now().Format(time.RFC3339)
	if strings.TrimSpace(inv.CreatedAt) == "" {
		inv.CreatedAt = now
	}
	if strings.TrimSpace(inv.UpdatedAt) == "" {
		inv.UpdatedAt = now
	}
	if strings.TrimSpace(inv.ItemsJSON) == "" {
		inv.ItemsJSON = "[]"
	}
	return inv
}

func invoiceTechnicalJSON(inv models.Invoice) string {
	b, err := json.Marshal(inv)
	if err != nil {
		return ""
	}
	return string(b)
}

func loadClientMaps(clients []models.Client) (map[string]string, map[string]string) {
	idToName := make(map[string]string, len(clients))
	nameToID := make(map[string]string, len(clients))
	for _, c := range clients {
		name := strings.TrimSpace(c.Name)
		if name != "" {
			idToName[c.ID] = name
			nameToID[strings.ToLower(name)] = c.ID
		}
	}
	return idToName, nameToID
}

func (s *SyncService) ensureInvoiceLinks(
	inv *models.Invoice,
	clientName, companyName string,
	clientNameToID map[string]string,
	companyNameToID map[string]string,
) error {
	if inv == nil {
		return nil
	}

	clientName = strings.TrimSpace(clientName)
	if inv.ClientID == "" && clientName != "" {
		if id := strings.TrimSpace(clientNameToID[strings.ToLower(clientName)]); id != "" {
			inv.ClientID = id
		} else {
			c := models.Client{ID: clientName, Name: clientName, INN: clientName}
			if err := s.db.UpsertClient(c); err != nil {
				return err
			}
			inv.ClientID = c.ID
			clientNameToID[strings.ToLower(clientName)] = c.ID
		}
	}

	companyName = strings.TrimSpace(companyName)
	if inv.MyCompanyID == "" && companyName != "" {
		if id := strings.TrimSpace(companyNameToID[strings.ToLower(companyName)]); id != "" {
			inv.MyCompanyID = id
		} else {
			mc := models.MyCompany{ID: companyName, Name: companyName, ShortName: companyName, INN: companyName}
			if err := s.db.UpsertMyCompany(mc); err != nil {
				return err
			}
			inv.MyCompanyID = mc.ID
			companyNameToID[strings.ToLower(companyName)] = mc.ID
		}
	}

	return nil
}

func loadCompanyMaps(companies []models.MyCompany) (map[string]string, map[string]string) {
	idToName := make(map[string]string, len(companies))
	nameToID := make(map[string]string, len(companies))
	for _, c := range companies {
		name := strings.TrimSpace(c.ShortName)
		if name == "" {
			name = strings.TrimSpace(c.Name)
		}
		if name != "" {
			idToName[c.ID] = name
			nameToID[strings.ToLower(name)] = c.ID
		}
	}
	return idToName, nameToID
}

func headersToRow(h []string) []interface{} {
	row := make([]interface{}, len(h))
	for i, v := range h {
		row[i] = v
	}
	return row
}

// ---------------------------------------------------------------------------
// readSheetWithHeaders reads a sheet and returns header index + data rows (skip row 1).
// ---------------------------------------------------------------------------

func readSheetWithHeaders(sc *SheetsClient, sheetID, sheetName string) (map[string]int, [][]interface{}, error) {
	rows, err := sc.ReadRange(sheetID, sheetName+"!A1:ZZ")
	if err != nil {
		return nil, nil, err
	}
	if len(rows) == 0 {
		return nil, nil, nil
	}
	h := headerIndex(rows[0])
	data := rows[1:]
	return h, data, nil
}

// writeFullSheet clears the sheet and writes header + all data rows.
func writeFullSheet(sc *SheetsClient, sheetID, sheetName string, headers []string, dataRows [][]interface{}) error {
	if err := sc.ClearRange(sheetID, sheetName+"!A1:ZZ"); err != nil {
		return fmt.Errorf("clear %s: %w", sheetName, err)
	}
	all := make([][]interface{}, 0, 1+len(dataRows))
	all = append(all, headersToRow(headers))
	all = append(all, dataRows...)
	if err := sc.UpdateRange(sheetID, sheetName+"!A1", all); err != nil {
		return fmt.Errorf("write %s: %w", sheetName, err)
	}
	return nil
}

// ---------------------------------------------------------------------------
// SyncService
// ---------------------------------------------------------------------------

type SyncService struct {
	db *database.DB
}

func NewSyncService(db *database.DB) *SyncService {
	return &SyncService{db: db}
}

// ---------------------------------------------------------------------------
// SyncAll — local-first: upload all local → download only NEW from Google
// ---------------------------------------------------------------------------

func (s *SyncService) SyncAll(sheetID, serviceKey string) ([]models.SyncResult, error) {
	sc, err := NewSheetsClient(serviceKey)
	if err != nil {
		return nil, err
	}

	var results []models.SyncResult

	r := s.syncClients(sc, sheetID)
	results = append(results, r)

	r = s.syncCompanies(sc, sheetID)
	results = append(results, r)

	r = s.syncInvoices(sc, sheetID)
	results = append(results, r)

	return results, nil
}

func (s *SyncService) syncClients(sc *SheetsClient, sheetID string) models.SyncResult {
	entity := "clients"

	// 1. Upload all local clients to Google (append new ones)
	localClients, err := s.db.GetAllClients()
	if err != nil {
		_ = s.db.LogSync(entity, "upload", 0, "error", err.Error())
		return models.SyncResult{Entity: entity, Errors: 1, ErrorMessage: err.Error()}
	}

	h, dataRows, err := readSheetWithHeaders(sc, sheetID, "Clients")
	if err != nil {
		_ = s.db.LogSync(entity, "download", 0, "error", err.Error())
		return models.SyncResult{Entity: entity, Errors: 1, ErrorMessage: err.Error()}
	}

	// Build set of IDs already in Google
	googleIDs := make(map[string]bool)
	if h != nil {
		for _, row := range dataRows {
			id := hStr(row, h, "id")
			if id != "" {
				googleIDs[id] = true
			}
		}
	}

	// Upload local clients not yet in Google
	uploaded := 0
	for _, c := range localClients {
		if googleIDs[c.ID] {
			continue
		}
		if err := sc.AppendRow(sheetID, "Clients", clientToRow(c)); err != nil {
			_ = s.db.LogSync(entity, "upload", uploaded, "error", err.Error())
			return models.SyncResult{Entity: entity, Uploaded: uploaded, Errors: 1, ErrorMessage: err.Error()}
		}
		uploaded++
	}

	// 2. Download new clients from Google (not in local DB)
	downloaded := 0
	if h != nil {
		for _, row := range dataRows {
			c := clientFromRow(row, h)
			if c.ID == "" {
				continue
			}
			exists, _ := s.db.ClientExists(c.ID)
			if exists {
				continue
			}
			if err := s.db.UpsertClient(c); err != nil {
				_ = s.db.LogSync(entity, "download", downloaded, "error", err.Error())
				return models.SyncResult{Entity: entity, Uploaded: uploaded, Downloaded: downloaded, Errors: 1, ErrorMessage: err.Error()}
			}
			downloaded++
		}
	}

	_ = s.db.LogSync(entity, "sync", uploaded+downloaded, "success", "")
	return models.SyncResult{Entity: entity, Uploaded: uploaded, Downloaded: downloaded}
}

func (s *SyncService) syncCompanies(sc *SheetsClient, sheetID string) models.SyncResult {
	entity := "my_companies"

	localCompanies, err := s.db.GetAllMyCompanies()
	if err != nil {
		_ = s.db.LogSync(entity, "upload", 0, "error", err.Error())
		return models.SyncResult{Entity: entity, Errors: 1, ErrorMessage: err.Error()}
	}

	h, dataRows, err := readSheetWithHeaders(sc, sheetID, "MyCompanies")
	if err != nil {
		_ = s.db.LogSync(entity, "download", 0, "error", err.Error())
		return models.SyncResult{Entity: entity, Errors: 1, ErrorMessage: err.Error()}
	}

	googleIDs := make(map[string]bool)
	if h != nil {
		for _, row := range dataRows {
			id := hStr(row, h, "id")
			if id != "" {
				googleIDs[id] = true
			}
		}
	}

	uploaded := 0
	for _, c := range localCompanies {
		if googleIDs[c.ID] {
			continue
		}
		if err := sc.AppendRow(sheetID, "MyCompanies", companyToRow(c)); err != nil {
			_ = s.db.LogSync(entity, "upload", uploaded, "error", err.Error())
			return models.SyncResult{Entity: entity, Uploaded: uploaded, Errors: 1, ErrorMessage: err.Error()}
		}
		uploaded++
	}

	downloaded := 0
	if h != nil {
		for _, row := range dataRows {
			c := companyFromRow(row, h)
			if c.ID == "" {
				continue
			}
			exists, _ := s.db.MyCompanyExists(c.ID)
			if exists {
				continue
			}
			if err := s.db.UpsertMyCompany(c); err != nil {
				_ = s.db.LogSync(entity, "download", downloaded, "error", err.Error())
				return models.SyncResult{Entity: entity, Uploaded: uploaded, Downloaded: downloaded, Errors: 1, ErrorMessage: err.Error()}
			}
			downloaded++
		}
	}

	_ = s.db.LogSync(entity, "sync", uploaded+downloaded, "success", "")
	return models.SyncResult{Entity: entity, Uploaded: uploaded, Downloaded: downloaded}
}

func (s *SyncService) syncInvoices(sc *SheetsClient, sheetID string) models.SyncResult {
	entity := "invoices"

	localInvoices, err := s.db.GetAllInvoices()
	if err != nil {
		_ = s.db.LogSync(entity, "upload", 0, "error", err.Error())
		return models.SyncResult{Entity: entity, Errors: 1, ErrorMessage: err.Error()}
	}

	h, dataRows, err := readSheetWithHeaders(sc, sheetID, "Invoices")
	if err != nil {
		_ = s.db.LogSync(entity, "download", 0, "error", err.Error())
		return models.SyncResult{Entity: entity, Errors: 1, ErrorMessage: err.Error()}
	}

	allClients, err := s.db.GetAllClients()
	if err != nil {
		_ = s.db.LogSync(entity, "upload", 0, "error", err.Error())
		return models.SyncResult{Entity: entity, Errors: 1, ErrorMessage: err.Error()}
	}
	clientIDToName, clientNameToID := loadClientMaps(allClients)
	allCompanies, err := s.db.GetAllMyCompanies()
	if err != nil {
		_ = s.db.LogSync(entity, "upload", 0, "error", err.Error())
		return models.SyncResult{Entity: entity, Errors: 1, ErrorMessage: err.Error()}
	}
	companyIDToName, companyNameToID := loadCompanyMaps(allCompanies)

	if h == nil {
		invoiceRows := make([][]interface{}, 0, len(localInvoices))
		for _, inv := range localInvoices {
			invoiceRows = append(invoiceRows, invoiceToRow(inv, clientIDToName[inv.ClientID], companyIDToName[inv.MyCompanyID]))
		}
		if err := writeFullSheet(sc, sheetID, "Invoices", invoiceHeaders, invoiceRows); err != nil {
			_ = s.db.LogSync(entity, "upload", 0, "error", err.Error())
			return models.SyncResult{Entity: entity, Errors: 1, ErrorMessage: err.Error()}
		}
		uploaded := len(invoiceRows)
		_ = s.db.LogSync(entity, "sync", uploaded, "success", "")
		return models.SyncResult{Entity: entity, Uploaded: uploaded, Downloaded: 0}
	}

	googleIDs := make(map[string]bool)
	if h != nil {
		for _, row := range dataRows {
			id := hStr(row, h, "id")
			if id != "" {
				googleIDs[id] = true
			}
		}
	}

	uploaded := 0
	for _, inv := range localInvoices {
		if googleIDs[inv.ID] {
			continue
		}
		if err := sc.AppendRow(sheetID, "Invoices", invoiceToRow(inv, clientIDToName[inv.ClientID], companyIDToName[inv.MyCompanyID])); err != nil {
			_ = s.db.LogSync(entity, "upload", uploaded, "error", err.Error())
			return models.SyncResult{Entity: entity, Uploaded: uploaded, Errors: 1, ErrorMessage: err.Error()}
		}
		uploaded++
	}

	downloaded := 0
	if h != nil {
		for _, row := range dataRows {
			inv, clientName, companyName := invoiceFromRow(row, h, clientNameToID, companyNameToID)
			if inv.ID == "" {
				continue
			}
			if err := s.ensureInvoiceLinks(&inv, clientName, companyName, clientNameToID, companyNameToID); err != nil {
				_ = s.db.LogSync(entity, "download", downloaded, "error", err.Error())
				return models.SyncResult{Entity: entity, Uploaded: uploaded, Downloaded: downloaded, Errors: 1, ErrorMessage: err.Error()}
			}
			exists, _ := s.db.InvoiceExists(inv.ID)
			if exists {
				continue
			}
			if err := s.db.UpsertInvoice(inv); err != nil {
				_ = s.db.LogSync(entity, "download", downloaded, "error", err.Error())
				return models.SyncResult{Entity: entity, Uploaded: uploaded, Downloaded: downloaded, Errors: 1, ErrorMessage: err.Error()}
			}
			downloaded++
		}
	}

	_ = s.db.LogSync(entity, "sync", uploaded+downloaded, "success", "")
	return models.SyncResult{Entity: entity, Uploaded: uploaded, Downloaded: downloaded}
}

// ---------------------------------------------------------------------------
// ForceUploadToGoogle — перезаписать ВСЮ Google таблицу локальными данными
// ---------------------------------------------------------------------------

func (s *SyncService) ForceUploadToGoogle(sheetID, serviceKey string) error {
	sc, err := NewSheetsClient(serviceKey)
	if err != nil {
		return err
	}

	// Clients
	clients, err := s.db.GetAllClients()
	if err != nil {
		return fmt.Errorf("read local clients: %w", err)
	}
	clientRows := make([][]interface{}, 0, len(clients))
	for _, c := range clients {
		clientRows = append(clientRows, clientToRow(c))
	}
	if err := writeFullSheet(sc, sheetID, "Clients", clientHeaders, clientRows); err != nil {
		return err
	}

	// MyCompanies
	companies, err := s.db.GetAllMyCompanies()
	if err != nil {
		return fmt.Errorf("read local companies: %w", err)
	}
	companyRows := make([][]interface{}, 0, len(companies))
	for _, c := range companies {
		companyRows = append(companyRows, companyToRow(c))
	}
	if err := writeFullSheet(sc, sheetID, "MyCompanies", companyHeaders, companyRows); err != nil {
		return err
	}
	clientIDToName, _ := loadClientMaps(clients)
	companyIDToName, _ := loadCompanyMaps(companies)

	// Invoices
	invoices, err := s.db.GetAllInvoices()
	if err != nil {
		return fmt.Errorf("read local invoices: %w", err)
	}
	invoiceRows := make([][]interface{}, 0, len(invoices))
	for _, inv := range invoices {
		invoiceRows = append(invoiceRows, invoiceToRow(inv, clientIDToName[inv.ClientID], companyIDToName[inv.MyCompanyID]))
	}
	if err := writeFullSheet(sc, sheetID, "Invoices", invoiceHeaders, invoiceRows); err != nil {
		return err
	}

	_ = s.db.LogSync("all", "force_upload", len(clients)+len(companies)+len(invoices), "success", "")
	return nil
}

// ---------------------------------------------------------------------------
// ForceDownloadFromGoogle — перезаписать ВСЮ локальную базу данными из Google
// ---------------------------------------------------------------------------

func (s *SyncService) ForceDownloadFromGoogle(sheetID, serviceKey string) error {
	sc, err := NewSheetsClient(serviceKey)
	if err != nil {
		return err
	}

	// Clear dependent local tables first to avoid FK constraint failures.
	if err := s.db.ClearInvoices(); err != nil {
		return fmt.Errorf("clear local invoices: %w", err)
	}
	if err := s.db.ClearTemplateBindings(); err != nil {
		return fmt.Errorf("clear local template bindings: %w", err)
	}

	// Clients
	if err := s.db.ClearClients(); err != nil {
		return fmt.Errorf("clear local clients: %w", err)
	}
	h, dataRows, err := readSheetWithHeaders(sc, sheetID, "Clients")
	if err != nil {
		return fmt.Errorf("read Google Clients: %w", err)
	}
	clientCount := 0
	if h != nil {
		for _, row := range dataRows {
			c := clientFromRow(row, h)
			if c.ID == "" {
				continue
			}
			if err := s.db.UpsertClient(c); err != nil {
				return fmt.Errorf("upsert client %s: %w", c.ID, err)
			}
			clientCount++
		}
	}

	// MyCompanies
	if err := s.db.ClearMyCompanies(); err != nil {
		return fmt.Errorf("clear local companies: %w", err)
	}
	h, dataRows, err = readSheetWithHeaders(sc, sheetID, "MyCompanies")
	if err != nil {
		return fmt.Errorf("read Google MyCompanies: %w", err)
	}
	companyCount := 0
	if h != nil {
		for _, row := range dataRows {
			c := companyFromRow(row, h)
			if c.ID == "" {
				continue
			}
			if err := s.db.UpsertMyCompany(c); err != nil {
				return fmt.Errorf("upsert company %s: %w", c.ID, err)
			}
			companyCount++
		}
	}

	// Invoices
	h, dataRows, err = readSheetWithHeaders(sc, sheetID, "Invoices")
	if err != nil {
		return fmt.Errorf("read Google Invoices: %w", err)
	}
	allClients, err := s.db.GetAllClients()
	if err != nil {
		return fmt.Errorf("read local clients: %w", err)
	}
	_, clientNameToID := loadClientMaps(allClients)
	allCompanies, err := s.db.GetAllMyCompanies()
	if err != nil {
		return fmt.Errorf("read local companies: %w", err)
	}
	_, companyNameToID := loadCompanyMaps(allCompanies)
	invoiceCount := 0
	if h != nil {
		for _, row := range dataRows {
			inv, clientName, companyName := invoiceFromRow(row, h, clientNameToID, companyNameToID)
			if inv.ID == "" {
				continue
			}
			if err := s.ensureInvoiceLinks(&inv, clientName, companyName, clientNameToID, companyNameToID); err != nil {
				return fmt.Errorf("resolve invoice links %s: %w", inv.ID, err)
			}
			if err := s.db.UpsertInvoice(inv); err != nil {
				return fmt.Errorf("upsert invoice %s: %w", inv.ID, err)
			}
			invoiceCount++
		}
	}

	_ = s.db.LogSync("all", "force_download", clientCount+companyCount+invoiceCount, "success", "")
	return nil
}

// ---------------------------------------------------------------------------
// Legacy single-record upload helpers (used by UpsertClient etc. in app.go)
// ---------------------------------------------------------------------------

func (s *SyncService) UploadClient(sheetID, serviceKey string, c models.Client) error {
	sc, err := NewSheetsClient(serviceKey)
	if err != nil {
		return err
	}

	h, dataRows, err := readSheetWithHeaders(sc, sheetID, "Clients")
	if err != nil {
		return err
	}

	if h == nil {
		return writeFullSheet(sc, sheetID, "Clients", clientHeaders, [][]interface{}{clientToRow(c)})
	}

	idCol, ok := h["id"]
	if !ok {
		return fmt.Errorf("Clients sheet must contain 'id' header")
	}

	for i, row := range dataRows {
		if strings.TrimSpace(cellString(row, idCol)) != strings.TrimSpace(c.ID) {
			continue
		}
		rowNumber := i + 2 // +1 for header, +1 for 1-based sheets row index
		return sc.UpdateRange(sheetID, fmt.Sprintf("Clients!A%d", rowNumber), [][]interface{}{clientToRow(c)})
	}

	return sc.AppendRow(sheetID, "Clients", clientToRow(c))
}

func (s *SyncService) DeleteClient(sheetID, serviceKey, clientID string) error {
	sc, err := NewSheetsClient(serviceKey)
	if err != nil {
		return err
	}
	h, dataRows, err := readSheetWithHeaders(sc, sheetID, "Clients")
	if err != nil {
		return err
	}
	if h == nil {
		return nil
	}
	idCol, ok := h["id"]
	if !ok {
		return fmt.Errorf("Clients sheet must contain 'id' header")
	}
	want := strings.TrimSpace(clientID)
	for i, row := range dataRows {
		if strings.TrimSpace(cellString(row, idCol)) != want {
			continue
		}
		rowNumber := i + 2
		return sc.ClearRange(sheetID, fmt.Sprintf("Clients!A%d:ZZ%d", rowNumber, rowNumber))
	}
	return nil
}

func (s *SyncService) UploadMyCompany(sheetID, serviceKey string, c models.MyCompany) error {
	sc, err := NewSheetsClient(serviceKey)
	if err != nil {
		return err
	}

	h, dataRows, err := readSheetWithHeaders(sc, sheetID, "MyCompanies")
	if err != nil {
		return err
	}

	if h == nil {
		return writeFullSheet(sc, sheetID, "MyCompanies", companyHeaders, [][]interface{}{companyToRow(c)})
	}

	idCol, ok := h["id"]
	if !ok {
		return fmt.Errorf("MyCompanies sheet must contain 'id' header")
	}

	for i, row := range dataRows {
		if strings.TrimSpace(cellString(row, idCol)) != strings.TrimSpace(c.ID) {
			continue
		}
		rowNumber := i + 2
		return sc.UpdateRange(sheetID, fmt.Sprintf("MyCompanies!A%d", rowNumber), [][]interface{}{companyToRow(c)})
	}

	return sc.AppendRow(sheetID, "MyCompanies", companyToRow(c))
}

func (s *SyncService) DeleteMyCompany(sheetID, serviceKey, companyID string) error {
	sc, err := NewSheetsClient(serviceKey)
	if err != nil {
		return err
	}
	h, dataRows, err := readSheetWithHeaders(sc, sheetID, "MyCompanies")
	if err != nil {
		return err
	}
	if h == nil {
		return nil
	}
	idCol, ok := h["id"]
	if !ok {
		return fmt.Errorf("MyCompanies sheet must contain 'id' header")
	}
	want := strings.TrimSpace(companyID)
	for i, row := range dataRows {
		if strings.TrimSpace(cellString(row, idCol)) != want {
			continue
		}
		rowNumber := i + 2
		return sc.ClearRange(sheetID, fmt.Sprintf("MyCompanies!A%d:ZZ%d", rowNumber, rowNumber))
	}
	return nil
}

func (s *SyncService) UploadInvoice(sheetID, serviceKey string, inv models.Invoice) error {
	sc, err := NewSheetsClient(serviceKey)
	if err != nil {
		return err
	}

	clients, err := s.db.GetAllClients()
	if err != nil {
		return err
	}
	clientIDToName, _ := loadClientMaps(clients)
	companies, err := s.db.GetAllMyCompanies()
	if err != nil {
		return err
	}
	companyIDToName, _ := loadCompanyMaps(companies)

	h, dataRows, err := readSheetWithHeaders(sc, sheetID, "Invoices")
	if err != nil {
		return err
	}

	if h == nil {
		return writeFullSheet(sc, sheetID, "Invoices", invoiceHeaders, [][]interface{}{invoiceToRow(inv, clientIDToName[inv.ClientID], companyIDToName[inv.MyCompanyID])})
	}

	idCol, ok := h["id"]
	if !ok {
		return fmt.Errorf("Invoices sheet must contain 'id' header")
	}

	for i, row := range dataRows {
		if strings.TrimSpace(cellString(row, idCol)) != strings.TrimSpace(inv.ID) {
			continue
		}
		rowNumber := i + 2
		return sc.UpdateRange(sheetID, fmt.Sprintf("Invoices!A%d", rowNumber), [][]interface{}{invoiceToRow(inv, clientIDToName[inv.ClientID], companyIDToName[inv.MyCompanyID])})
	}

	return sc.AppendRow(sheetID, "Invoices", invoiceToRow(inv, clientIDToName[inv.ClientID], companyIDToName[inv.MyCompanyID]))
}

func (s *SyncService) DeleteInvoice(sheetID, serviceKey, invoiceID string) error {
	sc, err := NewSheetsClient(serviceKey)
	if err != nil {
		return err
	}
	h, dataRows, err := readSheetWithHeaders(sc, sheetID, "Invoices")
	if err != nil {
		return err
	}
	if h == nil {
		return nil
	}
	idCol, ok := h["id"]
	if !ok {
		return fmt.Errorf("Invoices sheet must contain 'id' header")
	}
	want := strings.TrimSpace(invoiceID)
	for i, row := range dataRows {
		if strings.TrimSpace(cellString(row, idCol)) != want {
			continue
		}
		rowNumber := i + 2
		return sc.ClearRange(sheetID, fmt.Sprintf("Invoices!A%d:ZZ%d", rowNumber, rowNumber))
	}
	return nil
}

func (s *SyncService) DownloadInvoiceByID(sheetID, serviceKey, invoiceID string) (models.Invoice, error) {
	sc, err := NewSheetsClient(serviceKey)
	if err != nil {
		return models.Invoice{}, err
	}
	h, dataRows, err := readSheetWithHeaders(sc, sheetID, "Invoices")
	if err != nil {
		return models.Invoice{}, err
	}
	if h == nil {
		return models.Invoice{}, fmt.Errorf("Invoices sheet is empty")
	}

	allClients, err := s.db.GetAllClients()
	if err != nil {
		return models.Invoice{}, err
	}
	_, clientNameToID := loadClientMaps(allClients)
	allCompanies, err := s.db.GetAllMyCompanies()
	if err != nil {
		return models.Invoice{}, err
	}
	_, companyNameToID := loadCompanyMaps(allCompanies)

	want := strings.TrimSpace(invoiceID)
	for _, row := range dataRows {
		id := strings.TrimSpace(hStr(row, h, "id"))
		if id != want {
			continue
		}
		inv, clientName, companyName := invoiceFromRow(row, h, clientNameToID, companyNameToID)
		if inv.ID == "" {
			return models.Invoice{}, fmt.Errorf("invoice %s has empty id", want)
		}
		if err := s.ensureInvoiceLinks(&inv, clientName, companyName, clientNameToID, companyNameToID); err != nil {
			return models.Invoice{}, err
		}
		if err := s.db.UpsertInvoice(inv); err != nil {
			return models.Invoice{}, err
		}
		return inv, nil
	}

	return models.Invoice{}, fmt.Errorf("invoice %s not found in Google Sheets", want)
}

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

func cellString(row []interface{}, idx int) string {
	if idx < 0 || idx >= len(row) {
		return ""
	}
	if row[idx] == nil {
		return ""
	}
	s, ok := row[idx].(string)
	if ok {
		return s
	}
	return fmt.Sprintf("%v", row[idx])
}
