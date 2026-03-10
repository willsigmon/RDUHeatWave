// Google Apps Script — paste this into script.google.com
// Connects the RDU Heatwave registration form to your Google Sheet
//
// Sheet ID: 1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA
// Preferred tab: Guest Check In (falls back to the first existing sheet)
//
// Deploy as: Web App → Execute as: Me → Access: Anyone

var SHEET_ID = '1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA';
var SHEET_NAME = 'Guest Check In';
var DEFAULT_HEADERS = ['Timestamp', 'Meeting Date', 'First name', 'Last name', 'Profession', 'Company Name', 'Email', 'Phone', 'Guest of', 'First Visit?', 'Interested in Learning More?', 'Best Contact Method', 'Ideal Referral'];

function doPost(e) {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.getSheets()[0] || spreadsheet.insertSheet(SHEET_NAME);
  var now = new Date();
  var params = (e && e.parameter) || {};
  var timezone = spreadsheet.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'America/New_York';

  // Add header row if sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(DEFAULT_HEADERS);
  }

  var headerColumnCount = Math.max(sheet.getLastColumn(), 1);
  var headerRow = sheet.getRange(1, 1, 1, headerColumnCount).getValues()[0];
  var hasHeaders = headerRow.some(function(headerCell) {
    return String(headerCell || '').trim() !== '';
  });

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, DEFAULT_HEADERS.length).setValues([DEFAULT_HEADERS]);
    headerRow = DEFAULT_HEADERS.slice();
  } else {
    headerRow = ensureHeaders(sheet, headerRow);
  }

  var row = headerRow.map(function(headerCell) {
    switch (normalizeHeader(headerCell)) {
      case 'timestamp':
        return now;
      case 'meetingdate':
        return Utilities.formatDate(now, timezone, 'M/d/yyyy');
      case 'firstname':
        return cleanValue(params.firstName);
      case 'lastname':
        return cleanValue(params.lastName);
      case 'profession':
        return cleanValue(params.profession);
      case 'companyname':
        return cleanValue(params.companyName);
      case 'email':
        return cleanValue(params.email);
      case 'phone':
        return cleanValue(params.phone);
      case 'guestof':
        return cleanValue(params.guestOf);
      case 'firstvisit':
        return cleanValue(params.firstVisit);
      case 'interestedinlearningmore':
        return cleanValue(params.interestedInLearningMore);
      case 'bestcontactmethod':
        return cleanValue(params.bestContactMethod);
      case 'idealreferral':
        return cleanValue(params.idealReferral);
      default:
        return '';
    }
  });

  sheet.appendRow(row);

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

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function cleanValue(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureHeaders(sheet, headerRow) {
  var existingHeaderMap = {};

  headerRow.forEach(function(headerCell) {
    var key = normalizeHeader(headerCell);
    if (key) {
      existingHeaderMap[key] = true;
    }
  });

  var missingHeaders = DEFAULT_HEADERS.filter(function(header) {
    return !existingHeaderMap[normalizeHeader(header)];
  });

  if (!missingHeaders.length) {
    return headerRow;
  }

  sheet.getRange(1, headerRow.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
  return headerRow.concat(missingHeaders);
}
