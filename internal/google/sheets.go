package google

import (
	"context"
	"fmt"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

type SheetsClient struct {
	svc *sheets.Service
}

func NewSheetsClient(serviceAccountJSON string) (*SheetsClient, error) {
	ctx := context.Background()
	conf, err := google.JWTConfigFromJSON([]byte(serviceAccountJSON), sheets.SpreadsheetsScope)
	if err != nil {
		return nil, fmt.Errorf("invalid service account json: %w", err)
	}

	hc := conf.Client(ctx)
	svc, err := sheets.NewService(ctx, option.WithHTTPClient(hc))
	if err != nil {
		return nil, fmt.Errorf("create sheets service: %w", err)
	}

	return &SheetsClient{svc: svc}, nil
}

func (c *SheetsClient) ReadRange(spreadsheetID, readRange string) ([][]interface{}, error) {
	resp, err := c.svc.Spreadsheets.Values.Get(spreadsheetID, readRange).Do()
	if err != nil {
		return nil, err
	}
	return resp.Values, nil
}

func (c *SheetsClient) UpdateRange(spreadsheetID, writeRange string, values [][]interface{}) error {
	vr := &sheets.ValueRange{Values: values}
	_, err := c.svc.Spreadsheets.Values.Update(spreadsheetID, writeRange, vr).
		ValueInputOption("RAW").
		Do()
	return err
}

func (c *SheetsClient) AppendRow(spreadsheetID, sheetName string, row []interface{}) error {
	vr := &sheets.ValueRange{Values: [][]interface{}{row}}
	_, err := c.svc.Spreadsheets.Values.Append(spreadsheetID, sheetName, vr).
		ValueInputOption("RAW").
		InsertDataOption("INSERT_ROWS").
		Do()
	return err
}

func (c *SheetsClient) ClearRange(spreadsheetID, clearRange string) error {
	_, err := c.svc.Spreadsheets.Values.Clear(spreadsheetID, clearRange, &sheets.ClearValuesRequest{}).Do()
	return err
}
