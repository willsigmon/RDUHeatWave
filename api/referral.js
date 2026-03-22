'use strict';

var shared = require('./_lib/shared');

var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkchMEuPQlPe91xWx3QGeSD_yk0q4g-1iBZ0gumknVqBu1s57_A0Dg2pbd64huh21D/exec';
var RATE_LIMITS = { burst: 8, burstWindowMs: 60 * 1000, hourly: 30 };

function validateBody(body) {
  var givenFrom = shared.normalizeText(body.givenFrom);
  var givenTo = shared.normalizeText(body.givenTo);
  var prospect = shared.normalizeText(body.prospect);
  var date = shared.normalizeText(body.date);

  if (!givenFrom) return 'Given From is required';
  if (!givenTo) return 'Given To is required';
  if (!prospect) return 'Prospect\'s Name is required';
  if (!date) return 'Date is required';
  if (givenFrom.length > 80 || givenTo.length > 80) return 'Name is too long';
  if (prospect.length > 120) return 'Prospect name is too long';
  if (givenFrom === givenTo) return 'Giver and recipient must be different';
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
    return shared.sendJson(res, 200, { status: 'ok', target: 'referral' });
  }
  if (req.method === 'OPTIONS') return shared.handleOptions(res, ['GET', 'HEAD', 'POST', 'OPTIONS']);
  if (req.method !== 'POST') return shared.handleMethodNotAllowed(req, res, ['GET', 'HEAD', 'POST', 'OPTIONS']);

  try {
    if (!shared.hasAllowedOrigin(req)) {
      return shared.sendJson(res, 403, { status: 'error', message: 'Origin not allowed' });
    }

    if (shared.isRateLimited(shared.getClientIp(req), RATE_LIMITS)) {
      return shared.sendJson(res, 429, { status: 'error', message: 'Too many submissions. Please try again shortly.' });
    }

    var body = await shared.readRequestBody(req);
    var validationError = validateBody(body);
    if (validationError) {
      return shared.sendJson(res, 400, { status: 'error', message: validationError });
    }

    var entry = {
      source: 'referral',
      givenFrom: shared.normalizeText(body.givenFrom),
      givenTo: shared.normalizeText(body.givenTo),
      prospect: shared.normalizeText(body.prospect),
      date: formatDate(shared.normalizeText(body.date)),
      disposition: 'New',
      revenue: '0'
    };

    var result = await shared.forwardToAppsScript(APPS_SCRIPT_URL, entry);
    if (!result.ok) {
      console.error('[api/referral] Apps Script sync failed:', result.statusCode);
      return shared.sendJson(res, 502, { status: 'error', message: 'Google Sheets sync failed' });
    }

    return shared.sendJson(res, 200, { status: 'ok' });
  } catch (error) {
    console.error('[api/referral]', error);
    var mapped = shared.mapErrorToResponse(error, 'Unable to log referral');
    return shared.sendJson(res, mapped.status, { status: 'error', message: mapped.message });
  }
};
