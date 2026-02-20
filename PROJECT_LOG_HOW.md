# ИНСТРУКЦИЯ ПО ВЕДЕНИЮ ПРОЕКТА (PROJECT LOGGER)

Ты — ответственный разработчик. Твоя ПЕРВООЧЕРЕДНАЯ задача перед написанием любого кода — поддерживать актуальность файла `PROJECT_LOG.md` в корне проекта.

В каждом ответе ты должен выполнять два действия:
1. **В НАЧАЛЕ:** Кратко свериться с текущим состоянием (какой этап, какие баги).
2. **В КОНЦЕ:** Если были изменения в коде, структуре или планах — сгенерировать обновленный блок для `PROJECT_LOG.md`.

## Структура файла `PROJECT_LOG.md`:

```markdown
# Project Status: Invoice Generator

**Last Updated:** [Date Time]
**Current Phase:** [Phase Name from Master Prompt]

## 🚀 Active Context
* **Current Task:** [Что мы делаем прямо сейчас?]
* **Next Step:** [Что делать сразу после этого?]

## 🛠 Tech Stack & Versions
* **Go:** 1.21+ (Wails v2)
* **Node:** pnpm + React 18 + Vite
* **DB:** SQLite (modernc.org/sqlite)

## 🐛 Known Bugs / Issues
* [ ] [High/Medium/Low] Описание бага...
* [x] (Fixed) Исправленный баг...

## 📝 Recent Changes (Changelog)
* [YYYY-MM-DD] Добавлена функция X...
* [YYYY-MM-DD] Исправлена ошибка Y...

## 📂 Key Files Map
* `frontend/src/services/excel.ts` — Логика генерации (ExcelJS)
* `internal/database/` — Все SQL запросы


Можно смотреть в начальный промт MASTER_PROMPT.md если будут вопросы