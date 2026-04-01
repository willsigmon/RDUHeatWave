'use strict';

// ── Google Sheets API v4 client ─────────────────────────────────────
// Zero-dependency client using Node built-in crypto for JWT signing.
// Authenticates via service account credentials stored in env vars:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL — service account email
//   GOOGLE_PRIVATE_KEY           — PEM private key (newlines as \n)
//
// The target spreadsheet must be shared with the service account email
// (Editor access for writes, Viewer for reads).

var crypto = require('crypto');

var SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
var TOKEN_URL = 'https://oauth2.googleapis.com/token';
var SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
var TOKEN_LIFETIME_SECS = 3600;

// ── Cached token ────────────────────────────────────────────────────
var cachedToken = null;
var cachedTokenExpiry = 0;

// ── Base64url encoding ──────────────────────────────────────────────

function base64url(input) {
  var str = typeof input === 'string' ? input : input.toString('base64');
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── JWT creation & signing ──────────────────────────────────────────

function createSignedJwt(email, privateKey) {
  var now = Math.floor(Date.now() / 1000);

  var header = base64url(Buffer.from(JSON.stringify({
    alg: 'RS256',
    typ: 'JWT'
  })));

  var payload = base64url(Buffer.from(JSON.stringify({
    iss: email,
    scope: SCOPES,
    aud: TOKEN_URL,
    iat: now,
    exp: now + TOKEN_LIFETIME_SECS
  })));

  var signingInput = header + '.' + payload;
  var signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  var signature = base64url(signer.sign(privateKey, 'base64'));

  return signingInput + '.' + signature;
}

// ── Token exchange ──────────────────────────────────────────────────

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry) {
    return cachedToken;
  }

  var email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  var privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!email || !privateKey) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY env vars');
  }

  var jwt = createSignedJwt(email, privateKey);

  var response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt
  });

  if (!response.ok) {
    var errorText = await response.text();
    throw new Error('Google token exchange failed: ' + response.status + ' ' + errorText);
  }

  var data = await response.json();
  cachedToken = data.access_token;
  cachedTokenExpiry = Date.now() + ((data.expires_in - 60) * 1000);
  return cachedToken;
}

// ── Sheets API helpers ──────────────────────────────────────────────

async function sheetsRequest(method, path, body) {
  var token = await getAccessToken();
  var options = {
    method: method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);

  var response = await fetch(SHEETS_BASE + path, options);
  if (!response.ok) {
    var errorText = await response.text();
    throw new Error('Sheets API error ' + response.status + ': ' + errorText);
  }
  return response.json();
}

async function getSpreadsheetMetadata(spreadsheetId) {
  return sheetsRequest(
    'GET',
    '/' + spreadsheetId + '?fields=' + encodeURIComponent('sheets.properties')
  );
}

async function getSheetMetadata(spreadsheetId, sheetName) {
  var data = await getSpreadsheetMetadata(spreadsheetId);
  var sheets = (data && data.sheets) || [];
  for (var i = 0; i < sheets.length; i++) {
    var props = sheets[i] && sheets[i].properties;
    if (props && props.title === sheetName) return props;
  }
  throw new Error('Sheet not found: ' + sheetName);
}

/**
 * Read a range from a spreadsheet.
 * @param {string} spreadsheetId
 * @param {string} range - e.g. "Membership Directory!A:D"
 * @returns {Promise<string[][]>} rows of cell values
 */
async function readRange(spreadsheetId, range) {
  var encoded = encodeURIComponent(range);
  var data = await sheetsRequest(
    'GET',
    '/' + spreadsheetId + '/values/' + encoded + '?valueRenderOption=FORMATTED_VALUE'
  );
  return data.values || [];
}

/**
 * Write (overwrite) a range in a spreadsheet.
 * @param {string} spreadsheetId
 * @param {string} range - e.g. "Membership Directory!A1:D12"
 * @param {string[][]} values - 2D array of cell values
 */
async function writeRange(spreadsheetId, range, values) {
  var encoded = encodeURIComponent(range);
  return sheetsRequest(
    'PUT',
    '/' + spreadsheetId + '/values/' + encoded + '?valueInputOption=USER_ENTERED',
    { range: range, majorDimension: 'ROWS', values: values }
  );
}

/**
 * Append rows to the end of a sheet.
 * @param {string} spreadsheetId
 * @param {string} range - e.g. "Membership Directory!A:D"
 * @param {string[][]} values - rows to append
 */
async function appendRows(spreadsheetId, range, values) {
  var encoded = encodeURIComponent(range);
  return sheetsRequest(
    'POST',
    '/' + spreadsheetId + '/values/' + encoded + ':append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS',
    { range: range, majorDimension: 'ROWS', values: values }
  );
}

/**
 * Clear a range in a spreadsheet.
 * @param {string} spreadsheetId
 * @param {string} range
 */
async function clearRange(spreadsheetId, range) {
  var encoded = encodeURIComponent(range);
  return sheetsRequest(
    'POST',
    '/' + spreadsheetId + '/values/' + encoded + ':clear',
    {}
  );
}

async function deleteSheetRow(spreadsheetId, sheetName, rowNumber) {
  if (!rowNumber || rowNumber < 1) {
    throw new Error('rowNumber must be >= 1');
  }

  var sheet = await getSheetMetadata(spreadsheetId, sheetName);
  return sheetsRequest(
    'POST',
    '/' + spreadsheetId + ':batchUpdate',
    {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.sheetId,
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber
            }
          }
        }
      ]
    }
  );
}

/**
 * Check if the service account credentials are configured.
 */
function isConfigured() {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

module.exports = {
  getAccessToken: getAccessToken,
  readRange: readRange,
  writeRange: writeRange,
  appendRows: appendRows,
  clearRange: clearRange,
  getSpreadsheetMetadata: getSpreadsheetMetadata,
  getSheetMetadata: getSheetMetadata,
  deleteSheetRow: deleteSheetRow,
  isConfigured: isConfigured
};
