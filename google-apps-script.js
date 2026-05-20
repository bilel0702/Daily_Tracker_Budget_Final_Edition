// ============================================================
//  Expenses Tracker — Google Apps Script Backend
//  Paste this entire file into Google Apps Script
//  https://script.google.com
// ============================================================

const SHEET_NAME = "Expenses";
const HEADERS    = ["ID","Date","Day","Month","Year","Category","Name","Amount","Notes","Timestamp"];

// ── Helpers ──────────────────────────────────────────────────
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    // Style the header row
    const header = sheet.getRange(1, 1, 1, HEADERS.length);
    header.setBackground("#6366f1");
    header.setFontColor("#ffffff");
    header.setFontWeight("bold");
    sheet.setFrozenRows(1);
    // Set column widths
    sheet.setColumnWidth(1, 160);  // ID
    sheet.setColumnWidth(2, 100);  // Date
    sheet.setColumnWidth(7, 200);  // Name
    sheet.setColumnWidth(9, 220);  // Notes
    sheet.setColumnWidth(10, 180); // Timestamp
  }
  return sheet;
}

function expenseToRow(e) {
  const d = new Date(e.date + "T12:00:00");
  return [
    e.id,
    e.date,
    d.getDate(),
    d.getMonth() + 1,
    d.getFullYear(),
    e.category,
    e.name,
    parseFloat(e.amount),
    e.notes || "",
    e.ts || new Date().toISOString(),
  ];
}

function rowToExpense(row) {
  return {
    id:       String(row[0]),
    date:     String(row[1]),
    day:      Number(row[2]),
    month:    Number(row[3]),
    year:     Number(row[4]),
    category: String(row[5]),
    name:     String(row[6]),
    amount:   parseFloat(row[7]),
    notes:    String(row[8] || ""),
    ts:       String(row[9] || ""),
  };
}

// ── Main entry point ─────────────────────────────────────────
function doPost(e) {
  const cors = ContentService.createTextOutput();
  cors.setMimeType(ContentService.MimeType.JSON);

  try {
    const raw    = e.postData ? e.postData.contents : "{}";
    const body   = JSON.parse(raw);
    const action = body.action;
    const sheet  = getSheet();
    let result   = { success: true };

    if (action === "add") {
      sheet.appendRow(expenseToRow(body.expense));
      result.message = "Added";

    } else if (action === "update") {
      const id   = body.expense.id;
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === id) {
          sheet.getRange(i + 1, 1, 1, HEADERS.length).setValues([expenseToRow(body.expense)]);
          result.message = "Updated";
          break;
        }
      }

    } else if (action === "delete") {
      const id   = body.id;
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === id) {
          sheet.deleteRow(i + 1);
          result.message = "Deleted";
          break;
        }
      }

    } else {
      result = { success: false, message: "Unknown action: " + action };
    }

    cors.setContent(JSON.stringify(result));
  } catch (err) {
    cors.setContent(JSON.stringify({ success: false, error: err.toString() }));
  }

  return cors;
}

// ── GET — fetch all expenses (for Restore) ────────────────────
function doGet(e) {
  const params = e.parameter;
  const sheet  = getSheet();
  const data   = sheet.getDataRange().getValues();

  // Skip header row, map to objects
  const expenses = data.slice(1)
    .filter(row => row[0]) // skip empty rows
    .map(rowToExpense);

  const output = ContentService.createTextOutput(JSON.stringify({ expenses }));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
