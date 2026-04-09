'use strict';

// One-time API endpoint to push meeting data into Google Sheets.
// Requires admin passcode. POST /api/enter-meeting-data { passcode, meeting }
// After use, remove this endpoint or restrict further.

var shared = require('./_lib/shared');
var sheets = require('./_lib/google-sheets');

var SHEET_ID = '1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA';

// Hardcoded meeting datasets keyed by date string
var MEETINGS = {
  '2026-04-02': {
    date: '4/2/2026',
    referrals: [
      ['Robert Courts', 'Sue Kerata', '4/2/2026', 'Kevin Miller', 'In-Progress', ''],
      ['Dana Walsh', 'Chandler', '4/2/2026', 'Capital City Grimes, Raleigh Rescue Mission, Meals on Wheels, Welfare', 'In-Progress', ''],
      ['Rusty Sutton', 'Roni Payne', '4/2/2026', 'Acctg Svc (W2s)', 'In-Progress', ''],
      ['Carter Helms', 'Craig Morrill', '4/2/2026', 'Anne Paredes — 850-955-0926 — Anna.Paredes@colevare.inc', 'In-Progress', ''],
      ['Erika Beckett', 'Dana Walsh', '4/2/2026', 'John Langley — J.Mak Hospitality — 919-384-5663', 'In-Progress', ''],
    ],
    bizchats: { Robert: 2, Dana: 4, Rusty: 1 },
  },
};

// Admin passcode — same check as admin-report
var ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || '';

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return shared.handleOptions(res, ['POST']);
  if (req.method !== 'POST') return shared.handleMethodNotAllowed(req, res, ['POST']);
  if (!shared.hasAllowedOrigin(req)) {
    return shared.sendJson(res, 403, { status: 'error', message: 'Forbidden' });
  }

  var body;
  try {
    body = await shared.readRequestBody(req);
  } catch (err) {
    var mapped = shared.mapErrorToResponse(err);
    return shared.sendJson(res, mapped.status, { status: 'error', message: mapped.message });
  }

  var passcode = shared.normalizeText(body.passcode);
  if (!ADMIN_PASSCODE || passcode !== ADMIN_PASSCODE) {
    return shared.sendJson(res, 401, { status: 'error', message: 'Invalid passcode' });
  }

  var meetingKey = shared.normalizeText(body.meeting);
  var meeting = MEETINGS[meetingKey];
  if (!meeting) {
    return shared.sendJson(res, 400, {
      status: 'error',
      message: 'Unknown meeting: ' + meetingKey,
      available: Object.keys(MEETINGS),
    });
  }

  if (!sheets.isConfigured()) {
    return shared.sendJson(res, 500, { status: 'error', message: 'Google Sheets not configured' });
  }

  var results = [];

  try {
    // 1. Append referrals
    var refResult = await sheets.appendRows(
      SHEET_ID,
      'Referral Pipeline!A:F',
      meeting.referrals
    );
    results.push('Referrals: ' + meeting.referrals.length + ' rows appended');

    // 2. Update BizChats
    var bizRows = await sheets.readRange(SHEET_ID, 'BizChats Report!A1:Z100');
    if (bizRows && bizRows.length >= 2) {
      var headerRow = bizRows[1] || bizRows[0];
      var memberCols = {};
      for (var col = 1; col < headerRow.length; col++) {
        var name = (headerRow[col] || '').trim();
        if (name && name.toLowerCase() !== 'weekly total') {
          memberCols[name] = col;
        }
      }

      var targetRowIndex = -1;
      for (var r = bizRows.length - 1; r >= 2; r--) {
        var cellDate = (bizRows[r][0] || '').trim();
        if (cellDate === meeting.date || cellDate === '4/2/26') {
          targetRowIndex = r;
          break;
        }
      }

      if (targetRowIndex >= 0) {
        var members = Object.keys(meeting.bizchats);
        for (var i = 0; i < members.length; i++) {
          var member = members[i];
          var colIdx = memberCols[member];
          if (colIdx === undefined) continue;
          var colLetter = String.fromCharCode(65 + colIdx);
          var cellRef = 'BizChats Report!' + colLetter + (targetRowIndex + 1);
          await sheets.writeRange(SHEET_ID, cellRef, [[meeting.bizchats[member]]]);
        }
        results.push('BizChats: updated ' + members.length + ' members');
      } else {
        results.push('BizChats: row for ' + meeting.date + ' not found');
      }
    }

    return shared.sendJson(res, 200, { status: 'ok', results: results });
  } catch (err) {
    return shared.sendJson(res, 500, { status: 'error', message: err.message || 'Unknown error' });
  }
};
