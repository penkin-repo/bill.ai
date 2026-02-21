package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"bill.ai/internal/database"
	"bill.ai/internal/excel"
	"bill.ai/internal/google"
	"bill.ai/internal/models"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed Products/Products.json
var productsJSONEmbedded string

var nonTemplateIDChars = regexp.MustCompile(`[^a-z0-9._-]+`)

// loadProductsJSON reads Products.json from the folder next to executable.
// In dev mode, it may fallback to embedded copy for convenience.
func loadProductsJSON() (string, error) {
	if exeDir, err := getExeDir(); err == nil {
		portable := filepath.Join(exeDir, "Products.json")
		if data, readErr := os.ReadFile(portable); readErr == nil && len(data) > 0 {
			return string(data), nil
		}
	}
	if isLikelyDevEnvironment() && productsJSONEmbedded != "" {
		return productsJSONEmbedded, nil
	}
	return "", fmt.Errorf("Products.json не найден рядом с exe")
}

func getExeDir() (string, error) {
	exePath, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.Dir(exePath), nil
}

func isLikelyDevEnvironment() bool {
	if strings.TrimSpace(os.Getenv("WAILS_DEV_SERVER_URL")) != "" {
		return true
	}
	env := strings.ToLower(strings.TrimSpace(os.Getenv("BILL_ENV")))
	if env == "dev" || env == "development" {
		return true
	}
	cwd, err := os.Getwd()
	if err != nil {
		return false
	}
	if _, err := os.Stat(filepath.Join(cwd, "go.mod")); err != nil {
		return false
	}
	if _, err := os.Stat(filepath.Join(cwd, "PROJECT_LOG_HOW.md")); err == nil {
		return true
	}
	return false
}

func normalizeTemplateID(raw string) string {
	id := strings.ToLower(strings.TrimSpace(raw))
	id = strings.ReplaceAll(id, " ", "_")
	id = nonTemplateIDChars.ReplaceAllString(id, "_")
	id = strings.Trim(id, "_")
	if id == "" {
		return "template"
	}
	return id
}

func normalizeTemplateForStorage(t models.InvoiceTemplate) (models.InvoiceTemplate, error) {
	t.ID = strings.TrimSpace(t.ID)
	t.Name = strings.TrimSpace(t.Name)
	t.FilePath = strings.TrimSpace(t.FilePath)
	t.VatMode = strings.TrimSpace(t.VatMode)

	if t.FilePath == "" {
		return t, fmt.Errorf("имя файла шаблона обязательно")
	}

	fileName := filepath.Base(t.FilePath)
	if strings.TrimSpace(fileName) == "" {
		return t, fmt.Errorf("некорректное имя файла шаблона")
	}
	t.FilePath = fileName

	baseName := strings.TrimSuffix(fileName, filepath.Ext(fileName))
	if t.Name == "" {
		t.Name = baseName
	}
	if t.ID == "" {
		t.ID = normalizeTemplateID(baseName)
	}

	if !isLikelyDevEnvironment() {
		exeDir, err := getExeDir()
		if err != nil {
			return t, fmt.Errorf("не удалось определить папку exe: %w", err)
		}
		fullPath := filepath.Join(exeDir, fileName)
		if fi, err := os.Stat(fullPath); err != nil || fi.IsDir() {
			return t, fmt.Errorf("файл шаблона не найден рядом с exe: %s", fileName)
		}
	}

	if t.VatMode == "" {
		return t, fmt.Errorf("VAT-режим шаблона обязателен")
	}
	return t, nil
}

func pickStartupWindowSize(ctx context.Context) (int, int) {
	const (
		targetW = 1300
		targetH = 860
		minW    = 760
		minH    = 560
		gapW    = 80
		gapH    = 80
	)

	width := targetW
	height := targetH
	screens, err := runtime.ScreenGetAll(ctx)
	if err != nil || len(screens) == 0 {
		return width, height
	}

	active := screens[0]
	for _, s := range screens {
		if s.IsCurrent || s.IsPrimary {
			active = s
			break
		}
	}

	screenW := active.Size.Width
	screenH := active.Size.Height
	if screenW <= 0 {
		screenW = active.Width
	}
	if screenH <= 0 {
		screenH = active.Height
	}

	if screenW > 0 {
		if maxW := screenW - gapW; maxW > 0 && width > maxW {
			width = maxW
		}
		if width < minW {
			if screenW > minW {
				width = minW
			} else {
				width = screenW
			}
		}
	}

	if screenH > 0 {
		if maxH := screenH - gapH; maxH > 0 && height > maxH {
			height = maxH
		}
		if height < minH {
			if screenH > minH {
				height = minH
			} else {
				height = screenH
			}
		}
	}

	if width <= 0 {
		width = targetW
	}
	if height <= 0 {
		height = targetH
	}

	return width, height
}

// App struct
type App struct {
	ctx  context.Context
	db   *database.DB
	sync *google.SyncService
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	if w, h := pickStartupWindowSize(ctx); w > 0 && h > 0 {
		runtime.WindowSetSize(ctx, w, h)
		runtime.WindowCenter(ctx)
	}
	a.db = database.New("bill.ai.db")
	_ = a.db.Migrate()
	if isLikelyDevEnvironment() {
		_ = a.db.SeedTestData()
	}
	a.sync = google.NewSyncService(a.db)

	// Seed products from JSON on first launch when available.
	if cnt, err := a.db.ProductCount(); err == nil && cnt == 0 {
		if jsonData, err := loadProductsJSON(); err == nil {
			_ = a.db.SeedProductsFromJSON(jsonData)
		}
	}
}

func (a *App) GetAllClients() ([]models.Client, error) {
	return a.db.GetAllClients()
}

func (a *App) SearchClients(query string) ([]models.Client, error) {
	return a.db.SearchClients(query)
}

func (a *App) GetAllProducts() ([]models.Product, error) {
	return a.db.GetAllProducts()
}

func (a *App) SearchProducts(query string) ([]models.Product, error) {
	return a.db.SearchProducts(query)
}

func (a *App) GetAllMyCompanies() ([]models.MyCompany, error) {
	return a.db.GetAllMyCompanies()
}

func (a *App) GetAllInvoices() ([]models.Invoice, error) {
	return a.db.GetAllInvoices()
}

func (a *App) CountInvoices(query string) (int, error) {
	return a.db.CountInvoices(query)
}

func (a *App) SearchInvoices(query string, limit, offset int) ([]models.Invoice, error) {
	return a.db.SearchInvoices(query, limit, offset)
}

func (a *App) GetMyCompanyInvoiceTemplates(companyID string) ([]models.InvoiceTemplate, error) {
	return a.db.GetMyCompanyInvoiceTemplates(companyID)
}

func (a *App) GetAllInvoiceTemplates() ([]models.InvoiceTemplate, error) {
	return a.db.GetAllInvoiceTemplates()
}

func (a *App) SetMyCompanyInvoiceTemplate(companyID, templateID string, isDefault bool) error {
	return a.db.SetMyCompanyInvoiceTemplate(companyID, templateID, isDefault)
}

func (a *App) RemoveMyCompanyInvoiceTemplate(companyID, templateID string) error {
	return a.db.RemoveMyCompanyInvoiceTemplate(companyID, templateID)
}

func (a *App) UpsertInvoiceTemplate(t models.InvoiceTemplate) error {
	normalized, err := normalizeTemplateForStorage(t)
	if err != nil {
		return err
	}
	normalized.IsActive = true
	return a.db.UpsertInvoiceTemplate(normalized)
}

func (a *App) DeleteInvoiceTemplate(templateID string) error {
	templateID = strings.TrimSpace(templateID)
	if templateID == "" {
		return fmt.Errorf("template id is empty")
	}
	return a.db.DeleteInvoiceTemplate(templateID)
}

func (a *App) UpsertCompany(company models.MyCompany) error {
	inn := strings.TrimSpace(company.INN)
	if inn == "" {
		return fmt.Errorf("ИНН обязателен")
	}
	company.ID = inn
	company.INN = inn

	// Save locally first
	if err := a.db.UpsertMyCompany(company); err != nil {
		return err
	}
	_ = a.db.EnsureMyCompanyTemplateBootstrap(company.ID)

	// Optionally sync to Google Sheets if configured
	sheetID, _ := a.db.GetSetting("google_sheet_id")
	serviceKey, _ := a.db.GetSetting("google_service_key")
	if sheetID != "" && serviceKey != "" {
		_ = a.sync.UploadMyCompany(sheetID, serviceKey, company)
	}

	return nil
}

func (a *App) DeleteMyCompany(id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("company id is empty")
	}

	if err := a.db.RemoveMyCompanyTemplateBindings(id); err != nil {
		return err
	}
	if err := a.db.DeleteMyCompany(id); err != nil {
		return err
	}

	sheetID, _ := a.db.GetSetting("google_sheet_id")
	serviceKey, _ := a.db.GetSetting("google_service_key")
	if sheetID != "" && serviceKey != "" {
		_ = a.sync.DeleteMyCompany(sheetID, serviceKey, id)
	}

	return nil
}

// UploadInvoiceToGoogleOnly uploads invoice to Google Sheets but does not save it locally.
// The invoice will appear in local registry only after download/sync from Google.
func (a *App) UploadInvoiceToGoogleOnly(inv models.Invoice) error {
	if inv.InvoiceNumber == "" {
		inv.InvoiceNumber = inv.ID
	}
	inv.ID = inv.InvoiceNumber
	now := time.Now().Format(time.RFC3339)
	if inv.CreatedAt == "" {
		inv.CreatedAt = now
	}
	inv.UpdatedAt = now

	sheetID, _ := a.db.GetSetting("google_sheet_id")
	serviceKey, _ := a.db.GetSetting("google_service_key")
	if sheetID == "" || serviceKey == "" {
		return fmt.Errorf("Google Sheets не настроен. Укажите Sheet ID и Service Account Key в настройках.")
	}
	return a.sync.UploadInvoice(sheetID, serviceKey, inv)
}

func (a *App) DeleteInvoice(id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("invoice id is empty")
	}

	if err := a.db.DeleteInvoice(id); err != nil {
		return err
	}

	sheetID, _ := a.db.GetSetting("google_sheet_id")
	serviceKey, _ := a.db.GetSetting("google_service_key")
	if sheetID != "" && serviceKey != "" {
		_ = a.sync.DeleteInvoice(sheetID, serviceKey, id)
	}
	return nil
}

func (a *App) DownloadInvoiceFromGoogle(id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("invoice id is empty")
	}

	sheetID, _ := a.db.GetSetting("google_sheet_id")
	serviceKey, _ := a.db.GetSetting("google_service_key")
	if sheetID == "" || serviceKey == "" {
		return fmt.Errorf("Google Sheets не настроен. Укажите Sheet ID и Service Account Key в настройках.")
	}

	_, err := a.sync.DownloadInvoiceByID(sheetID, serviceKey, id)
	return err
}

func (a *App) GetNextInvoiceNumber(companyID string) (string, error) {
	return a.db.GetNextInvoiceNumberForCompany(companyID)
}

func (a *App) SaveInvoiceFile(name string, data []byte) (string, error) {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: name,
		Title:           "Сохранить счёт",
		Filters: []runtime.FileFilter{
			{DisplayName: "Excel", Pattern: "*.xlsx"},
		},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}

	if err := os.WriteFile(path, data, 0o644); err != nil {
		return "", err
	}

	return path, nil
}

func (a *App) GenerateInvoice(inv models.Invoice, company models.MyCompany, client models.Client, templatePath string, openAfterSave bool) (string, error) {
	custom := map[string]string{}
	if raw, err := a.db.GetSetting("excel_custom_fields"); err == nil {
		_ = json.Unmarshal([]byte(raw), &custom)
	}

	bytes, fileName, err := excel.GenerateInvoiceXLSX(inv, company, client, templatePath, custom)
	if err != nil {
		return "", err
	}

	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: fileName,
		Title:           "Сохранить счёт",
		Filters: []runtime.FileFilter{
			{DisplayName: "Excel", Pattern: "*.xlsx"},
		},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}

	if err := os.WriteFile(path, bytes, 0o644); err != nil {
		return "", err
	}

	if openAfterSave {
		runtime.BrowserOpenURL(a.ctx, "file:///"+filepath.ToSlash(path))
	}

	return path, nil
}

func (a *App) ConvertXlsxToPDF(xlsxPath string) (string, error) {
	xlsxPath = strings.TrimSpace(xlsxPath)
	if xlsxPath == "" {
		return "", fmt.Errorf("путь к XLSX пуст")
	}

	absXlsx, err := filepath.Abs(xlsxPath)
	if err != nil {
		return "", err
	}
	if fi, err := os.Stat(absXlsx); err != nil || fi.IsDir() {
		return "", fmt.Errorf("XLSX файл не найден: %s", absXlsx)
	}

	pdfPath := strings.TrimSuffix(absXlsx, filepath.Ext(absXlsx)) + ".pdf"
	esc := func(s string) string { return strings.ReplaceAll(s, "'", "''") }

	psScript := fmt.Sprintf(`$ErrorActionPreference='Stop';
$xlsx='%s';
$pdf='%s';
$excel=$null;
$wb=$null;
try {
  $excel = New-Object -ComObject Excel.Application;
  $excel.Visible = $false;
  $excel.DisplayAlerts = $false;
  $wb = $excel.Workbooks.Open($xlsx);
  $wb.ExportAsFixedFormat(0, $pdf);
} finally {
  if ($wb -ne $null) { $wb.Close($false) }
  if ($excel -ne $null) { $excel.Quit() }
  [System.GC]::Collect();
  [System.GC]::WaitForPendingFinalizers();
}`,
		esc(absXlsx), esc(pdfPath),
	)

	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript)
	out, err := cmd.CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return "", fmt.Errorf("не удалось конвертировать XLSX в PDF. Проверьте, что установлен Microsoft Excel. Детали: %s", msg)
	}

	if _, err := os.Stat(pdfPath); err != nil {
		return "", fmt.Errorf("PDF не создан: %s", pdfPath)
	}

	return pdfPath, nil
}

func (a *App) GetSetting(key string) (string, error) {
	return a.db.GetSetting(key)
}

func (a *App) SetSetting(key, value string) error {
	return a.db.SetSetting(key, value)
}

func (a *App) UpsertClient(client models.Client) error {
	inn := strings.TrimSpace(client.INN)
	if inn == "" {
		return fmt.Errorf("ИНН обязателен")
	}
	client.ID = inn
	client.INN = inn
	now := time.Now().Format(time.RFC3339)
	if client.CreatedAt == "" {
		client.CreatedAt = now
	}
	client.UpdatedAt = now

	// Save locally first
	if err := a.db.UpsertClient(client); err != nil {
		return err
	}
	// Optionally sync to Google Sheets if configured
	sheetID, _ := a.db.GetSetting("google_sheet_id")
	serviceKey, _ := a.db.GetSetting("google_service_key")
	if sheetID != "" && serviceKey != "" {
		_ = a.sync.UploadClient(sheetID, serviceKey, client)
	}

	return nil
}

func (a *App) DeleteClient(id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("client id is empty")
	}

	if err := a.db.RemoveClientTemplateBindings(id); err != nil {
		return err
	}
	if err := a.db.DeleteClient(id); err != nil {
		return err
	}

	sheetID, _ := a.db.GetSetting("google_sheet_id")
	serviceKey, _ := a.db.GetSetting("google_service_key")
	if sheetID != "" && serviceKey != "" {
		_ = a.sync.DeleteClient(sheetID, serviceKey, id)
	}

	return nil
}

func (a *App) UpsertInvoice(inv models.Invoice) error {
	if inv.InvoiceNumber == "" {
		inv.InvoiceNumber = inv.ID
	}
	inv.ID = inv.InvoiceNumber
	now := time.Now().Format(time.RFC3339)
	if inv.CreatedAt == "" {
		inv.CreatedAt = now
	}
	inv.UpdatedAt = now

	// Save locally first
	if err := a.db.UpsertInvoice(inv); err != nil {
		return err
	}

	// Optionally sync to Google Sheets if configured
	sheetID, _ := a.db.GetSetting("google_sheet_id")
	serviceKey, _ := a.db.GetSetting("google_service_key")
	if sheetID != "" && serviceKey != "" {
		_ = a.sync.UploadInvoice(sheetID, serviceKey, inv)
	}

	return nil
}

func (a *App) UpsertProduct(p models.Product) error {
	if p.ID == "" {
		p.ID = p.Name
	}
	now := time.Now().Format(time.RFC3339)
	if p.CreatedAt == "" {
		p.CreatedAt = now
	}
	p.UpdatedAt = now
	return a.db.UpsertProduct(p)
}

func (a *App) DeleteProduct(id string) error {
	return a.db.DeleteProduct(id)
}

func (a *App) ResetProductsToFactory() error {
	jsonData, err := loadProductsJSON()
	if err != nil {
		return fmt.Errorf("не удалось загрузить Products.json: %w", err)
	}
	return a.db.SeedProductsFromJSON(jsonData)
}

func (a *App) ImportProductsFromJSON(jsonData string) error {
	return a.db.SeedProductsFromJSON(jsonData)
}

func (a *App) ImportProductsFromCSV(csvText string) error {
	return a.db.SeedProductsFromCSV(csvText)
}

func (a *App) SyncAll() ([]models.SyncResult, error) {
	sheetID, _ := a.db.GetSetting("google_sheet_id")
	serviceKey, _ := a.db.GetSetting("google_service_key")
	if sheetID == "" || serviceKey == "" {
		return nil, fmt.Errorf("Google Sheets не настроен. Укажите Sheet ID и Service Account Key в настройках.")
	}
	return a.sync.SyncAll(sheetID, serviceKey)
}

func (a *App) ForceUploadToGoogle() error {
	sheetID, _ := a.db.GetSetting("google_sheet_id")
	serviceKey, _ := a.db.GetSetting("google_service_key")
	if sheetID == "" || serviceKey == "" {
		return fmt.Errorf("Google Sheets не настроен. Укажите Sheet ID и Service Account Key в настройках.")
	}
	return a.sync.ForceUploadToGoogle(sheetID, serviceKey)
}

func (a *App) ForceDownloadFromGoogle() error {
	sheetID, _ := a.db.GetSetting("google_sheet_id")
	serviceKey, _ := a.db.GetSetting("google_service_key")
	if sheetID == "" || serviceKey == "" {
		return fmt.Errorf("Google Sheets не настроен. Укажите Sheet ID и Service Account Key в настройках.")
	}
	return a.sync.ForceDownloadFromGoogle(sheetID, serviceKey)
}

func (a *App) GetLastSyncTime(entity string) (string, error) {
	return a.db.GetLastSyncTime(entity)
}
