'use strict';

var shared = require('./_lib/shared');

var APPS_SCRIPT_URL = shared.getAppsScriptUrl();
var REQUIRED_FIELDS = ['firstName', 'lastName', 'profession', 'phone', 'email', 'guestOf'];
var OPTIONAL_FIELDS = ['companyName', 'idealReferral'];
var HONEYPOT_FIELD = 'companyWebsite';
var FIELD_LENGTH_LIMITS = {
  firstName: 80,
  lastName: 80,
  profession: 120,
  companyName: 120,
  phone: 40,
  email: 254,
  guestOf: 120,
  idealReferral: 180
};
var RATE_LIMITS = { burst: 12, burstWindowMs: 60 * 1000, hourly: 60 };

function normalizeEntry(body) {
  return REQUIRED_FIELDS.concat(OPTIONAL_FIELDS).reduce(function (entry, field) {
    entry[field] = shared.sanitizeForSheet(shared.normalizeText(body[field]));
    return entry;
  }, {});
}

function validateEntry(entry) {
  var missingFields = REQUIRED_FIELDS.filter(function (field) {
    return !entry[field];
  });
  if (missingFields.length) {
    return 'Missing required field' + (missingFields.length > 1 ? 's' : '');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email)) {
    return 'Invalid email address';
  }

  var overLimitField = REQUIRED_FIELDS.concat(OPTIONAL_FIELDS).find(function (field) {
    return entry[field].length > FIELD_LENGTH_LIMITS[field];
  });
  if (overLimitField) {
    return 'One or more fields are too long';
  }

  return null;
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (req.method === 'HEAD') return shared.handleHead(res);
    return shared.sendJson(res, 200, { status: 'ok', target: 'apps-script' });
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
    if (shared.normalizeText(body[HONEYPOT_FIELD])) {
      return shared.sendJson(res, 200, { status: 'ok' });
    }

    var entry = normalizeEntry(body);
    var validationError = validateEntry(entry);
    if (validationError) {
      return shared.sendJson(res, 400, { status: 'error', message: validationError });
    }

    var result = await shared.forwardToAppsScript(APPS_SCRIPT_URL, entry);
    if (!result.ok) {
      console.error('[api/checkin] Apps Script sync failed:', result.statusCode);
      return shared.sendJson(res, 502, { status: 'error', message: 'Google Sheets sync failed' });
    }

    return shared.sendJson(res, 200, { status: 'ok' });
  } catch (error) {
    console.error('[api/checkin]', error);
    var mapped = shared.mapErrorToResponse(error, 'Unable to process check-in');
    return shared.sendJson(res, mapped.status, { status: 'error', message: mapped.message });
  }
};
