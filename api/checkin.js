'use strict';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwvYv_BYJznuumdC51jP-P6RuYRRgK5MEONjUywvl322MbR1W1_nA1hZHcsSj5oLfzvoQ/exec';
const REQUIRED_FIELDS = ['firstName', 'lastName', 'profession', 'phone', 'email', 'guestOf'];
const OPTIONAL_FIELDS = ['companyName', 'idealReferral'];
const HONEYPOT_FIELD = 'companyWebsite';
const APPS_SCRIPT_TIMEOUT_MS = 10 * 1000;
const BURST_WINDOW_MS = 60 * 1000;
const BURST_LIMIT = 12;
const HOURLY_WINDOW_MS = 60 * 60 * 1000;
const HOURLY_LIMIT = 60;
const FIELD_LENGTH_LIMITS = {
  firstName: 80,
  lastName: 80,
  profession: 120,
  companyName: 120,
  phone: 40,
  email: 254,
  guestOf: 120,
  idealReferral: 180
};
const ALLOWED_FIELD_VALUES = {};
const MAX_BODY_BYTES = 50 * 1024;
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

  if (!origin && !referer) {
    return true;
  }

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

  if (contentType === 'application/x-www-form-urlencoded') {
    return Object.fromEntries(new URLSearchParams(rawBody));
  }

  throw new Error('Unsupported content type');
}

function normalizeEntry(body) {
  return REQUIRED_FIELDS.concat(OPTIONAL_FIELDS).reduce(function(entry, field) {
    entry[field] = normalizeFieldValue(field, body[field]);
    return entry;
  }, {});
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeFieldValue(field, value) {
  const normalizedValue = normalizeText(value);
  const allowedValues = ALLOWED_FIELD_VALUES[field];

  if (!allowedValues || !allowedValues.length || !normalizedValue) {
    return normalizedValue;
  }

  const matchedValue = allowedValues.find(function(allowedValue) {
    return allowedValue.toLowerCase() === normalizedValue.toLowerCase();
  });

  return matchedValue || normalizedValue;
}

function validateEntry(entry) {
  const missingFields = REQUIRED_FIELDS.filter(function(field) {
    return !entry[field];
  });

  if (missingFields.length) {
    return 'Missing required field' + (missingFields.length > 1 ? 's' : '');
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(entry.email)) {
    return 'Invalid email address';
  }

  const overLimitField = REQUIRED_FIELDS.concat(OPTIONAL_FIELDS).find(function(field) {
    return entry[field].length > FIELD_LENGTH_LIMITS[field];
  });

  if (overLimitField) {
    return 'One or more fields are too long';
  }

  const invalidOptionField = Object.keys(ALLOWED_FIELD_VALUES).find(function(field) {
    return ALLOWED_FIELD_VALUES[field].indexOf(entry[field]) === -1;
  });

  if (invalidOptionField) {
    return 'One or more fields contain an invalid option';
  }

  return null;
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

  return {
    ok: isSuccess,
    statusCode: response.status,
    body: text
  };
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (req.method === 'HEAD') {
      res.statusCode = 200;
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.end();
    }

    return sendJson(res, 200, { status: 'ok', target: 'apps-script' });
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
    if (normalizeText(body[HONEYPOT_FIELD])) {
      return sendJson(res, 200, { status: 'ok' });
    }

    const entry = normalizeEntry(body);
    const validationError = validateEntry(entry);

    if (validationError) {
      return sendJson(res, 400, { status: 'error', message: validationError });
    }

    const result = await forwardToAppsScript(entry);
    if (!result.ok) {
      return sendJson(res, 502, {
        status: 'error',
        message: 'Google Sheets sync failed'
      });
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
        : 'Unable to process check-in';

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
