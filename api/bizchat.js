'use strict';

var shared = require('./_lib/shared');

var APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxkchMEuPQlPe91xWx3QGeSD_yk0q4g-1iBZ0gumknVqBu1s57_A0Dg2pbd64huh21D/exec';
var RATE_LIMITS = { burst: 10, burstWindowMs: 60 * 1000, hourly: 40 };

function validateBody(body) {
  var member = shared.normalizeText(body.member);
  var metWith = shared.normalizeText(body.metWith);
  var date = shared.normalizeText(body.date);

  if (!member) return 'Your name is required';
  if (!metWith) return 'Met With is required';
  if (!date) return 'Date is required';
  if (member.length > 80 || metWith.length > 80) return 'Name is too long';
  if (member === metWith) return 'You can\'t BizChat with yourself';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Invalid date format';

  var parsed = new Date(date + 'T12:00:00Z');
  if (Number.isNaN(parsed.getTime())) return 'Invalid date';
  if (parsed.getTime() > Date.now() + 86400000) return 'Date cannot be in the future';

  return null;
}

function formatDate(isoDate) {
  var parts = isoDate.split('-');
  return parseInt(parts[1], 10) + '/' + parseInt(parts[2], 10) + '/' + parts[0];
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (req.method === 'HEAD') return shared.handleHead(res);
    return shared.sendJson(res, 200, { status: 'ok', target: 'bizchat' });
  }
  if (req.method === 'OPTIONS') return shared.handleOptions(res, ['GET', 'HEAD', 'POST', 'OPTIONS']);
  if (req.method !== 'POST') return shared.handleMethodNotAllowed(req, res, ['GET', 'HEAD', 'POST', 'OPTIONS']);

  try {
    if (!shared.hasAllowedOrigin(req)) {
      return shared.sendJson(res, 403, { status: 'error', message: 'Origin not allowed' });
    }

    if (await shared.isRateLimited(shared.getClientIp(req), RATE_LIMITS)) {
      return shared.sendJson(res, 429, { status: 'error', message: 'Too many submissions. Please try again shortly.' });
    }

    var body = await shared.readRequestBody(req);
    var validationError = validateBody(body);
    if (validationError) {
      return shared.sendJson(res, 400, { status: 'error', message: validationError });
    }

    var entry = {
      source: 'bizchat',
      member: shared.sanitizeForSheet(shared.normalizeText(body.member)),
      metWith: shared.sanitizeForSheet(shared.normalizeText(body.metWith)),
      date: formatDate(shared.normalizeText(body.date))
    };

    var result = await shared.forwardToAppsScript(APPS_SCRIPT_URL, entry);
    if (!result.ok) {
      console.error('[api/bizchat] Apps Script sync failed:', result.statusCode);
      return shared.sendJson(res, 502, { status: 'error', message: 'Google Sheets sync failed' });
    }

    return shared.sendJson(res, 200, { status: 'ok' });
  } catch (error) {
    console.error('[api/bizchat]', error);
    var mapped = shared.mapErrorToResponse(error, 'Unable to log BizChat');
    return shared.sendJson(res, mapped.status, { status: 'error', message: mapped.message });
  }
};
