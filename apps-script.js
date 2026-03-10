// Google Apps Script — paste this into script.google.com
// Connects the RDU Heatwave registration form to your Google Sheet
//
// Sheet ID: 1xX4PCqHVgdjxr2PzZxLFV73ewtpv6qVE5-AGvl5_l2M
// Preferred tab: Applications (falls back to the first existing sheet)
//
// Deploy as: Web App → Execute as: Me → Access: Anyone

var SHEET_ID = '1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA';
var SHEET_NAME = 'Guest Check In';

function doPost(e) {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.getSheets()[0] || spreadsheet.insertSheet(SHEET_NAME);

  // Add header row if sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'First Name', 'Last Name', 'Profession', 'Phone', 'Email', 'Guest Of']);
  }

  sheet.appendRow([
    new Date(),
    e.parameter.firstName,
    e.parameter.lastName,
    e.parameter.profession,
    e.parameter.phone,
    e.parameter.email,
    e.parameter.guestOf
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Optional: handle GET requests for testing
function doGet() {
  return ContentService
    .createTextOutput('RDU Heatwave form endpoint is live.')
    .setMimeType(ContentService.MimeType.TEXT);
}
