'use strict';

var shared = require('./_lib/shared');

var APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxkchMEuPQlPe91xWx3QGeSD_yk0q4g-1iBZ0gumknVqBu1s57_A0Dg2pbd64huh21D/exec';
var RATE_LIMITS = { burst: 60, burstWindowMs: 60 * 1000, hourly: 600 };

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

    // Rate limiting relaxed for internal CRM — PIN auth is the access control
    // if (shared.isRateLimited(shared.getClientIp(req), RATE_LIMITS)) {
    //   return shared.sendJson(res, 429, { status: 'error', message: 'Too many requests. Please try again shortly.' });
    // }

    var body = await shared.readRequestBody(req);

    // Sanitize all string values to prevent Google Sheets formula injection
    var sanitizedBody = {};
    Object.keys(body).forEach(function (key) {
      sanitizedBody[key] = typeof body[key] === 'string'
        ? shared.sanitizeForSheet(body[key])
        : body[key];
    });

    // Forward the sanitized body as form-urlencoded to Apps Script
    var result = await shared.forwardToAppsScript(APPS_SCRIPT_URL, sanitizedBody, 15000);

    // Return the raw Apps Script response so the CRM client can parse it
    res.statusCode = result.ok ? 200 : 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(result.body);
  } catch (error) {
    console.error('[api/crm]', error);
    var mapped = shared.mapErrorToResponse(error, 'Unable to process CRM request');
    return shared.sendJson(res, mapped.status, { status: 'error', message: mapped.message });
  }
};
