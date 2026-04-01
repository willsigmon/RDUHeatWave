'use strict';

var shared = require('./_lib/shared');

var APPS_SCRIPT_URL = shared.getAppsScriptUrl();
var RADIO_FIELDS = ['q1', 'q2', 'q3', 'q5', 'q6', 'q7', 'q8', 'q9'];
var CHECKBOX_FIELDS = ['q4'];
var TEXT_FIELDS = ['q10'];
var RATE_LIMITS = { burst: 6, burstWindowMs: 60 * 1000, hourly: 20 };

var ALLOWED_VALUES = {
  q1: ['1', '2', '3', '4', '5'],
  q2: ['1', '2', '3', '4'],
  q3: ['1', '2', '3', '4', '5'],
  q4: ['intros', 'gratitude', 'spotlight', 'mentor', 'bizchat', 'reports'],
  q5: ['1', '2', '3', '4', '5'],
  q6: ['0', '1-9', '10-19', '20-29', '30+'],
  q7: ['1', '2', '3', '4', '5', 'n/a'],
  q8: ['referrals', 'relationships', 'presence', 'guests', 'learning'],
  q9: ['1', '2', '3', '4', '5']
};

function validateSurvey(body) {
  for (var i = 0; i < RADIO_FIELDS.length; i++) {
    var field = RADIO_FIELDS[i];
    var value = shared.normalizeText(body[field]);
    if (!value) return 'Missing answer for ' + field;
    if (ALLOWED_VALUES[field] && ALLOWED_VALUES[field].indexOf(value) === -1) {
      return 'Invalid value for ' + field;
    }
  }

  for (var j = 0; j < CHECKBOX_FIELDS.length; j++) {
    var cbField = CHECKBOX_FIELDS[j];
    var cbValue = body[cbField];
    if (!cbValue || (Array.isArray(cbValue) && cbValue.length === 0)) {
      return 'Missing answer for ' + cbField;
    }
    var values = Array.isArray(cbValue) ? cbValue : [cbValue];
    if (values.length > 2) return 'Too many selections for ' + cbField;
    for (var k = 0; k < values.length; k++) {
      if (ALLOWED_VALUES[cbField].indexOf(shared.normalizeText(values[k])) === -1) {
        return 'Invalid value for ' + cbField;
      }
    }
  }

  return null;
}

function buildEntry(body) {
  var entry = { source: 'survey' };

  RADIO_FIELDS.forEach(function (field) {
    entry[field] = shared.normalizeText(body[field]);
  });

  CHECKBOX_FIELDS.forEach(function (field) {
    var value = body[field];
    var values = Array.isArray(value) ? value : [value];
    entry[field] = values.map(shared.normalizeText).join(', ');
  });

  TEXT_FIELDS.forEach(function (field) {
    entry[field] = shared.sanitizeForSheet(shared.normalizeText(body[field]).substring(0, 2000));
  });

  return entry;
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (req.method === 'HEAD') return shared.handleHead(res);
    return shared.sendJson(res, 200, { status: 'ok', target: 'survey' });
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
    var validationError = validateSurvey(body);
    if (validationError) {
      return shared.sendJson(res, 400, { status: 'error', message: validationError });
    }

    var entry = buildEntry(body);
    var result = await shared.forwardToAppsScript(APPS_SCRIPT_URL, entry);
    if (!result.ok) {
      console.error('[api/survey] Apps Script sync failed:', result.statusCode);
      return shared.sendJson(res, 502, { status: 'error', message: 'Google Sheets sync failed' });
    }

    return shared.sendJson(res, 200, { status: 'ok' });
  } catch (error) {
    console.error('[api/survey]', error);
    var mapped = shared.mapErrorToResponse(error, 'Unable to process survey');
    return shared.sendJson(res, mapped.status, { status: 'error', message: mapped.message });
  }
};
