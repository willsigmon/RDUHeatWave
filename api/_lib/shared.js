'use strict';

// ── Shared API utilities ────────────────────────────────────────────
// Common helpers used across multiple Vercel serverless functions.
// Vercel ignores _-prefixed directories, so this file is never
// deployed as its own endpoint.

// ── Text helpers ────────────────────────────────────────────────────

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseNumber(value) {
  var normalized = normalizeText(value).replace(/\$/g, '').replace(/,/g, '');
  if (!normalized || normalized === '-') return 0;
  var number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function parseDate(value) {
  var normalized = normalizeText(value);
  if (!normalized) return null;
  var match = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return null;
  var year = Number(match[3]);
  if (year < 100) year += 2000;
  var date = new Date(Date.UTC(year, Number(match[1]) - 1, Number(match[2])));
  return Number.isNaN(date.getTime()) ? null : date;
}

// ── HTTP helpers ────────────────────────────────────────────────────

function sendJson(res, statusCode, payload, options) {
  var opts = options || {};
  res.statusCode = statusCode;
  res.setHeader(
    'Cache-Control',
    opts.cache || 'no-store, max-age=0'
  );
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

function sendCachedJson(res, statusCode, payload) {
  return sendJson(res, statusCode, payload, {
    cache: 'public, max-age=0, s-maxage=300, stale-while-revalidate=600'
  });
}

function handleMethodNotAllowed(req, res, allowedMethods) {
  res.setHeader('Allow', allowedMethods.join(', '));
  return sendJson(res, 405, { status: 'error', message: 'Method not allowed' });
}

function handleHead(res, cache) {
  res.statusCode = 200;
  res.setHeader('Cache-Control', cache || 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.end();
}

function handleOptions(res, allowedMethods, cache) {
  res.statusCode = 204;
  res.setHeader('Allow', allowedMethods.join(', '));
  res.setHeader('Cache-Control', cache || 'no-store, max-age=0');
  return res.end();
}

// ── Origin / IP helpers ─────────────────────────────────────────────

function getClientIp(req) {
  var forwardedFor = normalizeText(req.headers['x-forwarded-for']);
  if (forwardedFor) {
    return normalizeText(forwardedFor.split(',')[0]);
  }
  return normalizeText(req.headers['x-real-ip']);
}

var ALLOWED_ORIGINS = [
  'https://rduheatwave.team',
  'https://www.rduheatwave.team'
];
var PREVIEW_ORIGIN_RE = /^https:\/\/rduheat-[a-z0-9-]+-wsmco\.vercel\.app$/i;
var DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwvYv_BYJznuumdC51jP-P6RuYRRgK5MEONjUywvl322MbR1W1_nA1hZHcsSj5oLfzvoQ/exec';

function isAllowedOriginValue(value) {
  if (!value) return true;
  try {
    var origin = new URL(value).origin;
    return ALLOWED_ORIGINS.indexOf(origin) !== -1 || PREVIEW_ORIGIN_RE.test(origin);
  } catch (_err) {
    return false;
  }
}

function hasAllowedOrigin(req) {
  var origin = req.headers.origin;
  var referer = req.headers.referer;
  if (req.method === 'POST' && !origin && !referer) return false;
  return isAllowedOriginValue(origin) && isAllowedOriginValue(referer);
}

// ── Rate limiting ───────────────────────────────────────────────────
// NOTE: Uses Vercel KV when available (persistent across cold starts).
// Falls back to an in-memory Map for local dev or when @vercel/kv is not
// installed — in that case limits reset on every cold start (best-effort).

var kv = null;
try { kv = require('@vercel/kv'); } catch (_e) { /* KV not available, use in-memory fallback */ }

var rateLimitStore = new Map();

async function isRateLimited(ipAddress, limits) {
  if (!ipAddress) return false;

  var burstLimit = (limits && limits.burst) || 12;
  var burstWindowMs = (limits && limits.burstWindowMs) || 60 * 1000;
  var hourlyLimit = (limits && limits.hourly) || 60;
  var hourlyWindowMs = 60 * 60 * 1000;

  if (kv && kv.kv) {
    try {
      var key = 'rl:' + ipAddress;
      var burstKey = key + ':burst';

      var results = await Promise.all([
        kv.kv.incr(burstKey),
        kv.kv.incr(key)
      ]);
      var burstCount = results[0];
      var hourlyCount = results[1];

      // Set TTL only on the first increment so the window is anchored correctly
      if (burstCount === 1) await kv.kv.expire(burstKey, Math.ceil(burstWindowMs / 1000));
      if (hourlyCount === 1) await kv.kv.expire(key, Math.ceil(hourlyWindowMs / 1000));

      return burstCount > burstLimit || hourlyCount > hourlyLimit;
    } catch (_kvErr) {
      // KV failed — fall through to in-memory
    }
  }

  // ── In-memory fallback ───────────────────────────────────────────
  var now = Date.now();
  var recentRequests = (rateLimitStore.get(ipAddress) || []).filter(function (ts) {
    return (now - ts) < hourlyWindowMs;
  });
  var burstRequests = recentRequests.filter(function (ts) {
    return (now - ts) < burstWindowMs;
  });

  if (burstRequests.length >= burstLimit || recentRequests.length >= hourlyLimit) {
    rateLimitStore.set(ipAddress, recentRequests);
    return true;
  }

  recentRequests.push(now);
  rateLimitStore.set(ipAddress, recentRequests);
  return false;
}

// ── Request body parsing ────────────────────────────────────────────

var MAX_BODY_BYTES = 50 * 1024;

function parseRawBody(rawBody, contentType) {
  if (!rawBody) return {};
  if (contentType === 'application/json') {
    try {
      return JSON.parse(rawBody);
    } catch (_err) {
      throw new Error('Invalid JSON body');
    }
  }
  if (contentType === 'application/x-www-form-urlencoded') {
    return Object.fromEntries(new URLSearchParams(rawBody));
  }
  throw new Error('Unsupported content type');
}

async function readRequestBody(req, maxBytes) {
  var limit = maxBytes || MAX_BODY_BYTES;
  var contentType = String(req.headers['content-type'] || '')
    .split(';')[0].trim().toLowerCase();

  if (typeof req.body === 'string') return parseRawBody(req.body, contentType);
  if (Buffer.isBuffer(req.body)) return parseRawBody(req.body.toString('utf8'), contentType);
  if (req.body && typeof req.body === 'object') return req.body;

  var chunks = [];
  var totalBytes = 0;
  for await (var chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > limit) throw new Error('Request body too large');
    chunks.push(Buffer.from(chunk));
  }
  return parseRawBody(Buffer.concat(chunks).toString('utf8'), contentType);
}

// ── Google Sheets (gviz) helpers ────────────────────────────────────

function parseGvizResponse(text) {
  var matched = text.match(/setResponse\(([\s\S]+)\);?\s*$/);
  if (!matched) throw new Error('Invalid gviz response');
  var payload = JSON.parse(matched[1]);
  var cols = ((payload.table && payload.table.cols) || []).map(function (col) {
    return normalizeText(col && col.label);
  });
  var rows = ((payload.table && payload.table.rows) || []).map(function (row) {
    return ((row && row.c) || []).map(function (cell) {
      if (!cell) return null;
      return cell.f != null ? cell.f : cell.v;
    });
  });
  return { cols: cols, rows: rows };
}

async function fetchSheet(sheetId, sheetName, timeoutMs) {
  var url = 'https://docs.google.com/spreadsheets/d/' + sheetId +
    '/gviz/tq?tqx=out:json&sheet=' + encodeURIComponent(sheetName);
  var controller = new AbortController();
  var timeoutId = setTimeout(function () { controller.abort(); }, timeoutMs || 10000);
  try {
    var response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error('Sheet fetch failed: ' + sheetName);
    return parseGvizResponse(await response.text());
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Apps Script forwarding ──────────────────────────────────────────

async function forwardToAppsScript(appsScriptUrl, entry, timeoutMs) {
  var formData = new URLSearchParams();
  Object.keys(entry).forEach(function (field) {
    formData.append(field, entry[field]);
  });

  var controller = new AbortController();
  var timeoutId = setTimeout(function () { controller.abort(); }, timeoutMs || 10000);
  var response;

  try {
    response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: formData.toString(),
      redirect: 'follow',
      signal: controller.signal
    });
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error('Apps Script request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  var text = await response.text();
  var isSuccess = response.ok && (/"status"\s*:\s*"ok"/.test(text) || /"result"\s*:\s*"success"/.test(text));
  return { ok: isSuccess, statusCode: response.status, body: text };
}

// ── Error → HTTP mapping ────────────────────────────────────────────

var ERROR_MAP = [
  { match: 'Request body too large',      status: 413 },
  { match: 'Invalid JSON body',           status: 400 },
  { match: 'Apps Script request timed out', status: 504, message: 'Google Sheets sync timed out' },
  { match: 'Unsupported content type',    status: 415 }
];

function mapErrorToResponse(error, fallbackMessage) {
  var msg = (error && error.message) ? String(error.message) : '';
  var isBadJson = msg === 'Invalid JSON body' ||
    (error && error.name === 'SyntaxError') ||
    /unexpected token|unexpected end|json/i.test(msg);

  if (isBadJson) return { status: 400, message: 'Invalid JSON body' };

  for (var i = 0; i < ERROR_MAP.length; i++) {
    if (msg === ERROR_MAP[i].match) {
      return { status: ERROR_MAP[i].status, message: ERROR_MAP[i].message || msg };
    }
  }

  return { status: 500, message: fallbackMessage || 'Internal server error' };
}

// ── Google Sheets formula injection prevention ──────────────────
// Cells starting with =, +, -, or @ can be interpreted as formulas.
// Prefix with a single quote to force text interpretation.

function sanitizeForSheet(value) {
  if (typeof value !== 'string') return value;
  if (/^[=+\-@]/.test(value)) return "'" + value;
  return value;
}

// ── HTML output escaping ────────────────────────────────────────
// Prevent XSS when interpolating user data into HTML responses.

function escapeHtml(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  if (typeof url !== 'string') return '';
  var trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return escapeHtml(trimmed);
  return '';
}

// ── Exports ─────────────────────────────────────────────────────────

module.exports = {
  normalizeText: normalizeText,
  parseNumber: parseNumber,
  parseDate: parseDate,
  sendJson: sendJson,
  sendCachedJson: sendCachedJson,
  handleMethodNotAllowed: handleMethodNotAllowed,
  handleHead: handleHead,
  handleOptions: handleOptions,
  getClientIp: getClientIp,
  isAllowedOriginValue: isAllowedOriginValue,
  hasAllowedOrigin: hasAllowedOrigin,
  DEFAULT_APPS_SCRIPT_URL: DEFAULT_APPS_SCRIPT_URL,
  isRateLimited: isRateLimited,
  readRequestBody: readRequestBody,
  parseGvizResponse: parseGvizResponse,
  fetchSheet: fetchSheet,
  forwardToAppsScript: forwardToAppsScript,
  mapErrorToResponse: mapErrorToResponse,
  sanitizeForSheet: sanitizeForSheet,
  escapeHtml: escapeHtml,
  sanitizeUrl: sanitizeUrl
};
