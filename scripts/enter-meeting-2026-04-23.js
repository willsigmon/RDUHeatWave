'use strict';

// One-time script to enter April 23, 2026 meeting data into Google Sheets.
// Run with service account env vars set:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL=... GOOGLE_PRIVATE_KEY=... node scripts/enter-meeting-2026-04-23.js
//
// The script is intentionally idempotent for Referral Pipeline rows: exact
// existing rows are not appended twice. Report cells are overwritten with the
// same confirmed values.

var googleSheets = require('../api/_lib/google-sheets');

var SHEET_ID = '1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA';
var MEETING_DATE = '4/23/2026';

var REFERRALS = [
  ['Carter Helms', 'Nathan Senn', MEETING_DATE, 'Nathan Senn', 'Closed Business', '$22,000'],
  ['Dana Walsh', 'Rusty Sutton ', MEETING_DATE, '', 'Closed Business', '$8,376'],
  ['Dana Walsh', 'Rusty Sutton ', MEETING_DATE, 'Jennifer — The Piano School', 'In-Progress', ''],
  ['Rusty Sutton', 'Miki Wright Hagans', MEETING_DATE, 'Rusty Sutton', 'In-Progress', ''],
];

var BIZCHATS = {
  Dana: 7,
  David: 3,
  Nathan: 2,
  Robert: 4,
  Rusty: 1,
};

var GI_UPDATES = {
  Carter: { given: 0, received: 1 },
  Dana: { given: 0, received: 1 },
  Nate: { given: 1, received: 0 },
  Rusty: { given: 1, received: 0 },
};

var REVENUE_UPDATES = {
  Carter: { given: 22000, received: 0 },
  Dana: { given: 8376, received: 0 },
  Nate: { given: 0, received: 22000 },
  Rusty: { given: 0, received: 8376 },
};

function normalize(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function normalizeMoney(value) {
  return normalize(value).replace(/[$,]/g, '');
}

function sameReferralRow(a, b) {
  for (var i = 0; i < 5; i++) {
    if (normalize(a[i]) !== normalize(b[i])) return false;
  }
  return normalizeMoney(a[5]) === normalizeMoney(b[5]);
}

function colToLetter(index) {
  var n = index + 1;
  var out = '';
  while (n > 0) {
    var rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function findDateRowNumber(rows, date) {
  for (var i = 0; i < rows.length; i++) {
    if (normalize(rows[i] && rows[i][0]) === date) return i + 1;
  }
  throw new Error('Could not find row for ' + date);
}

function findHeaderRow(rows, firstCellPattern) {
  for (var i = 0; i < rows.length; i++) {
    var first = normalize(rows[i] && rows[i][0]);
    if (firstCellPattern.test(first)) return { row: rows[i], rowNumber: i + 1 };
  }
  throw new Error('Could not find header row matching ' + firstCellPattern);
}

function mapSimpleMemberColumns(headerRow) {
  var cols = {};
  for (var i = 1; i < headerRow.length; i++) {
    var name = normalize(headerRow[i]);
    if (name && name.toLowerCase() !== 'weekly total') cols[name] = i;
  }
  return cols;
}

function mapGivenReceivedColumns(headerRow) {
  var cols = {};
  for (var i = 1; i < headerRow.length; i++) {
    var name = normalize(headerRow[i]);
    if (!name || name === 'Weekly Total') continue;
    cols[name] = { given: i, received: i + 1 };
    i += 1;
  }
  return cols;
}

async function enterReferrals() {
  var rows = await googleSheets.readRange(SHEET_ID, 'Referral Pipeline!A:F');
  var missing = REFERRALS.filter(function (referral) {
    return !rows.some(function (row) { return sameReferralRow(row, referral); });
  });

  if (missing.length === 0) {
    console.log('Referral Pipeline: all %d rows already present', REFERRALS.length);
    return;
  }

  await googleSheets.appendRows(SHEET_ID, 'Referral Pipeline!A:F', missing);
  console.log('Referral Pipeline: appended %d row(s)', missing.length);
}

async function enterBizChats() {
  var rows = await googleSheets.readRange(SHEET_ID, 'BizChats Report!A1:Z100');
  var targetRow = findDateRowNumber(rows, MEETING_DATE);
  var header = findHeaderRow(rows, /^rolling 12 mo$/i).row;
  var memberCols = mapSimpleMemberColumns(header);

  var members = Object.keys(BIZCHATS);
  for (var i = 0; i < members.length; i++) {
    var member = members[i];
    var col = memberCols[member];
    if (col == null) throw new Error('BizChats column not found: ' + member);
    var cell = 'BizChats Report!' + colToLetter(col) + targetRow;
    await googleSheets.writeRange(SHEET_ID, cell, [[BIZCHATS[member]]]);
    console.log('BizChats: wrote %s = %d', cell, BIZCHATS[member]);
  }
}

async function enterGis() {
  var rows = await googleSheets.readRange(SHEET_ID, 'GIs Report!A1:AA100');
  var targetRow = findDateRowNumber(rows, MEETING_DATE);
  var header = findHeaderRow(rows, /^rolling 12 mo$/i).row;
  var memberCols = mapGivenReceivedColumns(header);

  var members = Object.keys(GI_UPDATES);
  for (var i = 0; i < members.length; i++) {
    var member = members[i];
    var cols = memberCols[member];
    if (!cols) throw new Error('GIs columns not found: ' + member);
    var update = GI_UPDATES[member];
    if (update.given) {
      var givenCell = 'GIs Report!' + colToLetter(cols.given) + targetRow;
      await googleSheets.writeRange(SHEET_ID, givenCell, [[update.given]]);
      console.log('GIs: wrote %s = %d', givenCell, update.given);
    }
    if (update.received) {
      var receivedCell = 'GIs Report!' + colToLetter(cols.received) + targetRow;
      await googleSheets.writeRange(SHEET_ID, receivedCell, [[update.received]]);
      console.log('GIs: wrote %s = %d', receivedCell, update.received);
    }
  }
}

async function enterRevenue() {
  var rows = await googleSheets.readRange(SHEET_ID, 'Revenue Report!A1:U100');
  var targetRow = findDateRowNumber(rows, MEETING_DATE);
  var header = findHeaderRow(rows, /^rolling 12 mo$/i).row;
  var memberCols = mapGivenReceivedColumns(header);

  var members = Object.keys(REVENUE_UPDATES);
  for (var i = 0; i < members.length; i++) {
    var member = members[i];
    var cols = memberCols[member];
    if (!cols) throw new Error('Revenue columns not found: ' + member);
    var update = REVENUE_UPDATES[member];
    if (update.given) {
      var givenCell = 'Revenue Report!' + colToLetter(cols.given) + targetRow;
      await googleSheets.writeRange(SHEET_ID, givenCell, [[update.given]]);
      console.log('Revenue: wrote %s = %d', givenCell, update.given);
    }
    if (update.received) {
      var receivedCell = 'Revenue Report!' + colToLetter(cols.received) + targetRow;
      await googleSheets.writeRange(SHEET_ID, receivedCell, [[update.received]]);
      console.log('Revenue: wrote %s = %d', receivedCell, update.received);
    }
  }
}

async function main() {
  if (!googleSheets.isConfigured()) {
    console.error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY.');
    process.exit(1);
  }

  await enterReferrals();
  await enterBizChats();
  await enterGis();
  await enterRevenue();
  console.log('\nDone. Meeting data for %s has been entered.', MEETING_DATE);
}

main().catch(function (error) {
  console.error('Error:', error.message || error);
  process.exit(1);
});
