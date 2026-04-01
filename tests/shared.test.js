import { mockRes, gvizResponse, mockGlobalFetch, mockFetchResponse } from './helpers.js';

let shared;
beforeEach(async () => {
  vi.resetModules();
  shared = (await import('../api/_lib/shared.js'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── normalizeText ──────────────────────────────────────────────────

describe('normalizeText', () => {
  it('trims and collapses whitespace', () => {
    expect(shared.normalizeText('  hello   world  ')).toBe('hello world');
  });

  it('returns empty string for null/undefined', () => {
    expect(shared.normalizeText(null)).toBe('');
    expect(shared.normalizeText(undefined)).toBe('');
  });

  it('converts numbers to strings', () => {
    expect(shared.normalizeText(42)).toBe('42');
  });
});

// ── parseNumber ────────────────────────────────────────────────────

describe('parseNumber', () => {
  it('parses plain numbers', () => {
    expect(shared.parseNumber('123')).toBe(123);
  });

  it('strips dollar signs and commas', () => {
    expect(shared.parseNumber('$1,234.56')).toBe(1234.56);
  });

  it('returns 0 for empty/dash values', () => {
    expect(shared.parseNumber('')).toBe(0);
    expect(shared.parseNumber('-')).toBe(0);
    expect(shared.parseNumber(null)).toBe(0);
  });

  it('returns 0 for non-numeric strings', () => {
    expect(shared.parseNumber('abc')).toBe(0);
  });
});

// ── parseDate ──────────────────────────────────────────────────────

describe('parseDate', () => {
  it('parses MM/DD/YYYY', () => {
    const d = shared.parseDate('3/15/2026');
    expect(d).toBeInstanceOf(Date);
    expect(d.getUTCMonth()).toBe(2);
    expect(d.getUTCDate()).toBe(15);
    expect(d.getUTCFullYear()).toBe(2026);
  });

  it('parses MM-DD-YY (short year)', () => {
    const d = shared.parseDate('01-05-26');
    expect(d.getUTCFullYear()).toBe(2026);
  });

  it('returns null for empty string', () => {
    expect(shared.parseDate('')).toBeNull();
  });

  it('returns null for invalid format', () => {
    expect(shared.parseDate('2026-03-15')).toBeNull();
    expect(shared.parseDate('not a date')).toBeNull();
  });
});

// ── sanitizeForSheet ───────────────────────────────────────────────

describe('sanitizeForSheet', () => {
  it('prefixes formula-like strings with a single quote', () => {
    expect(shared.sanitizeForSheet('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(shared.sanitizeForSheet('+1234')).toBe("'+1234");
    expect(shared.sanitizeForSheet('-negative')).toBe("'-negative");
    expect(shared.sanitizeForSheet('@mention')).toBe("'@mention");
  });

  it('passes through safe strings unchanged', () => {
    expect(shared.sanitizeForSheet('hello')).toBe('hello');
    expect(shared.sanitizeForSheet('123')).toBe('123');
  });

  it('passes through non-string values', () => {
    expect(shared.sanitizeForSheet(42)).toBe(42);
    expect(shared.sanitizeForSheet(null)).toBeNull();
  });
});

// ── sendJson ───────────────────────────────────────────────────────

describe('sendJson', () => {
  it('sets status code, content-type, and JSON body', () => {
    const { res, getResult } = mockRes();
    shared.sendJson(res, 201, { ok: true });
    const result = getResult();
    expect(result.statusCode).toBe(201);
    expect(result.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(result.body).toEqual({ ok: true });
  });

  it('defaults cache to no-store', () => {
    const { res, getResult } = mockRes();
    shared.sendJson(res, 200, {});
    expect(getResult().headers['cache-control']).toBe('no-store, max-age=0');
  });
});

// ── sendCachedJson ─────────────────────────────────────────────────

describe('sendCachedJson', () => {
  it('sets CDN-friendly cache headers', () => {
    const { res, getResult } = mockRes();
    shared.sendCachedJson(res, 200, { data: 1 });
    expect(getResult().headers['cache-control']).toContain('s-maxage=300');
  });
});

// ── handleMethodNotAllowed ─────────────────────────────────────────

describe('handleMethodNotAllowed', () => {
  it('returns 405 with Allow header', () => {
    const { res, getResult } = mockRes();
    shared.handleMethodNotAllowed({}, res, ['GET', 'POST']);
    const result = getResult();
    expect(result.statusCode).toBe(405);
    expect(result.headers['allow']).toBe('GET, POST');
  });
});

// ── handleHead ─────────────────────────────────────────────────────

describe('handleHead', () => {
  it('returns 200 with no body', () => {
    const { res, getResult } = mockRes();
    shared.handleHead(res);
    const result = getResult();
    expect(result.statusCode).toBe(200);
    expect(result.rawBody).toBe('');
  });
});

// ── handleOptions ──────────────────────────────────────────────────

describe('handleOptions', () => {
  it('returns 204 with Allow header', () => {
    const { res, getResult } = mockRes();
    shared.handleOptions(res, ['GET', 'OPTIONS']);
    const result = getResult();
    expect(result.statusCode).toBe(204);
    expect(result.headers['allow']).toBe('GET, OPTIONS');
  });
});

// ── getClientIp ────────────────────────────────────────────────────

describe('getClientIp', () => {
  it('extracts last IP from x-forwarded-for (Vercel appends real IP last)', () => {
    expect(shared.getClientIp({
      headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' },
    })).toBe('10.0.0.2');
  });

  it('falls back to x-real-ip', () => {
    expect(shared.getClientIp({
      headers: { 'x-real-ip': '10.0.0.99' },
    })).toBe('10.0.0.99');
  });

  it('returns empty string when no headers present', () => {
    expect(shared.getClientIp({ headers: {} })).toBe('');
  });
});

// ── isAllowedOriginValue ───────────────────────────────────────────

describe('isAllowedOriginValue', () => {
  it('allows production origins', () => {
    expect(shared.isAllowedOriginValue('https://rduheatwave.team')).toBe(true);
    expect(shared.isAllowedOriginValue('https://www.rduheatwave.team')).toBe(true);
  });

  it('allows Vercel preview origins', () => {
    expect(shared.isAllowedOriginValue('https://rduheat-abc123-wsmco.vercel.app')).toBe(true);
  });

  it('rejects unknown origins', () => {
    expect(shared.isAllowedOriginValue('https://evil.com')).toBe(false);
  });

  it('allows empty/null (for GET requests)', () => {
    expect(shared.isAllowedOriginValue('')).toBe(true);
    expect(shared.isAllowedOriginValue(null)).toBe(true);
    expect(shared.isAllowedOriginValue(undefined)).toBe(true);
  });
});

// ── hasAllowedOrigin ───────────────────────────────────────────────

describe('hasAllowedOrigin', () => {
  it('allows POST with valid origin', () => {
    expect(shared.hasAllowedOrigin({
      method: 'POST',
      headers: { origin: 'https://rduheatwave.team' },
    })).toBe(true);
  });

  it('rejects POST with no origin or referer', () => {
    expect(shared.hasAllowedOrigin({
      method: 'POST',
      headers: {},
    })).toBe(false);
  });

  it('rejects POST with bad origin', () => {
    expect(shared.hasAllowedOrigin({
      method: 'POST',
      headers: { origin: 'https://evil.com' },
    })).toBe(false);
  });

  it('allows GET with no origin', () => {
    expect(shared.hasAllowedOrigin({
      method: 'GET',
      headers: {},
    })).toBe(true);
  });
});

// ── isRateLimited (in-memory fallback) ─────────────────────────────

describe('isRateLimited', () => {
  it('allows requests under burst limit', async () => {
    const result = await shared.isRateLimited('test-rl-1', { burst: 5, hourly: 100, burstWindowMs: 60000 });
    expect(result).toBe(false);
  });

  it('blocks when burst limit exceeded', async () => {
    const ip = 'test-rl-burst-' + Date.now();
    const limits = { burst: 3, hourly: 100, burstWindowMs: 60000 };
    await shared.isRateLimited(ip, limits);
    await shared.isRateLimited(ip, limits);
    await shared.isRateLimited(ip, limits);
    const blocked = await shared.isRateLimited(ip, limits);
    expect(blocked).toBe(true);
  });

  it('returns false for empty IP', async () => {
    expect(await shared.isRateLimited('', {})).toBe(false);
    expect(await shared.isRateLimited(null, {})).toBe(false);
  });
});

// ── readRequestBody ────────────────────────────────────────────────

describe('readRequestBody', () => {
  it('parses pre-parsed object body (Vercel default)', async () => {
    const req = {
      headers: { 'content-type': 'application/json' },
      body: { foo: 'bar' },
    };
    const result = await shared.readRequestBody(req);
    expect(result).toEqual({ foo: 'bar' });
  });

  it('parses string JSON body', async () => {
    const req = {
      headers: { 'content-type': 'application/json' },
      body: '{"a":1}',
    };
    const result = await shared.readRequestBody(req);
    expect(result).toEqual({ a: 1 });
  });

  it('parses Buffer body', async () => {
    const req = {
      headers: { 'content-type': 'application/json' },
      body: Buffer.from('{"b":2}'),
    };
    const result = await shared.readRequestBody(req);
    expect(result).toEqual({ b: 2 });
  });

  it('parses form-urlencoded string body', async () => {
    const req = {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'name=Alice&age=30',
    };
    const result = await shared.readRequestBody(req);
    expect(result).toEqual({ name: 'Alice', age: '30' });
  });

  it('throws on invalid JSON', async () => {
    const req = {
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    };
    await expect(shared.readRequestBody(req)).rejects.toThrow('Invalid JSON body');
  });

  it('throws on unsupported content type', async () => {
    const req = {
      headers: { 'content-type': 'text/plain' },
      body: 'hello',
    };
    await expect(shared.readRequestBody(req)).rejects.toThrow('Unsupported content type');
  });
});

// ── parseGvizResponse ──────────────────────────────────────────────

describe('parseGvizResponse', () => {
  it('parses a standard gviz JSONP response', () => {
    const raw = gvizResponse(['Name', 'Score'], [['Alice', 10], ['Bob', 20]]);
    const result = shared.parseGvizResponse(raw);
    expect(result.cols).toEqual(['Name', 'Score']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual(['Alice', 10]);
  });

  it('throws on invalid format', () => {
    expect(() => shared.parseGvizResponse('not valid')).toThrow('Invalid gviz response');
  });
});

// ── fetchSheet ─────────────────────────────────────────────────────

describe('fetchSheet', () => {
  it('fetches and parses a Google Sheet via gviz', async () => {
    const gviz = gvizResponse(['Name'], [['Alice'], ['Bob']]);
    mockGlobalFetch(async () => mockFetchResponse(gviz));

    const result = await shared.fetchSheet('fake-id', 'Sheet1', 5000);
    expect(result.cols).toEqual(['Name']);
    expect(result.rows).toHaveLength(2);
  });

  it('throws on non-ok response', async () => {
    mockGlobalFetch(async () => mockFetchResponse('', { status: 500, ok: false }));
    await expect(shared.fetchSheet('id', 'Sheet1')).rejects.toThrow('Sheet fetch failed');
  });
});

// ── forwardToAppsScript ────────────────────────────────────────────

describe('forwardToAppsScript', () => {
  it('returns ok: true when Apps Script responds with success', async () => {
    mockGlobalFetch(async () => mockFetchResponse('{"status":"ok"}'));
    const result = await shared.forwardToAppsScript('https://script.google.com/exec', { name: 'test' });
    expect(result.ok).toBe(true);
  });

  it('returns ok: false on error response', async () => {
    mockGlobalFetch(async () => mockFetchResponse('{"error":"fail"}', { status: 500, ok: false }));
    const result = await shared.forwardToAppsScript('https://script.google.com/exec', { name: 'test' });
    expect(result.ok).toBe(false);
  });
});

// ── mapErrorToResponse ─────────────────────────────────────────────

describe('mapErrorToResponse', () => {
  it('maps body too large to 413', () => {
    expect(shared.mapErrorToResponse(new Error('Request body too large')).status).toBe(413);
  });

  it('maps invalid JSON to 400', () => {
    expect(shared.mapErrorToResponse(new Error('Invalid JSON body')).status).toBe(400);
  });

  it('maps timeout to 504', () => {
    expect(shared.mapErrorToResponse(new Error('Apps Script request timed out')).status).toBe(504);
  });

  it('maps unsupported content type to 415', () => {
    expect(shared.mapErrorToResponse(new Error('Unsupported content type')).status).toBe(415);
  });

  it('maps SyntaxError to 400 (bad JSON)', () => {
    expect(shared.mapErrorToResponse(new SyntaxError('Unexpected token')).status).toBe(400);
  });

  it('falls back to 500 for unknown errors', () => {
    const result = shared.mapErrorToResponse(new Error('Something'), 'Oops');
    expect(result.status).toBe(500);
    expect(result.message).toBe('Oops');
  });
});
