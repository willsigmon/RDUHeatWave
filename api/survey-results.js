'use strict';

var shared = require('./_lib/shared');

var ADMIN_PASSCODE = process.env.ADMIN_PASSCODE;
var SHEET_ID = '1xX4PCqHVgdjxr2PzZxLFV73ewtpv6qVE5-AGvl5_l2M';
var SURVEY_SHEET = 'Survey Responses';
var REQUEST_TIMEOUT_MS = 12 * 1000;

if (!ADMIN_PASSCODE) {
  console.warn('[api/survey-results] ADMIN_PASSCODE env var is not set — endpoint will reject all requests');
}

function getPasscode(req, body) {
  return shared.normalizeText(
    (req.headers && (req.headers['x-admin-passcode'] || req.headers['X-Admin-Passcode'])) ||
    (body && body.passcode) ||
    ''
  );
}

// Column indices for the Survey Responses sheet.
// Expected columns: Timestamp, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10
// q4 is multi-select (comma-separated values in one cell).
var Q_COLS = {
  q1:  1,
  q2:  2,
  q3:  3,
  q4:  4,
  q5:  5,
  q6:  6,
  q7:  7,
  q8:  8,
  q9:  9,
  q10: 10
};

var RADIO_QUESTIONS = ['q1', 'q2', 'q3', 'q5', 'q6', 'q7', 'q8', 'q9'];
var CHECKBOX_QUESTIONS = ['q4'];
var TEXT_QUESTIONS = ['q10'];

function aggregateSurveySheet(sheet) {
  var results = {};

  RADIO_QUESTIONS.forEach(function (key) { results[key] = {}; });
  CHECKBOX_QUESTIONS.forEach(function (key) { results[key] = {}; });
  TEXT_QUESTIONS.forEach(function (key) { results[key] = []; });

  var totalResponses = 0;

  sheet.rows.forEach(function (row) {
    // Skip header rows or empty rows (timestamp is col 0)
    var timestamp = shared.normalizeText(row[0]);
    if (!timestamp || /^timestamp$/i.test(timestamp)) return;

    totalResponses += 1;

    RADIO_QUESTIONS.forEach(function (key) {
      var colIndex = Q_COLS[key];
      var value = shared.normalizeText(row[colIndex]);
      if (!value) return;
      results[key][value] = (results[key][value] || 0) + 1;
    });

    // q4: checkbox — may contain comma-separated values
    var q4Val = shared.normalizeText(row[Q_COLS.q4]);
    if (q4Val) {
      q4Val.split(',').forEach(function (part) {
        var v = part.trim();
        if (!v) return;
        results.q4[v] = (results.q4[v] || 0) + 1;
      });
    }

    // q10: open text
    var q10Val = shared.normalizeText(row[Q_COLS.q10]);
    if (q10Val) {
      results.q10.push(q10Val);
    }
  });

  results.totalResponses = totalResponses;
  return results;
}

module.exports = async function handler(req, res) {
  if (req.method === 'HEAD') return shared.handleHead(res);
  if (req.method === 'OPTIONS') return shared.handleOptions(res, ['POST', 'HEAD', 'OPTIONS']);
  if (req.method !== 'POST') return shared.handleMethodNotAllowed(req, res, ['POST', 'HEAD', 'OPTIONS']);

  try {
    var body = await shared.readRequestBody(req, 4 * 1024);
    var passcode = getPasscode(req, body);

    if (!ADMIN_PASSCODE || !passcode || passcode !== ADMIN_PASSCODE) {
      return shared.sendJson(res, 401, { status: 'error', message: 'Invalid passcode' });
    }

    var sheet = await shared.fetchSheet(SHEET_ID, SURVEY_SHEET, REQUEST_TIMEOUT_MS);
    var results = aggregateSurveySheet(sheet);

    return shared.sendJson(res, 200, { status: 'ok', results: results });
  } catch (error) {
    console.error('[api/survey-results]', error);
    return shared.sendJson(res, 500, {
      status: 'error',
      message: 'Unable to load survey results right now'
    });
  }
};
