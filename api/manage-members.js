'use strict';

var shared = require('./_lib/shared');
var sheets = require('./_lib/google-sheets');

var RATE_LIMITS = { burst: 10, burstWindowMs: 60 * 1000, hourly: 120 };
var ADMIN_PASSCODE = process.env.ADMIN_PASSCODE;
var SHEET_ID = '1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA';
var SHEET_NAME = 'Membership Directory';
var RANGE = SHEET_NAME + '!A:D';
var HEADERS = ['Name', 'Profession', 'Company', 'Website'];

// ── Auth ────────────────────────────────────────────────────────────

function getPasscode(req, body) {
  return shared.normalizeText(
    (req.headers && (req.headers['x-admin-passcode'] || req.headers['X-Admin-Passcode'])) ||
    (body && body.passcode) ||
    ''
  );
}

function isAuthorized(req, body) {
  var passcode = getPasscode(req, body);
  return ADMIN_PASSCODE && passcode && passcode === ADMIN_PASSCODE;
}

// ── Read current roster ─────────────────────────────────────────────

async function readCurrentMembers() {
  var rows = await sheets.readRange(SHEET_ID, RANGE);
  if (!rows.length) return [];

  // First row may be headers — detect and skip
  var startIndex = 0;
  var firstRow = (rows[0] || []).map(function (cell) {
    return shared.normalizeText(cell).toLowerCase();
  });
  if (firstRow.indexOf('name') !== -1 || firstRow.indexOf('profession') !== -1) {
    startIndex = 1;
  }

  return rows.slice(startIndex).filter(function (row) {
    return shared.normalizeText(row[0]);
  }).map(function (row) {
    return {
      name: shared.normalizeText(row[0]),
      title: shared.normalizeText(row[1]) || 'Member',
      company: shared.normalizeText(row[2]),
      website: shared.normalizeText(row[3])
    };
  });
}

async function readCurrentMembersWithRowNumbers() {
  var rows = await sheets.readRange(SHEET_ID, RANGE);
  if (!rows.length) return [];

  var startIndex = 0;
  var firstRow = (rows[0] || []).map(function (cell) {
    return shared.normalizeText(cell).toLowerCase();
  });
  if (firstRow.indexOf('name') !== -1 || firstRow.indexOf('profession') !== -1) {
    startIndex = 1;
  }

  var members = [];
  for (var i = startIndex; i < rows.length; i++) {
    var row = rows[i] || [];
    if (!shared.normalizeText(row[0])) continue;
    members.push({
      rowNumber: i + 1,
      name: shared.normalizeText(row[0]),
      title: shared.normalizeText(row[1]) || 'Member',
      company: shared.normalizeText(row[2]),
      website: shared.normalizeText(row[3])
    });
  }

  return members;
}

// ── Actions ─────────────────────────────────────────────────────────

async function listMembers() {
  var members = await readCurrentMembers();
  return { status: 'ok', count: members.length, members: members };
}

async function addMember(body) {
  var name = shared.normalizeText(body.name);
  if (!name) return { status: 'error', message: 'name is required' };

  var existing = await readCurrentMembers();
  var alreadyExists = existing.some(function (m) {
    return m.name.toLowerCase() === name.toLowerCase();
  });
  if (alreadyExists) {
    return { status: 'error', message: name + ' is already on the roster' };
  }

  var newRow = [
    shared.sanitizeForSheet(name),
    shared.sanitizeForSheet(shared.normalizeText(body.title || body.profession) || 'Member'),
    shared.sanitizeForSheet(shared.normalizeText(body.company)),
    shared.sanitizeForSheet(shared.normalizeText(body.website))
  ];

  await sheets.appendRows(SHEET_ID, RANGE, [newRow]);
  return { status: 'ok', message: name + ' added', member: { name: newRow[0], title: newRow[1], company: newRow[2], website: newRow[3] } };
}

async function removeMember(body) {
  var name = shared.normalizeText(body.name);
  if (!name) return { status: 'error', message: 'name is required' };

  var members = await readCurrentMembersWithRowNumbers();
  if (!members.length) return { status: 'error', message: 'Sheet is empty' };

  var target = members.find(function (member) {
    return member.name.toLowerCase() === name.toLowerCase();
  });
  if (!target) {
    return { status: 'error', message: name + ' not found on roster' };
  }

  await sheets.deleteSheetRow(SHEET_ID, SHEET_NAME, target.rowNumber);

  return { status: 'ok', message: name + ' removed' };
}

async function updateMember(body) {
  var name = shared.normalizeText(body.name);
  if (!name) return { status: 'error', message: 'name is required' };

  var members = await readCurrentMembersWithRowNumbers();
  if (!members.length) return { status: 'error', message: 'Sheet is empty' };

  var target = members.find(function (member) {
    return member.name.toLowerCase() === name.toLowerCase();
  });
  if (!target) return { status: 'error', message: name + ' not found on roster' };

  var nextRow = [
    shared.sanitizeForSheet(body.newName ? shared.normalizeText(body.newName) : target.name),
    shared.sanitizeForSheet(body.title || body.profession ? shared.normalizeText(body.title || body.profession) : target.title),
    shared.sanitizeForSheet(body.company != null ? shared.normalizeText(body.company) : target.company),
    shared.sanitizeForSheet(body.website != null ? shared.normalizeText(body.website) : target.website)
  ];

  await sheets.writeRange(SHEET_ID, SHEET_NAME + '!A' + target.rowNumber + ':D' + target.rowNumber, [nextRow]);
  return { status: 'ok', message: name + ' updated' };
}

async function syncFallback() {
  var members = await readCurrentMembers();
  return {
    status: 'ok',
    message: 'Current roster from sheet — update DEFAULT_MEMBERS in api/members.js to match',
    count: members.length,
    members: members
  };
}

// ── Handler ─────────────────────────────────────────────────────────

var ACTIONS = {
  list: listMembers,
  add: addMember,
  remove: removeMember,
  update: updateMember,
  sync: syncFallback
};

module.exports = async function handler(req, res) {
  if (req.method === 'HEAD') return shared.handleHead(res);
  if (req.method === 'OPTIONS') return shared.handleOptions(res, ['POST', 'HEAD', 'OPTIONS']);
  if (req.method !== 'POST') return shared.handleMethodNotAllowed(req, res, ['POST', 'HEAD', 'OPTIONS']);

  try {
    if (await shared.isRateLimited(shared.getClientIp(req), RATE_LIMITS)) {
      return shared.sendJson(res, 429, { status: 'error', message: 'Too many requests. Please try again shortly.' });
    }

    if (!sheets.isConfigured()) {
      return shared.sendJson(res, 503, {
        status: 'error',
        message: 'Google Sheets API not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY env vars.'
      });
    }

    var body = await shared.readRequestBody(req, 8 * 1024);
    if (!isAuthorized(req, body)) {
      return shared.sendJson(res, 401, { status: 'error', message: 'Invalid passcode' });
    }

    var action = shared.normalizeText(body.action).toLowerCase();
    var actionFn = ACTIONS[action];
    if (!actionFn) {
      return shared.sendJson(res, 400, {
        status: 'error',
        message: 'Unknown action. Use: list, add, remove, update, sync'
      });
    }

    var result = await actionFn(body);
    var statusCode = result.status === 'ok' ? 200 : 400;
    return shared.sendJson(res, statusCode, result);
  } catch (error) {
    console.error('[api/manage-members]', error);
    return shared.sendJson(res, 500, { status: 'error', message: 'Member management failed' });
  }
};
