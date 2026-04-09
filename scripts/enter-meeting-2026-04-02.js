'use strict';

// One-time script to enter April 2, 2026 meeting data into Google Sheets.
// Run with service account env vars set:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL=... GOOGLE_PRIVATE_KEY=... node scripts/enter-meeting-2026-04-02.js
//
// Or deploy to Vercel (which already has the env vars) and hit:
//   curl -X POST https://rduheatwave.team/api/enter-meeting-2026-04-02

var googleSheets = require('../api/_lib/google-sheets');

var SHEET_ID = '1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA';
var MEETING_DATE = '4/2/2026';

// ── Referral Pipeline rows ─────────────────────────────────────────
// Columns: Given From | Given To | Date | Prospect's Name | Disposition | Revenue

var REFERRALS = [
  ['Robert Courts', 'Sue Kerata', MEETING_DATE, 'Kevin Miller', 'In-Progress', ''],
  ['Dana Walsh', 'Chandler', MEETING_DATE, 'Capital City Grimes, Raleigh Rescue Mission, Meals on Wheels, Welfare', 'In-Progress', ''],
  ['Rusty Sutton', 'Roni Payne', MEETING_DATE, 'Acctg Svc (W2s)', 'In-Progress', ''],
  ['Carter Helms', 'Craig Morrill', MEETING_DATE, 'Anne Paredes — 850-955-0926 — Anna.Paredes@colevare.inc', 'In-Progress', ''],
  ['Erika Beckett', 'Dana Walsh', MEETING_DATE, 'John Langley — J.Mak Hospitality — 919-384-5663', 'In-Progress', ''],
];

// ── BizChat counts for the 4/2/2026 meeting week ──────────────────
// Member first name → BizChats reported on blue card

var BIZCHATS = {
  Robert: 2,
  Dana: 4,
  Rusty: 1,
};

// ── GI tracking from blue cards ────────────────────────────────────

var GI_DATA = {
  Rusty: { presentedToMembers: 0, receivedFromMembers: 1, receivedFromCorporate: 0 },
};

async function enterReferrals() {
  console.log('Appending %d referrals to Referral Pipeline...', REFERRALS.length);
  var result = await googleSheets.appendRows(
    SHEET_ID,
    'Referral Pipeline!A:F',
    REFERRALS
  );
  console.log('  Referrals appended:', result.updates ? result.updates.updatedRows + ' rows' : 'ok');
}

async function enterBizChats() {
  console.log('Reading BizChats Report to find columns and target row...');
  var rows = await googleSheets.readRange(SHEET_ID, 'BizChats Report!A1:Z100');
  if (!rows || rows.length < 2) {
    console.error('  BizChats Report appears empty or too small');
    return;
  }

  // Header row (row 2 in the sheet, index 1 in the array) has member names
  var headerRow = rows[1] || rows[0];
  var memberCols = {};
  for (var col = 1; col < headerRow.length; col++) {
    var name = (headerRow[col] || '').trim();
    if (name && name.toLowerCase() !== 'weekly total') {
      memberCols[name] = col;
    }
  }

  // Find the row for 4/2/2026
  var targetRowIndex = -1;
  for (var r = rows.length - 1; r >= 2; r--) {
    var cellDate = (rows[r][0] || '').trim();
    if (cellDate === MEETING_DATE || cellDate === '4/2/26') {
      targetRowIndex = r;
      break;
    }
  }

  if (targetRowIndex === -1) {
    console.error('  Could not find row for %s in BizChats Report', MEETING_DATE);
    return;
  }

  // Build updates
  var sheetRow = targetRowIndex + 1; // 1-indexed for Sheets API
  var updates = [];
  var memberNames = Object.keys(BIZCHATS);
  for (var i = 0; i < memberNames.length; i++) {
    var member = memberNames[i];
    var colIndex = memberCols[member];
    if (colIndex === undefined) {
      console.error('  Member column not found: %s', member);
      continue;
    }
    var colLetter = String.fromCharCode(65 + colIndex);
    var cellRef = 'BizChats Report!' + colLetter + sheetRow;
    updates.push({ range: cellRef, value: BIZCHATS[member] });
  }

  for (var j = 0; j < updates.length; j++) {
    console.log('  Writing %s = %d', updates[j].range, updates[j].value);
    await googleSheets.writeRange(SHEET_ID, updates[j].range, [[updates[j].value]]);
  }

  console.log('  BizChats updated for %d members', updates.length);
}

async function main() {
  if (!googleSheets.isConfigured()) {
    console.error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY.');
    console.error('Set these env vars and re-run, or deploy to Vercel where they are configured.');
    process.exit(1);
  }

  try {
    await enterReferrals();
    await enterBizChats();
    console.log('\nDone. Meeting data for %s has been entered.', MEETING_DATE);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

main();
