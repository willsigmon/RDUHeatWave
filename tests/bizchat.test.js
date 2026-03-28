import { mockReq, mockRes, mockGlobalFetch, mockFetchResponse } from './helpers.js';

const originalFetch = globalThis.fetch;

const handler = (await import('../api/bizchat.js')).default;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function validBody() {
  return {
    member: 'Alice Smith',
    metWith: 'Bob Jones',
    date: '2026-03-15',
  };
}

function stubAppsScript() {
  return mockGlobalFetch(async () => mockFetchResponse('{"status":"ok"}'));
}

// ── HTTP methods ───────────────────────────────────────────────────

describe('bizchat handler — HTTP methods', () => {
  it('GET returns probe', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    expect(getResult().body).toEqual({ status: 'ok', target: 'bizchat' });
  });

  it('HEAD returns empty 200', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'HEAD' }), res);
    expect(getResult().statusCode).toBe(200);
    expect(getResult().rawBody).toBe('');
  });

  it('PATCH returns 405', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'PATCH' }), res);
    expect(getResult().statusCode).toBe(405);
  });
});

// ── Validation ─────────────────────────────────────────────────────

describe('bizchat handler — validation', () => {
  it('rejects missing member name', async () => {
    stubAppsScript();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: { ...validBody(), member: '' } }), res);
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/name is required/i);
  });

  it('rejects missing metWith', async () => {
    stubAppsScript();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: { ...validBody(), metWith: '' } }), res);
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/met with is required/i);
  });

  it('rejects missing date', async () => {
    stubAppsScript();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: { ...validBody(), date: '' } }), res);
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/date is required/i);
  });

  it('rejects self-chat', async () => {
    stubAppsScript();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: { member: 'Alice', metWith: 'Alice', date: '2026-03-15' } }), res);
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/yourself/i);
  });

  it('rejects names exceeding 80 chars', async () => {
    stubAppsScript();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: { ...validBody(), member: 'A'.repeat(81) } }), res);
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/too long/i);
  });

  it('rejects invalid date format', async () => {
    stubAppsScript();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: { ...validBody(), date: '03/15/2026' } }), res);
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/invalid date format/i);
  });

  it('rejects future dates', async () => {
    stubAppsScript();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: { ...validBody(), date: '2099-01-01' } }), res);
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/future/i);
  });
});

// ── Happy path ─────────────────────────────────────────────────────

describe('bizchat handler — success', () => {
  it('formats date as M/D/YYYY and forwards to Apps Script', async () => {
    const fetchMock = stubAppsScript();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: validBody() }), res);
    expect(getResult().statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Check that date was reformatted: 2026-03-15 → 3/15/2026
    const sentBody = fetchMock.mock.calls[0][1].body;
    expect(sentBody).toContain('date=3%2F15%2F2026');
  });
});

// ── Origin check ───────────────────────────────────────────────────

describe('bizchat handler — origin', () => {
  it('rejects disallowed origin', async () => {
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

// ── Apps Script failure ────────────────────────────────────────────

describe('bizchat handler — Apps Script failure', () => {
  it('returns 502 on backend error', async () => {
    mockGlobalFetch(async () => mockFetchResponse('{"error":"fail"}', { status: 500, ok: false }));
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: validBody() }), res);
    expect(getResult().statusCode).toBe(502);
  });
});
