# Полный промпт для создания Invoice Generator на Go Wails + React
---
## РОЛЬ
Ты — Senior Fullstack Developer (Go + Wails v2 + React + TypeScript). Создай полноценное десктопное приложение для Windows.
---
## СТЕК ТЕХНОЛОГИЙ
| Слой | Технология |
|------|-----------|
| Desktop Runtime | **Wails v2** (Go backend + WebView2 frontend) |
| Backend | **Go 1.21+** |
| Frontend | **React 18 + TypeScript + Vite** |
| CSS | **TailwindCSS 3** |
| Локальная БД | **SQLite** (через `modernc.org/sqlite` — pure Go, без CGO) |
| Иконки | **Lucide React** |
| Формы | **React Hook Form** |
| State | **React Context API** + `useReducer` |
| Числа прописью | Собственная утилита (русский язык) |
| Excel генерация | **ExcelJS** (на фронте) или Go-библиотека `excelize` (на бэке) |
| AI | **OpenRouter API** (REST) |
| Данные (Master) | **Google Sheets API v4** (Service Account) |
---
## АРХИТЕКТУРА ПРИЛОЖЕНИЯ
### Принцип работы с данными
```
Google Sheets (MASTER) <---> Go Backend (Sync Service) <---> SQLite (LOCAL CACHE) <---> React UI
```
**Правила:**
1. **Google Sheets — единственный источник правды (Master).** При любых конфликтах данные из Google Sheets побеждают.
2. **SQLite — локальный кэш** для мгновенного UI и оффлайн-работы.
3. **Чтение (Read):** Всегда из SQLite. UI никогда не ждёт сеть для отображения данных.
4. **Запись (Write):** Новый клиент/товар/счёт → сначала POST в Google Sheets API → если успех → записать в SQLite → обновить UI.
5. **Синхронизация:** Кнопка "Синхронизировать" на каждой странице справочника + автосинхронизация при старте приложения. Логика: скачать ВСЕ данные из Google Sheets → перезаписать/обновить SQLite (upsert by ID).
6. **Дата синхронизации:** Хранить в SQLite таблице `sync_log` и показывать на UI: "Последняя синхронизация: 15.01.2025 14:32".
---
## СТРУКТУРА GOOGLE SHEETS
Один Spreadsheet с 4 листами (sheets):
### Лист 1: `Clients` (Клиенты)
| Столбец | Поле |
|---------|------|
| A | id (UUID, генерируется приложением) |
| B | name (Название компании) |
| C | inn (ИНН) |
| D | kpp (КПП, может быть пустым для ИП) |
| E | address (Юридический адрес) |
| F | bank_name (Название банка) |
| G | bank_bik (БИК) |
| H | bank_account (Расчётный счёт) |
| I | bank_corr_account (Корр. счёт) |
| J | contact_person (Контактное лицо) |
| K | phone (Телефон) |
| L | email (Email) |
| M | comment (Комментарий) |
| N | created_at (ISO дата создания) |
| O | updated_at (ISO дата обновления) |
### Лист 2: `Products` (Товары/Услуги)
| Столбец | Поле |
|---------|------|
| A | id (UUID) |
| B | name (Наименование) |
| C | category (Категория) |
| D | unit (Единица измерения: шт, м², м³, п.м., т, кг, усл.) |
| E | price (Цена за единицу, число) |
| F | description (Описание) |
| G | created_at |
| H | updated_at |
### Лист 3: `MyCompanies` (Мои организации)
| Столбец | Поле |
|---------|------|
| A | id (UUID) |
| B | name (Полное наименование) |
| C | short_name (Краткое наименование) |
| D | inn |
| E | kpp |
| F | ogrn |
| G | address |
| H | bank_name |
| I | bank_bik |
| J | bank_account |
| K | bank_corr_account |
| L | director_name (ФИО директора / ИП) |
| M | director_title (Должность: Директор / Индивидуальный предприниматель) |
| N | phone |
| O | email |
| P | stamp_image_path (Путь к файлу печати, опционально) |
| Q | signature_image_path (Путь к файлу подписи, опционально) |
### Лист 4: `Invoices` (Счета)
| Столбец | Поле |
|---------|------|
| A | id (UUID) |
| B | invoice_number (Номер счёта: "СЧ-001") |
| C | invoice_date (Дата счёта) |
| D | my_company_id (ID из MyCompanies) |
| E | client_id (ID из Clients) |
| F | vat_mode ("included" / "excluded" / "no_vat") |
| G | vat_rate (20 или 0) |
| H | items_json (JSON массив позиций: [{product_id, name, unit, quantity, price, sum}]) |
| I | subtotal (Сумма без НДС) |
| J | vat_amount (Сумма НДС) |
| K | total (Итого с НДС) |
| L | total_words (Сумма прописью) |
| M | comment (Комментарий) |
| N | created_at |
| O | updated_at |
---
## СТРУКТУРА SQLite (ЗЕРКАЛО Google Sheets + служебные таблицы)
```sql
CREATE TABLE IF NOT EXISTS clients (
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
);
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    unit TEXT DEFAULT 'шт',
    price REAL DEFAULT 0,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS my_companies (
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
    stamp_image_path TEXT,
    signature_image_path TEXT
);
CREATE TABLE IF NOT EXISTS invoices (
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
);
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT NOT NULL,  -- 'clients', 'products', 'my_companies', 'invoices'
    direction TEXT NOT NULL, -- 'download', 'upload'
    records_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'success', -- 'success', 'error'
    error_message TEXT,
    synced_at TEXT DEFAULT (datetime('now'))
);
-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_inn ON clients(inn);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
```
---
## СТРУКТУРА ПРОЕКТА (Wails v2)
```
invoice-generator/
├── build/                          # Wails build output
│   └── windows/
│       ├── icon.ico
│       └── info.json
├── frontend/                       # React приложение
│   ├── src/
│   │   ├── main.tsx               # Entry point
│   │   ├── App.tsx                # Root component с роутингом по табам
│   │   ├── index.css              # TailwindCSS imports
│   │   │
│   │   ├── context/
│   │   │   └── AppContext.tsx     # React Context: clients, products, companies, invoices, settings, activeTab
│   │   │
│   │   ├── pages/
│   │   │   ├── InvoicePage.tsx    # ⚡ Выставить счёт (AI команда + полная форма)
│   │   │   ├── AddClientPage.tsx  # ⚡ Добавить клиента (AI парсинг реквизитов)
│   │   │   ├── InvoicesRegistry.tsx # 📋 Реестр счетов
│   │   │   ├── ClientsPage.tsx    # 📋 Справочник клиентов
│   │   │   ├── ProductsPage.tsx   # 📋 Справочник товаров
│   │   │   ├── CompaniesPage.tsx  # 📋 Мои компании
│   │   │   └── SettingsPage.tsx   # ⚙️ Настройки
│   │   │
│   │   ├── components/
│   │   │   ├── Sidebar.tsx        # Боковое меню с подразделами
│   │   │   ├── ProductSearch.tsx  # Компонент поиска товара с dropdown
│   │   │   ├── ClientSearch.tsx   # Компонент поиска клиента с dropdown
│   │   │   ├── SyncButton.tsx     # Универсальная кнопка синхронизации
│   │   │   ├── DragDropZone.tsx   # Зона drag-n-drop для файлов/текста
│   │   │   └── Modal.tsx          # Универсальный модальный компонент
│   │   │
│   │   ├── services/
│   │   │   ├── ai.ts             # OpenRouter API: parseRequisites, processVoiceCommand, transcribeAudio
│   │   │   └── excel.ts          # Генерация Excel (ExcelJS): loadTemplate, fillInvoice, saveFile
│   │   │
│   │   └── utils/
│   │       ├── num2words.ts      # Сумма прописью (русский язык)
│   │       └── helpers.ts        # UUID, форматирование дат, валюты
│   │
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── internal/
│   ├── database/
│   │   ├── database.go           # Инициализация SQLite, миграции
│   │   ├── clients.go            # CRUD клиентов
│   │   ├── products.go           # CRUD товаров
│   │   ├── companies.go          # CRUD компаний
│   │   ├── invoices.go           # CRUD счетов
│   │   └── settings.go           # Key-value настройки
│   │
│   ├── google/
│   │   ├── sheets.go             # Google Sheets API v4: Read/Write
│   │   └── sync.go               # Логика синхронизации: SyncAll, SyncClients, SyncProducts, etc.
│   │
│   └── models/
│       └── models.go             # Go структуры: Client, Product, MyCompany, Invoice, SyncLog
│
├── app.go                        # Wails App struct: все Bind-методы (вызываемые из JS)
├── main.go                       # Entry point: wails.Run()
├── wails.json                    # Wails конфигурация
├── go.mod
└── go.sum
```
---
## GO BACKEND: КЛЮЧЕВЫЕ МОДУЛИ
### main.go
```go
package main
import (
	"embed"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)
//go:embed all:frontend/dist
var assets embed.FS
func main() {
	app := NewApp()
	err := wails.Run(&options.App{
		Title:     "Invoice Generator",
		Width:     1400,
		Height:    900,
		MinWidth:  1200,
		MinHeight: 700,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:  app.startup,
		OnShutdown: app.shutdown,
		Bind: []interface{}{
			app,
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
		},
	})
	if err != nil {
		println("Error:", err.Error())
	}
}
```
### app.go — Bind методы (вызываемые из React через `window.go.main.App.MethodName()`)
```go
package main
import (
	"context"
	"invoice-generator/internal/database"
	"invoice-generator/internal/google"
	"invoice-generator/internal/models"
)
type App struct {
	ctx  context.Context
	db   *database.DB
	sync *google.SyncService
}
func NewApp() *App {
	return &App{}
}
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.db = database.New("invoice_generator.db")
	a.db.Migrate()
	a.sync = google.NewSyncService(a.db)
}
func (a *App) shutdown(ctx context.Context) {
	a.db.Close()
}
// ==================== CLIENTS ====================
func (a *App) GetAllClients() ([]models.Client, error) {
	return a.db.GetAllClients()
}
func (a *App) SearchClients(query string) ([]models.Client, error) {
	return a.db.SearchClients(query)
}
func (a *App) GetClient(id string) (*models.Client, error) {
	return a.db.GetClient(id)
}
func (a *App) UpsertClient(client models.Client) error {
	return a.db.UpsertClient(client)
}
func (a *App) DeleteClient(id string) error {
	return a.db.DeleteClient(id)
}
// ==================== PRODUCTS ====================
func (a *App) GetAllProducts() ([]models.Product, error) {
	return a.db.GetAllProducts()
}
func (a *App) SearchProducts(query string) ([]models.Product, error) {
	return a.db.SearchProducts(query)
}
func (a *App) UpsertProduct(product models.Product) error {
	return a.db.UpsertProduct(product)
}
func (a *App) DeleteProduct(id string) error {
	return a.db.DeleteProduct(id)
}
// ==================== MY COMPANIES ====================
func (a *App) GetAllCompanies() ([]models.MyCompany, error) {
	return a.db.GetAllCompanies()
}
func (a *App) UpsertCompany(company models.MyCompany) error {
	return a.db.UpsertCompany(company)
}
// ==================== INVOICES ====================
func (a *App) GetAllInvoices() ([]models.Invoice, error) {
	return a.db.GetAllInvoices()
}
func (a *App) GetInvoice(id string) (*models.Invoice, error) {
	return a.db.GetInvoice(id)
}
func (a *App) UpsertInvoice(invoice models.Invoice) error {
	return a.db.UpsertInvoice(invoice)
}
func (a *App) DeleteInvoice(id string) error {
	return a.db.DeleteInvoice(id)
}
func (a *App) GetNextInvoiceNumber() (string, error) {
	return a.db.GetNextInvoiceNumber()
}
// ==================== SETTINGS ====================
func (a *App) GetSetting(key string) (string, error) {
	return a.db.GetSetting(key)
}
func (a *App) SetSetting(key, value string) error {
	return a.db.SetSetting(key, value)
}
func (a *App) GetAllSettings() (map[string]string, error) {
	return a.db.GetAllSettings()
}
// ==================== SYNC ====================
func (a *App) SyncAll() (*models.SyncResult, error) {
	sheetID, _ := a.db.GetSetting("google_sheet_id")
	serviceKey, _ := a.db.GetSetting("google_service_key")
	if sheetID == "" || serviceKey == "" {
		return nil, fmt.Errorf("Google Sheets не настроен. Укажите Sheet ID и Service Account Key в настройках.")
	}
	return a.sync.SyncAll(sheetID, serviceKey)
}
func (a *App) SyncClients() (*models.SyncResult, error) {
	sheetID, _ := a.db.GetSetting("google_sheet_id")
	serviceKey, _ := a.db.GetSetting("google_service_key")
	return a.sync.SyncClients(sheetID, serviceKey)
}
func (a *App) SyncProducts() (*models.SyncResult, error) {
	sheetID, _ := a.db.GetSetting("google_sheet_id")
	serviceKey, _ := a.db.GetSetting("google_service_key")
	return a.sync.SyncProducts(sheetID, serviceKey)
}
func (a *App) SyncInvoices() (*models.SyncResult, error) {
	sheetID, _ := a.db.GetSetting("google_sheet_id")
	serviceKey, _ := a.db.GetSetting("google_service_key")
	return a.sync.SyncInvoices(sheetID, serviceKey)
}
func (a *App) GetLastSyncTime(entity string) (string, error) {
	return a.db.GetLastSyncTime(entity)
}
// ==================== FILE SYSTEM ====================
func (a *App) SaveFile(filename string, data []byte) (string, error) {
	// Открыть диалог выбора папки через Wails runtime
	// Сохранить файл и вернуть полный путь
}
func (a *App) SelectFile(filters []string) (string, error) {
	// Открыть диалог выбора файла
}
```
### internal/models/models.go
```go
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
	ID                 string `json:"id"`
	Name               string `json:"name"`
	ShortName          string `json:"short_name"`
	INN                string `json:"inn"`
	KPP                string `json:"kpp"`
	OGRN               string `json:"ogrn"`
	Address            string `json:"address"`
	BankName           string `json:"bank_name"`
	BankBIK            string `json:"bank_bik"`
	BankAccount        string `json:"bank_account"`
	BankCorrAccount    string `json:"bank_corr_account"`
	DirectorName       string `json:"director_name"`
	DirectorTitle      string `json:"director_title"`
	Phone              string `json:"phone"`
	Email              string `json:"email"`
	StampImagePath     string `json:"stamp_image_path"`
	SignatureImagePath string `json:"signature_image_path"`
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
	// Computed (не хранится в БД, заполняется при чтении)
	MyCompanyName string `json:"my_company_name,omitempty"`
	ClientName    string `json:"client_name,omitempty"`
}
type SyncResult struct {
	Entity       string `json:"entity"`
	Downloaded   int    `json:"downloaded"`
	Uploaded     int    `json:"uploaded"`
	Errors       int    `json:"errors"`
	ErrorMessage string `json:"error_message,omitempty"`
	SyncedAt     string `json:"synced_at"`
}
type SyncLog struct {
	ID            int    `json:"id"`
	Entity        string `json:"entity"`
	Direction     string `json:"direction"`
	RecordsCount  int    `json:"records_count"`
	Status        string `json:"status"`
	ErrorMessage  string `json:"error_message"`
	SyncedAt      string `json:"synced_at"`
}
```
### internal/google/sync.go — Логика синхронизации
```go
package google
import (
	"encoding/json"
	"fmt"
	"invoice-generator/internal/database"
	"invoice-generator/internal/models"
	"time"
)
type SyncService struct {
	db *database.DB
}
func NewSyncService(db *database.DB) *SyncService {
	return &SyncService{db: db}
}
func (s *SyncService) SyncAll(sheetID, serviceKey string) (*models.SyncResult, error) {
	// 1. Синхронизировать клиентов
	// 2. Синхронизировать товары
	// 3. Синхронизировать компании
	// 4. Синхронизировать счета
	// Каждый шаг: ReadSheet -> Parse -> Upsert в SQLite
	// Записать в sync_log
	return nil, nil
}
func (s *SyncService) SyncClients(sheetID, serviceKey string) (*models.SyncResult, error) {
	client := NewSheetsClient(serviceKey)
	// 1. Читаем все строки из листа "Clients"
	rows, err := client.ReadSheet(sheetID, "Clients!A2:O")
	if err != nil {
		return nil, fmt.Errorf("ошибка чтения Google Sheets: %w", err)
	}
	// 2. Парсим строки в []models.Client
	clients := parseClientRows(rows)
	// 3. Upsert каждого клиента в SQLite
	for _, c := range clients {
		s.db.UpsertClient(c)
	}
	// 4. Записываем лог синхронизации
	syncTime := time.Now().Format("2006-01-02 15:04:05")
	s.db.SetSetting("last_sync_clients", syncTime)
	s.db.InsertSyncLog("clients", "download", len(clients), "success", "")
	return &models.SyncResult{
		Entity:     "clients",
		Downloaded: len(clients),
		SyncedAt:   syncTime,
	}, nil
}
// Аналогично: SyncProducts, SyncCompanies, SyncInvoices
// UploadClient — записать нового клиента в Google Sheets
func (s *SyncService) UploadClient(sheetID, serviceKey string, client models.Client) error {
	sheetsClient := NewSheetsClient(serviceKey)
	row := []interface{}{
		client.ID, client.Name, client.INN, client.KPP,
		client.Address, client.BankName, client.BankBIK,
		client.BankAccount, client.BankCorrAccount,
		client.ContactPerson, client.Phone, client.Email,
		client.Comment, client.CreatedAt, client.UpdatedAt,
	}
	return sheetsClient.AppendRow(sheetID, "Clients", row)
}
```
### internal/google/sheets.go — Google Sheets API клиент
```go
package google
import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
	"golang.org/x/oauth2/google"
	"golang.org/x/oauth2/jwt"
	"google.golang.org/api/sheets/v4"
)
type SheetsClient struct {
	serviceKeyJSON string
}
func NewSheetsClient(serviceKeyJSON string) *SheetsClient {
	return &SheetsClient{serviceKeyJSON: serviceKeyJSON}
}
func (sc *SheetsClient) getService() (*sheets.Service, error) {
	conf, err := google.JWTConfigFromJSON([]byte(sc.serviceKeyJSON), sheets.SpreadsheetsScope)
	if err != nil {
		return nil, err
	}
	client := conf.Client(context.Background())
	return sheets.New(client)
}
func (sc *SheetsClient) ReadSheet(spreadsheetID, range_ string) ([][]interface{}, error) {
	srv, err := sc.getService()
	if err != nil {
		return nil, err
	}
	resp, err := srv.Spreadsheets.Values.Get(spreadsheetID, range_).Do()
	if err != nil {
		return nil, err
	}
	return resp.Values, nil
}
func (sc *SheetsClient) AppendRow(spreadsheetID, sheetName string, row []interface{}) error {
	srv, err := sc.getService()
	if err != nil {
		return err
	}
	valueRange := &sheets.ValueRange{
		Values: [][]interface{}{row},
	}
	_, err = srv.Spreadsheets.Values.Append(
		spreadsheetID,
		sheetName+"!A:A",
		valueRange,
	).ValueInputOption("RAW").Do()
	return err
}
func (sc *SheetsClient) UpdateRow(spreadsheetID, range_ string, row []interface{}) error {
	srv, err := sc.getService()
	if err != nil {
		return err
	}
	valueRange := &sheets.ValueRange{
		Values: [][]interface{}{row},
	}
	_, err = srv.Spreadsheets.Values.Update(
		spreadsheetID,
		range_,
		valueRange,
	).ValueInputOption("RAW").Do()
	return err
}
```
---
## FRONTEND: КЛЮЧЕВЫЕ КОМПОНЕНТЫ
### Sidebar.tsx — Боковое меню с подразделами
```
Меню разбито на 3 секции:
⚡ ДЕЙСТВИЯ
├── Выставить счёт      (InvoicePage)
└── Добавить клиента    (AddClientPage)
📋 СПРАВОЧНИКИ
├── Реестр счетов       (InvoicesRegistry)
├── Клиенты             (ClientsPage)
├── Товары              (ProductsPage)
└── Мои компании        (CompaniesPage)
⚙️ СИСТЕМА
└── Настройки           (SettingsPage)
```
Каждая секция визуально разделена заголовком (мелкий серый текст, uppercase). Активная вкладка подсвечена синим фоном. Внизу сайдбара — дата последней общей синхронизации и кнопка "Синхронизировать всё".
### InvoicePage.tsx — Выставить счёт
**Верхняя секция: AI Команда**
- Текстовое поле с placeholder: "Напишите команду, например: ИП Путилов счёт на 100 плиток"
- Кнопка "Отправить" (→ AI парсит → ищет клиента в SQLite по LIKE → ищет товар → заполняет форму)
- Кнопка микрофона (→ запись → транскрипция → тот же процесс)
- Чипы-подсказки: клик по чипу вставляет текст в поле
**Основная форма:**
- Выбор "От кого" (dropdown: мои компании из SQLite)
- Выбор "Кому" (поиск клиента: автокомплит по имени/ИНН, данные из SQLite)
- Номер счёта (автогенерация: СЧ-001, СЧ-002...)
- Дата счёта (datepicker, по умолчанию = сегодня)
- НДС: radio-кнопки (Без НДС / НДС 20% включён / НДС 20% сверху)
- **Таблица позиций:**
  | № | Наименование (с поиском) | Ед. изм. | Кол-во | Цена | Сумма |
  - Кнопка "Добавить строку"
  - Кнопка "Удалить строку" (корзина)
  - Поиск товара: при вводе текста — dropdown с результатами из SQLite, при выборе автозаполняет цену и ед. изм.
- **Итого:**
  - Сумма без НДС
  - НДС (рассчитывается автоматически)
  - ИТОГО
  - Сумма прописью (генерируется автоматически на русском)
- Поле "Комментарий"
- Checkbox "Скачать PDF"
- Кнопка "Сохранить и скачать Excel"
### AddClientPage.tsx — Добавить клиента
- Переключатель: [Текст] / [Картинка]
- Если "Текст": textarea для вставки реквизитов
- Если "Картинка": drag-n-drop зона для скана/фото реквизитов
- Кнопка "Распознать" → отправка в OpenRouter API → получение JSON
- **Превью:** карточка с распознанными данными (все поля клиента)
- Каждое поле можно отредактировать вручную
- Кнопка "Добавить в базу" → POST в Google Sheets → если OK → INSERT в SQLite → уведомление "Клиент добавлен"
- Кнопка "Отмена" → сброс формы
### ClientsPage.tsx — Справочник клиентов
- Заголовок: "Клиенты" + Кнопка "🔄 Синхронизировать" + текст "Последняя синхронизация: ..."
- Поле поиска по имени/ИНН
- Таблица: Название | ИНН | КПП | Адрес | Телефон | Действия
- Клик на строку → модальное окно с полной карточкой клиента
- Кнопка "Добавить" → переход на AddClientPage
### ProductsPage.tsx — Справочник товаров
- Заголовок: "Товары" + Кнопка "🔄 Синхронизировать" + дата синхронизации
- Поле поиска по названию
- Фильтр по категории (dropdown)
- Таблица: Наименование | Категория | Ед. изм. | Цена | Действия
- Кнопка "Добавить товар" → модальное окно с формой
- Товары приходят из Google Sheets при синхронизации
### InvoicesRegistry.tsx — Реестр счетов
- Заголовок + Кнопка "🔄 Синхронизировать"
- Карточки-статистики: Всего счетов | Сумма | Средний чек
- Поле поиска по номеру/клиенту
- Таблица: № Счёта | Дата | Поставщик | Покупатель | Позиций | Сумма | Комментарий | Действия
- **НЕТ статусов** (убраны по требованию)
- Клик → модальное окно с деталями
- Кнопка удаления
### SettingsPage.tsx — Настройки
**Секция 1: Google Sheets**
- Поле: Google Sheet ID
- Поле: Service Account JSON Key (textarea)
- Кнопка "Проверить подключение"
- Кнопка "Синхронизировать всё"
**Секция 2: AI (OpenRouter)**
- Поле: OpenRouter API Key
- Выбор модели (radio или select):
  - google/gemini-flash-1.5 ⭐ Рекомендуется
  - google/gemini-2.0-flash-exp
  - openai/gpt-4o-mini 💰 Дешёвый
  - openai/gpt-4o
  - anthropic/claude-3.5-sonnet
  - anthropic/claude-3-haiku 💰 Дешёвый
  - meta-llama/llama-3.1-70b-instruct 🆓 Бесплатный
  - mistralai/mistral-large
  - qwen/qwen-2.5-72b-instruct
  - deepseek/deepseek-chat-v3 💰 Дешёвый
**Секция 3: Данные**
- Кнопка "Загрузить тестовые данные"
- Кнопка "Очистить базу данных"
- Кнопка "Экспорт SQLite"
- Кнопка "Импорт SQLite"
---
## AI СЕРВИС: ПРОМПТЫ
### Парсинг реквизитов клиента (текст или изображение)
```
System Prompt:
"Ты — AI для извлечения реквизитов компании из текста или изображения.
Извлеки следующие поля и верни СТРОГО в JSON формате без markdown:
{
  "name": "Полное наименование организации",
  "inn": "ИНН (10 или 12 цифр)",
  "kpp": "КПП (9 цифр, может отсутствовать у ИП)",
  "address": "Юридический адрес",
  "bank_name": "Наименование банка",
  "bank_bik": "БИК банка (9 цифр)",
  "bank_account": "Расчётный счёт (20 цифр)",
  "bank_corr_account": "Корреспондентский счёт (20 цифр)",
  "contact_person": "Контактное лицо (если есть)",
  "phone": "Телефон (если есть)",
  "email": "Email (если есть)"
}
Если поле не найдено, оставь пустую строку.
Не добавляй markdown, комментарии или пояснения. Только чистый JSON."
```
### Парсинг голосовой/текстовой команды для счёта
```
System Prompt:
"Ты — AI ассистент для создания счетов. Из текстовой команды пользователя извлеки:
- Кого искать среди клиентов
- Какие товары и в каком количестве добавить в счёт
Верни СТРОГО JSON без markdown:
{
  "client_search": "поисковый запрос для клиента",
  "items": [
    {
      "product_search": "поисковый запрос для товара",
      "quantity": число
    }
  ]
}
Примеры:
Ввод: "Путилову 100 плиток и 50 бордюров"
Вывод: {"client_search": "Путилов", "items": [{"product_search": "плитка", "quantity": 100}, {"product_search": "бордюр", "quantity": 50}]}
Ввод: "Стройинвест 200 штук тротуарной плитки старый город"
Вывод: {"client_search": "Стройинвест", "items": [{"product_search": "тротуарная плитка старый город", "quantity": 200}]}
Не добавляй markdown. Только JSON."
```
---
## УТИЛИТА: СУММА ПРОПИСЬЮ (Русский язык)
Функция `numberToWordsRu(amount: number): string`
Примеры:
- 1500.00 → "Одна тысяча пятьсот рублей 00 копеек"
- 23456.78 → "Двадцать три тысячи четыреста пятьдесят шесть рублей 78 копеек"
- 1000000.00 → "Один миллион рублей 00 копеек"
- 0.50 → "Ноль рублей 50 копеек"
Правила:
- Рубли склоняются: 1 рубль, 2-4 рубля, 5-20 рублей
- Тысячи женского рода: "одна тысяча", "две тысячи"
- Копейки всегда числом: "78 копеек"
- Первая буква заглавная
---
## ТЕСТОВЫЕ ДАННЫЕ (загружаются при первом запуске)
### Мои компании:
1. ИП Ковальчук Андрей Сергеевич | ИНН 667801234567 | Расчётный счёт в Сбербанке
2. ООО "Завод Тротуарной Плитки" | ИНН 6678054321 | КПП 667801001 | Расчётный счёт в Альфа-Банке
### Клиенты (8 шт):
1. ООО "СтройИнвест" | ИНН 7701234567 | КПП 770101001 | Москва
2. ИП Путилов Дмитрий Владимирович | ИНН 667812345678 | Екатеринбург
3. АО "МегаСтрой" | ИНН 5501234567 | КПП 550101001 | Омск
4. ООО "Ландшафт Про" | ИНН 7801234567 | КПП 780101001 | СПб
5. ИП Жукова Мария Петровна | ИНН 662301234567 | Челябинск
6. ООО "Рога и Копыта" | ИНН 1601234567 | КПП 160101001 | Казань
7. МУП "Благоустройство" | ИНН 6601234567 | КПП 660101001 | Екатеринбург
8. ООО "ДорСтрой Плюс" | ИНН 7401234567 | КПП 740101001 | Тюмень
### Товары (30 шт, 8 категорий):
**Тротуарная плитка:**
- Плитка "Старый город" (серая) | м² | 850 ₽
- Плитка "Старый город" (красная) | м² | 950 ₽
- Плитка "Кирпичик" | м² | 750 ₽
- Плитка "Катушка" | м² | 680 ₽
- Плитка "Ромб" | м² | 900 ₽
- Плитка "8 кирпичей" | м² | 820 ₽
**Бордюры:**
- Бордюр тротуарный 500x200x60 | шт | 85 ₽
- Бордюр дорожный 1000x300x150 | шт | 450 ₽
- Бордюр садовый 500x200x35 | шт | 55 ₽
**И ещё 21 позиция в категориях: водоотведение, сыпучие материалы, строительные смеси, геоматериалы, услуги, работы**
### Счета (5 шт):
Разные комбинации компаний, клиентов, товаров. Без статусов, с комментариями.
---
## ВЫЗОВ Go-МЕТОДОВ ИЗ REACT
В Wails v2 Go-методы доступны через автогенерированные биндинги:
```typescript
// frontend/wailsjs/go/main/App.ts (автогенерируется Wails)
import { GetAllClients, SearchClients, UpsertClient } from '../wailsjs/go/main/App';
// Использование в компоненте:
const clients = await GetAllClients();
const results = await SearchClients("Путилов");
await UpsertClient(newClient);
await SyncClients();
const lastSync = await GetLastSyncTime("clients");
```
---
## КОНФИГУРАЦИЯ WAILS (wails.json)
```json
{
  "name": "invoice-generator",
  "outputfilename": "InvoiceGenerator",
  "frontend:install": "npm install",
  "frontend:build": "npm run build",
  "frontend:dev:watcher": "npm run dev",
  "frontend:dev:serverUrl": "auto",
  "author": {
    "name": "Developer",
    "email": "dev@example.com"
  }
}
```
---
## GO ЗАВИСИМОСТИ (go.mod)
```
module invoice-generator
go 1.21
require (
    github.com/wailsapp/wails/v2 v2.7.1
    modernc.org/sqlite v1.28.0      // Pure Go SQLite (без CGO!)
    google.golang.org/api v0.150.0   // Google Sheets API
    golang.org/x/oauth2 v0.15.0      // OAuth2 для Service Account
)
```
**Важно:** Используется `modernc.org/sqlite` вместо `mattn/go-sqlite3`, чтобы не требовать CGO и C-компилятор на Windows.
---
## NPM ЗАВИСИМОСТИ (frontend/package.json)
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.300.0",
    "exceljs": "^4.4.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0"
  }
}
```
---
## ПОРЯДОК РЕАЛИЗАЦИИ (ПРИОРИТЕТ)
### Фаза 1: Каркас (MVP)
1. `wails init -n invoice-generator -t react-ts`
2. Настроить TailwindCSS
3. Создать SQLite database.go + миграции
4. Создать models.go
5. Создать app.go с базовыми Bind-методами (CRUD)
6. Создать Sidebar + роутинг по табам
7. Создать InvoicePage (форма без AI)
8. Создать ClientsPage + ProductsPage (таблицы)
9. Загрузить тестовые данные
10. Собрать и проверить
### Фаза 2: Google Sheets
11. Создать sheets.go (API клиент)
12. Создать sync.go (логика синхронизации)
13. Добавить кнопки синхронизации на страницы
14. Настроить SettingsPage (Sheet ID, Service Key)
### Фаза 3: AI
15. Создать AI сервис (OpenRouter API)
16. Добавить парсинг реквизитов на AddClientPage
17. Добавить AI-команды на InvoicePage
18. Добавить голосовой ввод (MediaRecorder)
### Фаза 4: Excel
19. Создать шаблон .xlsx
20. Генерация Excel через ExcelJS
21. PDF экспорт (опционально)
---
## ВАЖНЫЕ ЗАМЕЧАНИЯ
1. **Portable:** Приложение должно быть одним .exe файлом. SQLite база создаётся рядом с .exe при первом запуске.
2. **Нет статусов у счетов.** Только комментарий.
3. **Google Sheets = Master.** При конфликте данные из Sheets перезаписывают локальные.
4. **Поиск товаров** должен работать МГНОВЕННО из SQLite при вводе текста (LIKE запрос).
5. **Сумма прописью** генерируется автоматически при изменении итоговой суммы.
6. **НДС:** три режима — Без НДС, НДС 20% включён в цену, НДС 20% сверху.
7. **Две компании-поставщика:** ИП Ковальчук и ООО Завод Плитки — выбор через dropdown.
8. **Синхронизация:** На каждой странице справочника есть кнопка и дата последней синхронизации.
