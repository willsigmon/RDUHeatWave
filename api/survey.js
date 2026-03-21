'use strict';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkchMEuPQlPe91xWx3QGeSD_yk0q4g-1iBZ0gumknVqBu1s57_A0Dg2pbd64huh21D/exec';
const APPS_SCRIPT_TIMEOUT_MS = 10 * 1000;
const BURST_WINDOW_MS = 60 * 1000;
const BURST_LIMIT = 6;
const HOURLY_WINDOW_MS = 60 * 60 * 1000;
const HOURLY_LIMIT = 20;
const MAX_BODY_BYTES = 50 * 1024;

const RADIO_FIELDS = ['q1', 'q2', 'q3', 'q5', 'q6', 'q7', 'q8', 'q9'];
const CHECKBOX_FIELDS = ['q4'];
const TEXT_FIELDS = ['q10'];

const ALLOWED_VALUES = {
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

const rateLimitStore = new Map();

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

function getClientIp(req) {
  const forwardedFor = normalizeText(req.headers['x-forwarded-for']);
  if (forwardedFor) {
    return normalizeText(forwardedFor.split(',')[0]);
  }
  return normalizeText(req.headers['x-real-ip']);
}

function isAllowedOriginValue(value) {
  if (!value) return true;
  try {
    const origin = new URL(value).origin;
    return origin === 'https://rduheatwave.team' ||
      origin === 'https://www.rduheatwave.team' ||
      /^https:\/\/rduheat-[a-z0-9-]+-wsmco\.vercel\.app$/i.test(origin);
  } catch (error) {
    return false;
  }
}

function hasAllowedOrigin(req) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  if (!origin && !referer) return true;
  return isAllowedOriginValue(origin) && isAllowedOriginValue(referer);
}

function isRateLimited(ipAddress) {
  if (!ipAddress) return false;
  const now = Date.now();
  const recentRequests = (rateLimitStore.get(ipAddress) || []).filter(function(timestamp) {
    return (now - timestamp) < HOURLY_WINDOW_MS;
  });
  const requestsInBurstWindow = recentRequests.filter(function(timestamp) {
    return (now - timestamp) < BURST_WINDOW_MS;
  });
  if (requestsInBurstWindow.length >= BURST_LIMIT || recentRequests.length >= HOURLY_LIMIT) {
    rateLimitStore.set(ipAddress, recentRequests);
    return true;
  }
  recentRequests.push(now);
  rateLimitStore.set(ipAddress, recentRequests);
  return false;
}

async function readRequestBody(req) {
  const contentType = String(req.headers['content-type'] || '')
    .split(';')[0]
    .trim()
    .toLowerCase();

  if (typeof req.body === 'string') {
    return parseRawBody(req.body, contentType);
  }
  if (Buffer.isBuffer(req.body)) {
    return parseRawBody(req.body.toString('utf8'), contentType);
  }
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new Error('Request body too large');
    }
    chunks.push(Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return parseRawBody(rawBody, contentType);
}

function parseRawBody(rawBody, contentType) {
  if (!rawBody) return {};
  if (contentType === 'application/json') {
    try {
      return JSON.parse(rawBody);
    } catch (error) {
      throw new Error('Invalid JSON body');
    }
  }
  throw new Error('Unsupported content type');
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function validateSurvey(body) {
  for (const field of RADIO_FIELDS) {
    const value = normalizeText(body[field]);
    if (!value) {
      return 'Missing answer for ' + field;
    }
    if (ALLOWED_VALUES[field] && ALLOWED_VALUES[field].indexOf(value) === -1) {
      return 'Invalid value for ' + field;
    }
  }

  for (const field of CHECKBOX_FIELDS) {
    const value = body[field];
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return 'Missing answer for ' + field;
    }
    const values = Array.isArray(value) ? value : [value];
    if (values.length > 2) {
      return 'Too many selections for ' + field;
    }
    for (const v of values) {
      if (ALLOWED_VALUES[field].indexOf(normalizeText(v)) === -1) {
        return 'Invalid value for ' + field;
      }
    }
  }

  return null;
}

function buildEntry(body) {
  const entry = { source: 'survey' };

  for (const field of RADIO_FIELDS) {
    entry[field] = normalizeText(body[field]);
  }

  for (const field of CHECKBOX_FIELDS) {
    const value = body[field];
    const values = Array.isArray(value) ? value : [value];
    entry[field] = values.map(normalizeText).join(', ');
  }

  for (const field of TEXT_FIELDS) {
    const text = normalizeText(body[field]);
    entry[field] = text.substring(0, 2000);
  }

  return entry;
}

async function forwardToAppsScript(entry) {
  const formData = new URLSearchParams();
  Object.keys(entry).forEach(function(field) {
    formData.append(field, entry[field]);
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(function() {
    controller.abort();
  }, APPS_SCRIPT_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
      },
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

  const text = await response.text();
  const isSuccess = response.ok && /"status"\s*:\s*"ok"/.test(text);
  return { ok: isSuccess, statusCode: response.status, body: text };
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (req.method === 'HEAD') {
      res.statusCode = 200;
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.end();
    }
    return sendJson(res, 200, { status: 'ok', target: 'survey' });
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', 'GET, HEAD, POST, OPTIONS');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, HEAD, POST, OPTIONS');
    return sendJson(res, 405, { status: 'error', message: 'Method not allowed' });
  }

  try {
    if (!hasAllowedOrigin(req)) {
      return sendJson(res, 403, { status: 'error', message: 'Origin not allowed' });
    }

    if (isRateLimited(getClientIp(req))) {
      return sendJson(res, 429, { status: 'error', message: 'Too many submissions. Please try again shortly.' });
    }

    const body = await readRequestBody(req);
    const validationError = validateSurvey(body);

    if (validationError) {
      return sendJson(res, 400, { status: 'error', message: validationError });
    }

    const entry = buildEntry(body);
    const result = await forwardToAppsScript(entry);

    if (!result.ok) {
      return sendJson(res, 502, { status: 'error', message: 'Google Sheets sync failed' });
    }

    return sendJson(res, 200, { status: 'ok' });
  } catch (error) {
    const errorMessage = error && error.message ? String(error.message) : '';
    const isInvalidJsonError =
      errorMessage === 'Invalid JSON body' ||
      (error && error.name === 'SyntaxError') ||
      /unexpected token|unexpected end|json/i.test(errorMessage);

    const message = errorMessage === 'Request body too large'
      ? 'Request body too large'
      : isInvalidJsonError
        ? 'Invalid JSON body'
        : errorMessage === 'Apps Script request timed out'
          ? 'Google Sheets sync timed out'
          : errorMessage === 'Unsupported content type'
            ? 'Unsupported content type'
            : 'Unable to process survey';

    const statusCode = message === 'Request body too large'
      ? 413
      : message === 'Invalid JSON body'
        ? 400
        : message === 'Google Sheets sync timed out'
          ? 504
          : message === 'Unsupported content type'
            ? 415
            : 500;

    return sendJson(res, statusCode, { status: 'error', message: message });
  }
};
