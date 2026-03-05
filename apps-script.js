// Google Apps Script — paste this into script.google.com
// Connects the RDU Heatwave registration form to your Google Sheet
//
// Sheet ID: 1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA
//
// Deploy as: Web App → Execute as: Me → Access: Anyone

function doPost(e) {
  var sheet = SpreadsheetApp.openById('1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA').getActiveSheet();

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
