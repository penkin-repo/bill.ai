package excel

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"bill.ai/internal/models"
	"github.com/xuri/excelize/v2"
)

type itemCols struct {
	RowNo  int
	Title  int
	Qty    int
	Unit   int
	Price  int
	Amount int
}

func GenerateInvoiceXLSX(inv models.Invoice, company models.MyCompany, client models.Client, templatePath string) ([]byte, string, error) {
	tpl, err := resolveTemplatePath(templatePath)
	if err != nil {
		return nil, "", err
	}

	f, err := excelize.OpenFile(tpl)
	if err != nil {
		return nil, "", fmt.Errorf("open template: %w", err)
	}
	defer func() { _ = f.Close() }()

	sheet := f.GetSheetName(0)
	if sheet == "" {
		sheet = "Sheet1"
	}

	items := parseItems(inv.ItemsJSON)
	if len(items) == 0 {
		items = []models.InvoiceItem{{}}
	}

	rowNo, cols := findItemTemplateRowAndCols(f, sheet)
	if rowNo > 0 {
		extraRows := len(items) - 1
		for i := 0; i < extraRows; i++ {
			if err := f.DuplicateRow(sheet, rowNo+i); err != nil {
				return nil, "", fmt.Errorf("duplicate row: %w", err)
			}
		}

		for i, it := range items {
			r := rowNo + i
			rowMap := map[string]string{
				"row_no":      strconv.Itoa(i + 1),
				"item_name":   it.Name,
				"item_qty":    formatFloat(it.Quantity),
				"item_unit":   it.Unit,
				"item_price":  formatFloat(it.Price),
				"item_amount": formatFloat(it.Sum),
			}
			if cols.RowNo > 0 {
				cc := cell(cols.RowNo, r)
				cur, _ := f.GetCellValue(sheet, cc)
				_ = f.SetCellStr(sheet, cc, replaceTextBoth(cur, rowMap))
			}
			if cols.Title > 0 {
				cc := cell(cols.Title, r)
				cur, _ := f.GetCellValue(sheet, cc)
				_ = f.SetCellStr(sheet, cc, replaceTextBoth(cur, rowMap))
			}
			if cols.Qty > 0 {
				_ = f.SetCellValue(sheet, cell(cols.Qty, r), it.Quantity)
			}
			if cols.Unit > 0 {
				cc := cell(cols.Unit, r)
				cur, _ := f.GetCellValue(sheet, cc)
				_ = f.SetCellStr(sheet, cc, replaceTextBoth(cur, rowMap))
			}
			if cols.Price > 0 {
				c := cell(cols.Price, r)
				_ = f.SetCellValue(sheet, c, it.Price)
				applyMoneyNumFmtPreserveStyle(f, sheet, c)
			}
			if cols.Amount > 0 {
				c := cell(cols.Amount, r)
				_ = f.SetCellValue(sheet, c, it.Sum)
				applyMoneyNumFmtPreserveStyle(f, sheet, c)
			}
		}

		lastItemRow := rowNo + len(items) - 1
		imageRow := lastItemRow + 3
		stampPath := resolveOptionalAssetPath("assets/stamp.png")
		signPath := resolveOptionalAssetPath("assets/signature.png")
		if stampPath != "" {
			_ = f.AddPicture(sheet, fmt.Sprintf("A%d", imageRow), stampPath, nil)
		}
		if signPath != "" {
			_ = f.AddPicture(sheet, fmt.Sprintf("F%d", imageRow), signPath, nil)
		}
	}

	commonMap := map[string]string{
		"invoice_number":    inv.InvoiceNumber,
		"invoice_date":      formatRussianDate(inv.InvoiceDate),
		"invoice_date_iso":  inv.InvoiceDate,
		"supplier_name":     firstNonEmpty(company.ShortName, company.Name),
		"supplier_inn":      company.INN,
		"supplier_kpp":      company.KPP,
		"supplier_address":  company.Address,
		"buyer_name":        client.Name,
		"buyer_inn":         client.INN,
		"buyer_kpp":         client.KPP,
		"buyer_address":     client.Address,
		"buyer_phone":       client.Phone,
		"total_subtotal":    formatMoney(inv.Subtotal),
		"total_vat":         formatMoney(inv.VatAmount),
		"total_with_vat":    formatMoney(inv.Total),
		"items_count":       strconv.Itoa(len(items)),
		"items_count_words": itemsCountWords(len(items)),
		"items_count_text":  itemsCountWords(len(items)),
		"total_words":       inv.TotalWords,
		"comment":           inv.Comment,
	}

	rows, _ := f.GetRows(sheet)
	for r := 1; r <= len(rows); r++ {
		for c := 1; c <= len(rows[r-1]); c++ {
			addr := cell(c, r)
			v, err := f.GetCellValue(sheet, addr)
			if err != nil || v == "" {
				continue
			}
			nv := replaceTextBoth(v, commonMap)
			if nv != v {
				_ = f.SetCellStr(sheet, addr, nv)
			}
		}
	}

	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, "", fmt.Errorf("write xlsx: %w", err)
	}

	name := buildInvoiceFileName(inv.InvoiceNumber, inv.InvoiceDate, firstNonEmpty(company.ShortName, company.Name))
	return buf.Bytes(), name, nil
}

func parseItems(itemsJSON string) []models.InvoiceItem {
	itemsJSON = strings.TrimSpace(itemsJSON)
	if itemsJSON == "" {
		return nil
	}
	var items []models.InvoiceItem
	if err := json.Unmarshal([]byte(itemsJSON), &items); err != nil {
		return nil
	}
	return items
}

func findItemTemplateRowAndCols(f *excelize.File, sheet string) (int, itemCols) {
	rows, _ := f.GetRows(sheet)
	for r, row := range rows {
		cols := itemCols{}
		hit := false
		for c, v := range row {
			vv := strings.ToLower(v)
			if strings.Contains(vv, "{{row_no}}") || strings.Contains(vv, "{row_no}") {
				cols.RowNo = c + 1
				hit = true
			}
			if strings.Contains(vv, "{{item_name}}") || strings.Contains(vv, "{item_name}") {
				cols.Title = c + 1
				hit = true
			}
			if strings.Contains(vv, "{{item_qty}}") || strings.Contains(vv, "{item_qty}") {
				cols.Qty = c + 1
				hit = true
			}
			if strings.Contains(vv, "{{item_unit}}") || strings.Contains(vv, "{item_unit}") {
				cols.Unit = c + 1
				hit = true
			}
			if strings.Contains(vv, "{{item_price}}") || strings.Contains(vv, "{item_price}") {
				cols.Price = c + 1
				hit = true
			}
			if strings.Contains(vv, "{{item_amount}}") || strings.Contains(vv, "{item_amount}") {
				cols.Amount = c + 1
				hit = true
			}
		}
		if hit {
			return r + 1, cols
		}
	}
	return -1, itemCols{}
}

func replaceTextBoth(text string, mp map[string]string) string {
	out := text
	for k, v := range mp {
		out = strings.ReplaceAll(out, "{{"+k+"}}", v)
		out = strings.ReplaceAll(out, "{"+k+"}", v)
	}
	return out
}

func resolveTemplatePath(templatePath string) (string, error) {
	candidate := strings.TrimSpace(templatePath)
	if candidate == "" {
		candidate = "assets/template.xlsx"
	}
	if p := resolveOptionalAssetPath(candidate); p != "" {
		return p, nil
	}
	return "", fmt.Errorf("template not found: %s", candidate)
}

func resolveOptionalAssetPath(rel string) string {
	if strings.TrimSpace(rel) == "" {
		return ""
	}
	trimmed := strings.TrimLeft(rel, "/\\")
	candidates := []string{}
	if filepath.IsAbs(rel) {
		candidates = append(candidates, rel)
	}
	cwd, _ := os.Getwd()
	if cwd != "" {
		candidates = append(candidates,
			filepath.Join(cwd, rel),
			filepath.Join(cwd, trimmed),
			filepath.Join(cwd, "frontend", "public", trimmed),
		)
	}
	if exe, err := os.Executable(); err == nil {
		d := filepath.Dir(exe)
		candidates = append(candidates,
			filepath.Join(d, rel),
			filepath.Join(d, trimmed),
			filepath.Join(d, "frontend", "public", trimmed),
		)
	}
	for _, p := range candidates {
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
			return p
		}
	}
	return ""
}

func buildInvoiceFileName(invoiceNumber, invoiceDate, companyShortName string) string {
	datePart := invoiceDate
	if t, err := time.Parse("2006-01-02", invoiceDate); err == nil {
		datePart = t.Format("02.01.2006")
	}
	safeName := strings.TrimSpace(strings.NewReplacer("\\", "_", "/", "_", ":", "_", "*", "_", "?", "_", "\"", "_", "<", "_", ">", "_", "|", "_").Replace(companyShortName))
	if safeName != "" {
		return fmt.Sprintf("Счет №%s от %s %s.xlsx", invoiceNumber, datePart, safeName)
	}
	return fmt.Sprintf("Счет №%s от %s.xlsx", invoiceNumber, datePart)
}

func formatRussianDate(iso string) string {
	months := []string{"января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"}
	t, err := time.Parse("2006-01-02", iso)
	if err != nil {
		if tt, e2 := time.Parse(time.RFC3339, iso); e2 == nil {
			t = tt
		} else {
			return iso
		}
	}
	return fmt.Sprintf("%d %s %d г.", t.Day(), months[int(t.Month())-1], t.Year())
}

func formatMoney(v float64) string {
	s := fmt.Sprintf("%.2f", v)
	parts := strings.Split(s, ".")
	intPart := parts[0]
	frac := "00"
	if len(parts) > 1 {
		frac = parts[1]
	}
	neg := ""
	if strings.HasPrefix(intPart, "-") {
		neg = "-"
		intPart = strings.TrimPrefix(intPart, "-")
	}
	var b bytes.Buffer
	for i, ch := range intPart {
		if i > 0 && (len(intPart)-i)%3 == 0 {
			b.WriteByte(' ')
		}
		b.WriteRune(ch)
	}
	return neg + b.String() + "," + frac
}

func declension(n int, one, two, five string) string {
	abs := n % 100
	if abs < 0 {
		abs = -abs
	}
	n1 := abs % 10
	if abs > 10 && abs < 20 {
		return five
	}
	if n1 > 1 && n1 < 5 {
		return two
	}
	if n1 == 1 {
		return one
	}
	return five
}

func itemsCountWords(n int) string {
	return fmt.Sprintf("%d %s", n, declension(n, "наименование", "наименования", "наименований"))
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func cell(col, row int) string {
	a, _ := excelize.CoordinatesToCellName(col, row)
	return a
}

func formatFloat(v float64) string {
	return strings.ReplaceAll(fmt.Sprintf("%.2f", v), ".", ",")
}

func applyMoneyNumFmtPreserveStyle(f *excelize.File, sheet, cellAddr string) {
	styleID, err := f.GetCellStyle(sheet, cellAddr)
	if err == nil && styleID > 0 {
		if st, e := f.GetStyle(styleID); e == nil && st != nil {
			st.NumFmt = 4
			if newID, e2 := f.NewStyle(st); e2 == nil {
				_ = f.SetCellStyle(sheet, cellAddr, cellAddr, newID)
				return
			}
		}
	}
	if fallbackID, e := f.NewStyle(&excelize.Style{NumFmt: 4}); e == nil {
		_ = f.SetCellStyle(sheet, cellAddr, cellAddr, fallbackID)
	}
}
