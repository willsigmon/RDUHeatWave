import { mockReq, mockRes, mockGlobalFetch, mockFetchResponse } from './helpers.js';
import { generateKeyPairSync } from 'crypto';

process.env.APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/test/exec';
process.env.CHECKIN_SHARED_SECRET = 'test-checkin-secret';

const originalFetch = globalThis.fetch;

const handler = (await import('../api/checkin.js')).default;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_PRIVATE_KEY;
});

function validBody() {
  return {
    firstName: 'Alice',
    lastName: 'Smith',
    profession: 'Engineer',
    phone: '555-1234',
    email: 'alice@example.com',
    guestOf: 'Carter Helms',
    companyName: 'Acme Inc',
    idealReferral: 'Designers',
  };
}

function stubAppsScript() {
  return mockGlobalFetch(async () => mockFetchResponse('{"status":"ok"}'));
}

function generateTestPrivateKey() {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }).privateKey;
}

function stubSheetsApi(existingRows) {
  return mockGlobalFetch(async (url, opts) => {
    const urlStr = String(url);

    if (urlStr.includes('oauth2.googleapis.com/token')) {
      return mockFetchResponse({ access_token: 'fake-token', expires_in: 3600 });
    }

    if (urlStr.includes('/values/') && (!opts || opts.method === 'GET' || !opts.method)) {
      return mockFetchResponse({
        values: existingRows || [
          ['Meeting', 'First Name', 'Last Name', 'Profession', 'Company', 'Email', 'Phone', 'Guest Of', 'First Visit?', 'Ideal Intro'],
          ['4/23/2026', 'Existing', 'Guest', 'Designer', '', 'existing@example.com', '555-0000', 'Carter Helms', 'Yes', ''],
        ],
      });
    }

    if (urlStr.includes(':append')) {
      return mockFetchResponse({ updates: { updatedRows: 1 } });
    }

    throw new Error(`Unmocked check-in Sheets URL: ${urlStr}`);
  });
}

// ── GET / HEAD / OPTIONS ───────────────────────────────────────────

describe('checkin handler — HTTP methods', () => {
  it('returns status probe on GET', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    expect(getResult().statusCode).toBe(200);
    expect(getResult().body).toEqual({ status: 'ok', target: 'apps-script' });
  });

  it('returns empty body on HEAD', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'HEAD' }), res);
    expect(getResult().statusCode).toBe(200);
    expect(getResult().rawBody).toBe('');
  });

  it('returns 204 on OPTIONS', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'OPTIONS' }), res);
    expect(getResult().statusCode).toBe(204);
  });

  it('returns 405 on DELETE', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'DELETE' }), res);
    expect(getResult().statusCode).toBe(405);
  });
});

// ── Validation ─────────────────────────────────────────────────────

describe('checkin handler — validation', () => {
  it('rejects missing required fields', async () => {
    stubAppsScript();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: { firstName: 'Alice' } }), res);
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/missing required field/i);
  });

  it('rejects invalid email', async () => {
    stubAppsScript();
    const { res, getResult } = mockRes();
    const body = validBody();
    body.email = 'not-an-email';
    await handler(mockReq({ method: 'POST', body }), res);
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/invalid email/i);
  });

  it('rejects fields exceeding length limits', async () => {
    stubAppsScript();
    const { res, getResult } = mockRes();
    const body = validBody();
    body.firstName = 'A'.repeat(81);
    await handler(mockReq({ method: 'POST', body }), res);
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/too long/i);
  });
});

// ── Honeypot ───────────────────────────────────────────────────────

describe('checkin handler — honeypot', () => {
  it('silently accepts when honeypot field is filled (bot trap)', async () => {
    const fetchMock = stubAppsScript();
    const { res, getResult } = mockRes();
    const body = { ...validBody(), companyWebsite: 'http://spam.com' };
    await handler(mockReq({ method: 'POST', body }), res);
    expect(getResult().statusCode).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── Origin check ───────────────────────────────────────────────────

describe('checkin handler — origin', () => {
  it('rejects POST with disallowed origin', async () => {
    const { res, getResult } = mockRes();
    await handler(
      mockReq({
        method: 'POST',
        headers: { origin: 'https://evil.com', 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
        body: validBody(),
      }),
      res,
    );
    expect(getResult().statusCode).toBe(403);
  });
});

// ── Happy path ─────────────────────────────────────────────────────

describe('checkin handler — success', () => {
  it('forwards sanitized data to Apps Script when Sheets credentials are absent', async () => {
    const fetchMock = stubAppsScript();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: validBody() }), res);
    expect(getResult().statusCode).toBe(200);
    expect(getResult().body).toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].body).toContain('checkinSecret=test-checkin-secret');
  });

  it('writes directly to Google Sheets when service account credentials are configured', async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@test.iam.gserviceaccount.com';
    process.env.GOOGLE_PRIVATE_KEY = generateTestPrivateKey();
    vi.resetModules();
    const { default: sheetsHandler } = await import('../api/checkin.js');
    const fetchMock = stubSheetsApi();

    const { res, getResult } = mockRes();
    await sheetsHandler(mockReq({ method: 'POST', body: validBody() }), res);

    expect(getResult().statusCode).toBe(200);
    expect(getResult().body).toEqual({ status: 'ok' });

    const appendCall = fetchMock.mock.calls.find(([url]) => String(url).includes(':append'));
    expect(appendCall).toBeTruthy();
    var body = JSON.parse(appendCall[1].body);
    expect(body.values[0].slice(1)).toEqual([
      'Alice',
      'Smith',
      'Engineer',
      'Acme Inc',
      'alice@example.com',
      '555-1234',
      'Carter Helms',
      'Yes',
      'Designers',
    ]);
  });
});

// ── Apps Script failure ────────────────────────────────────────────

describe('checkin handler — Apps Script failure', () => {
  it('returns 502 when Apps Script returns failure', async () => {
    mockGlobalFetch(async () => mockFetchResponse('{"error":"oops"}', { status: 500, ok: false }));
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: validBody() }), res);
    expect(getResult().statusCode).toBe(502);
  });
});
