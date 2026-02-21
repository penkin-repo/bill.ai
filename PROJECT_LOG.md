
# Project Status: bill.ai

**Last Updated:** 2026-02-20 15:34 (UTC+03:00)
**Current Phase:** Phase 5 — Local-first синхронизация + AI улучшения

## 🚀 Active Context
* **Current Task:** Добавлены удаление компании в разделе "Мои компании" и фикс FK-падения при ручной загрузке из Google (Clients/MyCompanies)
* **Next Step:** По желанию — добавить дружелюбную подсказку, если удаление клиента/компании блокируется связанными счетами (вместо raw SQL ошибки)

## 🛠 Tech Stack & Versions
* **Go:** Wails v2
* **Node:** pnpm + React 18 + TypeScript + Vite
* **DB:** SQLite (modernc.org/sqlite)

## 🐛 Known Bugs / Issues
* [ ] [Low] Tailwind директивы `@tailwind` подсвечиваются IDE как "Unknown at rule" (editor warning, не влияет на сборку)
* [ ] [Low] Ширины колонок из шаблона могут не восстанавливаться если шаблон не задаёт явные ширины (ExcelJS возвращает undefined)
* [x] (Fixed) SeedTestData: убраны тестовые продукты/счета — товары только из JSON (373 позиции)
* [x] (Fixed) SearchProducts: SQLite LIKE не поддерживает Unicode case folding — перенесено в Go (strings.ToLower)
* [x] (Fixed) InvoicePage: поиск товаров всегда через backend, убран stale fallback на локальный массив
* [x] (Fixed) ProductsPage/InvoicePage: многословный поиск с AND (каждое слово в name/category)

## 📝 Recent Changes (Changelog)
* [2026-02-16] Инициализирован проект Wails + React; настроен pnpm; добавлена SQLite миграция (modernc.org/sqlite)
* [2026-02-17] Добавлен Sidebar (Lucide icons) и routing по `activeTab` (Invoice/Clients/Products/Companies/Settings)
* [2026-02-17] Реализован `SeedTestData()` и вызов при пустой базе при старте приложения
* [2026-02-17] Реализованы SQL методы `GetAll*/Search*` для clients/products (LIKE по name/inn)
* [2026-02-17] SeedTestData: товары приведены к 30 позициям и 8 категориям (включая «Аренда спецтехники»)
* [2026-02-17] ProductsPage: добавлены таблица, поиск и фильтр по категориям для тестирования
* [2026-02-17] Начат Excel Engine: добавлен генератор ExcelJS (template fetch + insertRow) и num2words.ru утилита
* [2026-02-17] Phase 3 старт: добавлен Google Sheets client (sheets/v4) + SyncAll (download→upsert) + Settings UI + OpenRouter AI service
* [2026-02-17] Write-back flow: UploadClient/UploadProduct/UploadInvoice (AppendRow) + UpsertClient/UpsertInvoice (Google→SQLite)
* [2026-02-17] InvoicePage: AI parseCommand → SearchClients/SearchProducts → автозаполнение позиций
* [2026-02-17] InvoicePage: "Сохранить и скачать" — validation → UpsertInvoice (Google→SQLite) → generateInvoice → SaveInvoiceFile
* [2026-02-17] UI: внедрён чистый dashboard layout — тёмный Sidebar фиксированной ширины + светлый контент (Tailwind)
* [2026-02-17] Sidebar: добавлена кнопка "Синхронизировать" с анимацией вращения (Lucide `RefreshCw`) на время `SyncAll()`
* [2026-02-17] InvoicePage: форма обёрнута в белую карточку `shadow-sm`, разделена на блоки «Поставщик/Покупатель», «Позиции», «Итого»; таблица позиций в Stripe-style (clean lines)
* [2026-02-17] SettingsPage: выровнен под новый светлый dashboard стиль
* [2026-02-17] UI: приближение к референсу — Sidebar брендинг InvoiceAI + blue active-state; InvoicePage: header с primary action, AI input row (input+mic+send) + chips, карточки формы и итог справа
* [2026-02-17] ProductsPage переведена в режим просмотра (read-only): только таблица + синхронизация
* [2026-02-17] InvoicePage: при текстовой команде ИИ выбирает товар по списку локальных продуктов и возвращает id
* [2026-02-18] **Переход на локальный JSON-справочник**: отказ от парсинга Google Sheets для товаров; данные берутся из `Products/Products.json` (embedded go:embed)
* [2026-02-18] Добавлен `internal/database/seed.go`: `SeedProductsFromJSON()` парсит JSON (paving_slabs/curbs), разворачивает шаблоны по цветам → `ReplaceProducts`; `ProductCount()` для проверки первого запуска
* [2026-02-18] `app.go`: seed при первом запуске (products=0), `UpsertProduct` теперь локальный (без Google), добавлены `DeleteProduct`, `ResetProductsToFactory`, `ImportProductsFromJSON`
* [2026-02-18] `SyncAll` больше не вызывает `SyncProducts` — товары управляются локально
* [2026-02-18] ProductsPage: восстановлены кнопки Добавить/Редактировать/Удалить, кнопка «Сброс к заводским настройкам»
* [2026-02-18] SeedTestData: убраны тестовые продукты и счета — остались только компании и клиенты; товары теперь только из JSON (373 позиции)
* [2026-02-18] SearchProducts (Go): многословный поиск с AND — каждое слово должно совпадать в name или category (например «оригами Гладкий»)
* [2026-02-18] ProductsPage: поиск по нескольким словам (AND) по name+category+unit
* [2026-02-18] InvoicePage: расширена колонка названия товара (minWidth 320px), выпадающий список ограничен maxWidth 600px с переносом слов
* [2026-02-18] InvoicePage: товары переведены на карточный двухстрочный layout (строка 1 — номер + наименование с поиском, строка 2 — ед./кол-во/цена/сумма/удалить)
* [2026-02-18] `loadProductsJSON()`: Products.json читается из файла рядом с exe (portable), fallback на embedded go:embed; используется в startup seed и ResetProductsToFactory
* [2026-02-18] InvoicePage: поиск товаров всегда через backend (GetAllProducts/SearchProducts), убран fallback на локальный массив products из AppContext
* [2026-02-18] SearchProducts: фильтрация перенесена в Go (strings.ToLower + strings.Contains) — SQLite LIKE/LOWER() не поддерживают Unicode case folding для кириллицы
* [2026-02-18] SettingsPage: список AI-моделей теперь динамический CRUD (добавить/редактировать/удалить) вместо захардкоженного; хранится в SQLite setting `ai_models` как JSON
* [2026-02-18] UpsertClient/UpsertCompany/UpsertInvoice: сохранение сначала локально в SQLite, Google Sheets — опциональная синхронизация (не обязательна)
* [2026-02-18] `formatOpenRouterError()`: человекочитаемые ошибки AI на русском — парсит JSON-ответ OpenRouter, распознаёт типичные коды (400/402/429, not enabled, rate limit, context length)
* [2026-02-18] `mapModelName()`: теперь async, читает названия из динамического списка моделей (setting `ai_models`) вместо хардкода
* [2026-02-19] **Local-first синхронизация**: sync.go полностью переписан — header-based чтение/запись по названиям столбцов (row 1)
* [2026-02-19] SyncAll: upload всех локальных в Google → download только НОВЫХ из Google (по ID, существующие не перезаписываются)
* [2026-02-19] ForceUploadToGoogle: полная перезапись Google Sheets локальными данными (clear + write header + data)
* [2026-02-19] ForceDownloadFromGoogle: полная перезапись локальной базы данными из Google (clear local + upsert all)
* [2026-02-19] Добавлены DB-методы: GetAllInvoices, ClientExists, MyCompanyExists, InvoiceExists, ClearClients, ClearMyCompanies, ClearInvoices
* [2026-02-19] SettingsPage: кнопки принудительной синхронизации с двойным confirm(); обновлена архитектура на local-first
* [2026-02-19] UploadClient/UploadMyCompany: исправлено дублирование в Google Sheets — теперь upsert по `id` (обновление найденной строки, append только для новых)
* [2026-02-19] MyCompanies: Google headers обновлены до `id,name,short_name,inn,kpp,ogrn,address,bank_name,bank_bik,bank_account,bank_corr_account,director_name,director_title,phone,email,comment` (stamp/signature удалены)
* [2026-02-19] MyCompanies: модель/DB-upsert/UI обновлены под поле `comment`; добавлена миграция `ALTER TABLE my_companies ADD COLUMN comment`
* [2026-02-19] ID политика: для Clients/MyCompanies ID теперь всегда = ИНН (frontend + backend валидация)
* [2026-02-19] CompaniesPage: добавлены кнопки sync + force upload/download с двойным подтверждением и состояниями загрузки
* [2026-02-19] Fix: `SearchClients` переведён с SQLite `LIKE` на Go-side фильтрацию (`strings.ToLower` + `strings.Contains`) для корректного поиска по кириллице во вкладке «Клиенты» и в выборе покупателя на InvoicePage
* [2026-02-19] Invoices sync: Google headers упрощены до `id,date,client,sum, rub,comment,technical_json`; `id` = номер счёта
* [2026-02-19] `technical_json`: при upload сохраняется полный invoice JSON; при download поддержан fallback — если JSON пустой/битый, создаётся минимальный счёт из `id/date/client/sum/comment`
* [2026-02-19] `UploadInvoice` переведён на upsert по `id` (update existing row / append new) вместо всегда `AppendRow`
* [2026-02-19] InvoicesRegistryPage: добавлены force sync кнопки (Local→Google / Google→Local) с confirm и loading state
* [2026-02-19] AppContext: восстановлена загрузка `GetAllInvoices()` и нормализация invoice для реестра
* [2026-02-19] Invoices headers обновлены: добавлен `my_company_name` (`id,date,client,my_company_name,sum, rub,comment,technical_json`)
* [2026-02-19] InvoicePage: сохранение счёта через local-first `UpsertInvoice` (локальная запись + upsert в Google при настроенной интеграции)
* [2026-02-19] Добавлены backend API для счетов: `DeleteInvoice`, `DownloadInvoiceFromGoogle`, `GetNextInvoiceNumber`
* [2026-02-19] Автонумерация счетов по компании: `GetNextInvoiceNumberForCompany` смотрит последнюю дату в базе и max numeric номер на этой дате (fallback на global max)
* [2026-02-19] InvoicesRegistryPage: добавлены действия `Редактировать`, `Удалить`, `Скачать из Google снова`, `Скачать снова` (повторная генерация XLSX)
* [2026-02-19] Import invoices from Google: если `client`/`my_company_name` не сопоставляются, создаются минимальные записи Client/MyCompany для корректной привязки счета
* [2026-02-19] Добавлены локальные таблицы `invoice_templates` и `client_invoice_templates` (без Google sync)
* [2026-02-19] Bootstrap шаблонов: по умолчанию создаётся `vat_included_test` с путём `/templates/vat_included_test.xlsx`; для клиента при первом запросе шаблон привязывается как default
* [2026-02-19] App API: привязка шаблонов переключена на my company (`GetMyCompanyInvoiceTemplates`, `SetMyCompanyInvoiceTemplate`)
* [2026-02-19] InvoicePage: НДС-опции и выбор шаблона теперь определяются по выбранной моей компании
* [2026-02-19] excelGenerator: поддержка текстовых плейсхолдеров `{{...}}`, поиск строки-эталона товаров (`{{item_*}}`) и аккуратное дублирование строк с сохранением визуального стиля
* [2026-02-19] Добавлена таблица `my_company_invoice_templates` + индекс `idx_my_company_invoice_templates_company`
* [2026-02-19] ClientsPage: UI привязки шаблонов удалён (по требованию — в клиентах привязки быть не должно)
* [2026-02-19] CompaniesPage: добавлена кнопка `Шаблоны счета` по компании и модальное окно привязок по VAT-режимам (Привязать / Сделать по умолчанию)
* [2026-02-19] Убран авто-bootstrap default привязки шаблона для my company (привязка теперь только вручную)
* [2026-02-19] App API: добавлены `RemoveMyCompanyInvoiceTemplate` и `UpsertInvoiceTemplate` для отвязки и добавления шаблонов из UI
* [2026-02-19] CompaniesPage: модалка шаблонов обновлена — действия `Привязать`, `Удалить`, блок `Добавить шаблон в каталог` (ID/Name/Path/VAT)
* [2026-02-19] InvoicePage: `refreshData()` перенесён сразу после `UpsertInvoice`, чтобы запись попадала в локальный реестр даже если генерация/скачивание Excel завершились ошибкой
* [2026-02-19] excelGenerator: добавлен hardening workbook metadata (`date1904=false`) перед/после load/write для устранения ошибки `Cannot read properties of undefined (reading 'date1904')`
* [2026-02-19] excelGenerator: добавлен hardening `calcProperties.fullCalcOnLoad` для устранения ошибки `Cannot read properties of undefined (reading 'fullCalcOnLoad')`
* [2026-02-19] excelGenerator: `{{invoice_date}}` теперь форматируется как `19 февраля 2026 г.`; добавлен `{{invoice_date_iso}}` для ISO-формата
* [2026-02-19] excelGenerator: имя сохраняемого файла изменено на `Счет №N от DD.MM.YYYY КомпанияОтКоторой.xlsx` (функция `buildInvoiceFileName`)
* [2026-02-19] excelGenerator: шаблон теперь реально применяется — `normalizeTemplatePath` гарантирует ведущий `/` для fetch; добавлен `console.warn` при HTTP-ошибке загрузки шаблона
* [2026-02-19] excelGenerator: плейсхолдеры в шапке/подвале шаблона заменяются корректно (eachRow pass только по не-товарным строкам)
* [2026-02-19] excelGenerator: formula-ячейки с плейсхолдерами конвертируются в plain string (исправлен `cellValueAsString` + `replaceCellPlaceholders`)
* [2026-02-19] excelGenerator: добавлен alias `{{items_count_text}}` = `{{items_count_words}}`
* [2026-02-19] excelGenerator: snapshot/restore ширин колонок через `getColumn(n).width` (предотвращает авто-расширение ExcelJS)
* [2026-02-19] excelGenerator: критический фикс дублирования строк 3+ — snapshot merge до `spliceRows`, skipCols передаётся в `copyRowVisual` снаружи
* [2026-02-19] excelGenerator: фикс дублирования в Итого/подвале — `mergeNonFirstByRow` map для всех строк листа при eachRow замене плейсхолдеров
* [2026-02-19] excelGenerator: `applyMergedReplicas` принимает `snapshotMerges` (не читает из ws.model после сдвига строк)
* [2026-02-19] InvoicePage: импортирован и используется `buildInvoiceFileName` для имени сохраняемого файла
* [2026-02-19] excelGenerator: критический фикс merge для строк 3+: `mergeSnapshot` вынесен за пределы `if(extraRows>0)`, `applyMergedReplicas` вызывается ДО `copyRowVisual`
* [2026-02-19] excelGenerator: `mergeNonFirstByRow` для Итого/подвала строится из текущего `ws.model.merges` (после всех `spliceRows`) — номера строк уже правильные; обрабатываются только горизонтальные merge (r1===r2)
* [2026-02-19] excelGenerator: заполнение строк товаров также пропускает не-первые ячейки merge через `itemSkipCols`
* [2026-02-19] excelGenerator: поддержаны оба синтаксиса плейсхолдеров — `{{key}}` и `{key}` (replaceText + formula detection)
* [2026-02-19] excelGenerator: диапазон копирования/заполнения строки товара ограничен колонками, где реально есть item-плейсхолдеры (`getItemTemplateMaxCol`), чтобы не зацеплять дальние объединённые ячейки
* [2026-02-19] Backend Excel migration: добавлен `internal/excel/invoice_generator.go` на `github.com/xuri/excelize/v2` (template-based генерация, DuplicateRow для товарных строк, placeholder replace, money format, вставка `assets/stamp.png` и `assets/signature.png` на `last_item_row + 3`)
* [2026-02-19] App API: добавлен метод `GenerateInvoice(inv, company, client, templatePath, openAfterSave)` — генерация в Go, SaveFileDialog, запись файла, опциональное открытие
* [2026-02-19] Frontend: `InvoicePage.tsx` и `InvoicesRegistryPage.tsx` переключены с frontend ExcelJS (`generateInvoiceXlsx`/`SaveInvoiceFile`) на backend `App.GenerateInvoice`
* [2026-02-19] go.mod: добавлена зависимость `github.com/xuri/excelize/v2 v2.9.0` для backend Excel генерации
* [2026-02-19] Проверка окружения после миграции: `go mod tidy` (OK), `go build ./...` (OK), `pnpm --dir frontend build` (OK)
* [2026-02-19] excelize generator: фикc бордеров в таблице — денежный формат (NumFmt=4) теперь применяется с сохранением исходного стиля/границ ячейки (`applyMoneyNumFmtPreserveStyle`)
* [2026-02-19] InvoicePage: добавлен `savingInvoice` state + disabled/loader (`Loader2`) на кнопку «Сохранить счёт» во время `handleFinalize`
* [2026-02-19] InvoicePage: устранена потеря шаблона после сохранения — удалён принудительный сброс `setCompanyTemplates([])` и `setSelectedTemplateId('')`
* [2026-02-19] InvoicePage: верхняя панель с кнопкой «Сохранить счёт» сделана sticky (`position: sticky; top: 0`) — действие всегда в зоне видимости
* [2026-02-19] VAT migration: расчёты и UI переведены с 20% на 22% (InvoicePage + InvoicesRegistryPage, включая labels/preview/редактирование)
* [2026-02-19] InvoicesRegistryPage: исправлен «Скачать снова» — теперь берётся фактический шаблон из привязок `GetMyCompanyInvoiceTemplates`, а не захардкоженные `/templates/template_*.xlsx`
* [2026-02-19] InvoicesRegistryPage: удалено действие «Скачать из Google снова» из списка действий счета (local-first поток)
* [2026-02-19] InvoicesRegistryPage: добавлены loading-state индикаторы для скачивания и удаления счета (`downloadingInvoiceId` / `deletingInvoiceId`)
* [2026-02-19] InvoicesRegistryPage: модалка редактирования расширена — редактирование позиций счёта (в т.ч. из `items_json`), пересчёт subtotal/vat/total, быстрый выбор из каталога товаров
* [2026-02-19] SettingsPage: полностью удалены импорт/логика/UI «Тестовые данные» (`loadTestData`, секция и кнопка загрузки тестовых данных)
* [2026-02-19] App API: добавлен метод `ConvertXlsxToPDF(xlsxPath)` — backend-конвертация через PowerShell + COM (`Excel.Application`, `ExportAsFixedFormat`) с сохранением PDF рядом с XLSX
* [2026-02-19] InvoicePage: чекбокс «Также скачать в PDF» теперь вызывает backend `ConvertXlsxToPDF(savedXlsxPath)` после `GenerateInvoice`; frontend preview-PDF код удалён
* [2026-02-19] frontend/package.json: удалены зависимости `html2canvas` и `jspdf` (клиентская screenshot-конвертация больше не используется)
* [2026-02-19] main.go: стартовое окно увеличено до ~1300x860; добавлен single-instance lock через `net.Listen(127.0.0.1:35173)` (повторный запуск блокируется)
* [2026-02-19] app.go: в startup добавлен auto-limit размера окна по текущему экрану (`ScreenGetAll` + `WindowSetSize` + `WindowCenter`)
* [2026-02-19] app.go: `loadProductsJSON()` в build читает только `Products.json` рядом с exe; embedded fallback оставлен только для DEV-окружения
* [2026-02-19] app.go/database: убран авто-bootstrap тестового шаблона; в build не создаётся `vat_included_test` по умолчанию
* [2026-02-19] Шаблоны: `UpsertInvoiceTemplate` нормализует шаблон по имени файла (basename), ID/Name можно не заполнять (генерируются автоматически)
* [2026-02-19] Добавлен backend API `DeleteInvoiceTemplate` + DB-метод полного удаления шаблона из каталога (с отвязкой от компаний)
* [2026-02-19] CompaniesPage: UI шаблонов обновлён — поле ID необязательно, путь заменён на «имя файла рядом с exe», добавлена кнопка полного удаления шаблона из программы
* [2026-02-19] ProductsPage: тексты «Сброс к заводским» уточнены как загрузка из `Products.json` рядом с exe
* [2026-02-19] Проверка: `go build ./...` (OK), `pnpm --dir frontend build` (OK)
* [2026-02-20] Frontend: добавлен `frontend/src/services/wailsApp.ts` — типизированный facade над сгенерированными Wails bindings (`wailsjs/go/main/App`)
* [2026-02-20] Frontend: добавлен `frontend/src/utils/invoiceMath.ts` (`VAT_RATE`, `calcTotalsBySubtotal`, `calcTotalsByItems`) и подключён в `InvoicePage`/`InvoicesRegistryPage`
* [2026-02-20] `InvoicePage.tsx`: удалён `api(){ return (window as any)?.go?.main?.App }`, все backend-вызовы переведены на типизированные imports из `services/wailsApp`
* [2026-02-20] `InvoicesRegistryPage.tsx`: удалён `api()` hack, force-sync/save/download/delete переведены на типизированные calls, расчёты totals переведены на `invoiceMath`
* [2026-02-20] Декомпозиция `InvoicePage`: вынесены подкомпоненты `invoice/InvoiceActionBar.tsx` и `invoice/InvoiceTotalsSummary.tsx`
* [2026-02-20] Проверка после рефакторинга: `pnpm --dir frontend build` (OK), `go build ./...` (OK)
* [2026-02-20] `InvoicesRegistryPage`: добавлен типизированный модуль `components/invoiceRegistry/types.ts` (`InvoiceEditDraft`, `EditableItem`, `VatMode`)
* [2026-02-20] `InvoicesRegistryPage`: модалка редактирования счета вынесена в `components/invoiceRegistry/InvoiceEditModal.tsx`
* [2026-02-20] `InvoicesRegistryPage`: `editDraft` переведён с `any` на `InvoiceEditDraft | null`; `setEditVatMode` типизирован через `VatMode`
* [2026-02-20] Проверка после шага 2 рефакторинга: `pnpm --dir frontend build` (OK), `go build ./...` (OK)
* [2026-02-20] `InvoicesRegistryPage`: parse/normalize helpers вынесены в `components/invoiceRegistry/draftUtils.ts`
* [2026-02-20] `InvoicesRegistryPage`: detail modal просмотра счета вынесена в `components/invoiceRegistry/InvoiceDetailModal.tsx`
* [2026-02-20] `InvoicesRegistryPage`: удалён inline JSX detail modal; страница использует `<InvoiceDetailModal />`
* [2026-02-20] Проверка после шага 3 рефакторинга: `pnpm --dir frontend build` (OK), `go build ./...` (OK)
* [2026-02-20] Performance: backend invoices API расширен методами `CountInvoices(query)` и `SearchInvoices(query, limit, offset)` (SQLite-side filtering + LIMIT/OFFSET)
* [2026-02-20] Performance: `InvoicesRegistryPage` переведён на server-side загрузку счетов (debounced search + pagination 50/page), убрана full in-memory фильтрация всего реестра
* [2026-02-20] Performance: `AppContext.refreshData` больше не вызывает `GetAllInvoices()` — в глобальный контекст загружаются только clients/products/companies
* [2026-02-20] Wails bindings/service: добавлены frontend-обертки `CountInvoices`/`SearchInvoices` для типизированного вызова из UI
* [2026-02-20] Проверка после performance-шага: `pnpm --dir frontend build` (OK), `go build ./...` (OK)
* [2026-02-20] UX/Errors: добавлен `ToastProvider` (`frontend/src/context/ToastContext.tsx`) с `pushToast(message, kind)` и глобальным toast viewport
* [2026-02-20] UX/Errors: `InvoicePage` и `InvoicesRegistryPage` переведены с `alert(...)` на неблокирующие toast-уведомления
* [2026-02-20] Numeric safety: добавлен `frontend/src/utils/number.ts` (`parseLocaleNumber`) для корректного ввода `1,5` и `1.5`
* [2026-02-20] Numeric safety: `InvoicePage` и `invoiceRegistry/InvoiceEditModal` переведены на `parseLocaleNumber` вместо `parseFloat(... ) || 0`
* [2026-02-20] Проверка после UX/Numeric-шага: `pnpm --dir frontend build` (OK), `go build ./...` (OK)
* [2026-02-20] Voice safety: `InvoicePage` — добавлены `mediaStreamRef` + `releaseMediaResources()`; теперь stop/unmount гарантированно останавливают все audio tracks
* [2026-02-20] Voice safety: `startRecording` защищён от повторного запуска при активной записи; `onstop` синхронизирует `isRecording=false` и чистит ресурсы
* [2026-02-20] Проверка после voice-safety-шага: `pnpm --dir frontend build` (OK), `go build ./...` (OK)
* [2026-02-20] UX/Errors: `SettingsPage`, `ProductsPage`, `CompaniesPage` переведены с `alert(...)` на `pushToast(...)` (неблокирующие уведомления)
* [2026-02-20] Search fix (Invoices Registry): backend `SearchInvoices/CountInvoices` переписаны на Go-side Unicode-фильтрацию по словам с `strings.ToLower` и поиском не только по ID/comment, но и по `clients.name` + `my_companies.short_name/name`
* [2026-02-20] Search fix (Invoices Registry): добавлены `LEFT JOIN clients/my_companies` в поиск счетов; пагинация сохраняется после фильтрации
* [2026-02-20] Проверка после search+toast-шага: `pnpm --dir frontend build` (OK), `go build ./...` (OK)
* [2026-02-20] Registry filters: `InvoicesRegistryPage` переведен на 3 поля поиска (общий текст, "От кого", "Только номер счёта") с отправкой структурированного JSON-запроса в backend
* [2026-02-20] Registry filters: `internal/database/invoices.go` добавлен parser `invoiceSearchFilter{text,company,number}`; `CountInvoices/SearchInvoices` поддерживают новый формат и сохраняют backward compatibility для старой строки query
* [2026-02-20] Registry filters: в `getInvoiceSearchRows` поле компании расширено до `short_name + name` для более точного поиска по "От кого"
* [2026-02-20] Проверка после registry-filters-шага: `pnpm --dir frontend build` (OK), `go build ./...` (OK)
* [2026-02-20] Invoices Registry UI: из таблицы удалены колонки "НДС" и "Позиций"; таблица оставлена в формате №/Дата/От кого/Покупатель/Сумма/Действия
* [2026-02-20] Invoices Registry UI: обновлены `colSpan` в states loading/empty с 8 до 6 после удаления двух колонок
* [2026-02-20] Проверка после table-columns-шага: `pnpm --dir frontend build` (OK)
* [2026-02-20] Stability/SQLite: `internal/database/database.go` — добавлены DB-конфиги `SetMaxOpenConns(1)`, `SetMaxIdleConns(1)` + PRAGMA `journal_mode=WAL`, `busy_timeout=5000`, `synchronous=NORMAL`, `foreign_keys=ON` для снижения `database is locked/busy` в desktop build
* [2026-02-20] Stability/Settings: `internal/database/settings.go` — `GetSetting`/`SetSetting` переведены на retry (до 3 попыток) при `SQLITE_BUSY/database is locked`
* [2026-02-20] Settings UX: `SettingsPage` сохранение Google-настроек переведено с `Promise.all` на последовательные `await SetSetting(...)`, чтобы убрать параллельные записи в SQLite
* [2026-02-20] AI model source: `frontend/src/services/aiService.ts` удалён хардкод fallback `google/gemini-flash-1.5`; теперь берётся `ai_model`, иначе первый ID из `ai_models`, иначе явная ошибка "AI модель не выбрана"
* [2026-02-20] App defaults: `AppContext` убран дефолт `gemini` для `settings.aiModel` (теперь пустая строка), чтобы UI отражал реальную сохранённую настройку
* [2026-02-20] Проверка после sqlite+ai-fix-шага: `pnpm --dir frontend build` (OK), `go build ./...` (OK)
* [2026-02-20] Clients UI: в `ClientsPage` добавлена кнопка удаления (иконка Trash) в колонке действий + состояние `deletingClientId` для блокировки повторного клика
* [2026-02-20] Clients backend: добавлен `DeleteClient` в `internal/database/clients.go` и exposed-метод `App.DeleteClient` в `app.go`
* [2026-02-20] Google sync: добавлен `SyncService.DeleteClient` (очистка строки в листе `Clients` по `id`) и вызов из `App.DeleteClient` при настроенной синхронизации
* [2026-02-20] Проверка после delete-client-шага: `go build ./...` (OK), `pnpm --dir frontend build` (OK)
* [2026-02-20] Companies UI: в `CompaniesPage` добавлена кнопка удаления компании (иконка Trash) + состояние `deletingCompanyId` и confirm-диалог
* [2026-02-20] Companies backend: добавлены `DeleteMyCompany` (DB + App) и `SyncService.DeleteMyCompany` для удаления строки в листе `MyCompanies` по `id`
* [2026-02-20] FK fix (force download): `SyncService.ForceDownloadFromGoogle` теперь сначала очищает зависимые таблицы (`invoices` + template bindings), и только потом `clients/my_companies` — устранена ошибка `clear local clients: FOREIGN KEY constraint failed (787)`
* [2026-02-20] FK fix (bindings): добавлены методы `ClearTemplateBindings`, `RemoveMyCompanyTemplateBindings`, `RemoveClientTemplateBindings` для безопасной очистки/удаления связей
* [2026-02-20] Проверка после companies-delete+fk-fix-шага: `go build ./...` (OK), `pnpm --dir frontend build` (OK)

## 📂 Key Files Map
* `app.go` — Wails App: startup, loadProductsJSON (portable→embedded fallback), все exposed методы
* `frontend/src/components/Sidebar.tsx` — Sidebar (Bill.ai) + секции меню + last sync
* `frontend/src/components/InvoicePage.tsx` — Выставление счёта: двухстрочный layout товаров, поиск через backend
* `frontend/src/components/ProductsPage.tsx` — Каталог товаров: таблица, поиск (AND), CRUD, сброс к заводским
* `frontend/src/context/AppContext.tsx` — глобальный state справочников (clients/products/companies/settings) без полной загрузки invoices
* `frontend/src/App.tsx` — routing по `activeTab`
* `internal/database/database.go` — SQLite init/migrations + SeedTestData
* `internal/database/products.go` — GetAllProducts/SearchProducts (Go-side Unicode filtering)
* `internal/database/clients.go` — GetAllClients/SearchClients
* `internal/database/seed.go` — SeedProductsFromJSON (JSON→плоский список→ReplaceProducts)
* `internal/database/upsert.go` — SQLite upsert methods
* `internal/database/settings.go` — key-value настройки (SQLite)
* `internal/database/sync_log.go` — лог синхронизаций
* `internal/models/models.go` — модели данных
* `internal/google/sheets.go` — Google Sheets API v4 client (Service Account)
* `internal/google/sync.go` — Local-first синхронизация + upsert single-record upload по ID (Clients/MyCompanies/Invoices), header-based; invoices через `technical_json`
* `internal/database/invoices.go` — GetAllInvoices, *Exists, Clear* методы
* `frontend/src/components/InvoicesRegistryPage.tsx` — реестр счетов + sync/force-sync UI
* `internal/database/invoices.go` — + DeleteInvoice, GetNextInvoiceNumberForCompany
* `frontend/src/components/InvoicePage.tsx` — автонумерация по компании + local-first сохранение счета
* `internal/database/invoice_templates.go` — локальный каталог шаблонов счетов + привязка шаблонов к моей компании
* `frontend/src/components/CompaniesPage.tsx` — UI привязки шаблонов счета к моей компании (по VAT-режимам)
* `frontend/src/services/excelGenerator.ts` — генерация по плейсхолдерам `{{...}}` + дублирование строк товаров из шаблона
* `frontend/src/components/CompaniesPage.tsx` — UI «Мои компании»: ID=ИНН, sync/force-sync кнопки, loading states, поле comment
* `frontend/src/components/AddClientPage.tsx` / `frontend/src/components/ClientsPage.tsx` — ID=ИНН + loading states при сохранении
* `Products/Products.json` — embedded каталог товаров (шаблоны + цвета + цены, 373 позиции)
* `frontend/src/services/ai.ts` — OpenRouter parseCommand (strict JSON)
* `frontend/src/pages/SettingsPage.tsx` — UI настроек (Sheet ID, Service Key, API Key, SyncAll)

