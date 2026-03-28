import { mockReq, mockRes, mockGlobalFetch, mockFetchResponse } from './helpers.js';

const originalFetch = globalThis.fetch;

const handler = (await import('../api/checkin.js')).default;

afterEach(() => {
  globalThis.fetch = originalFetch;
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
  it('forwards sanitized data to Apps Script and returns 200', async () => {
    const fetchMock = stubAppsScript();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: validBody() }), res);
    expect(getResult().statusCode).toBe(200);
    expect(getResult().body).toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
