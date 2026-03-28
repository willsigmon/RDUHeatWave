import { mockReq, mockRes, mockGlobalFetch, mockFetchResponse } from './helpers.js';

const originalFetch = globalThis.fetch;

const handler = (await import('../api/crm.js')).default;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubAppsScript(body = '{"status":"ok","result":"success"}') {
  return mockGlobalFetch(async () => mockFetchResponse(body));
}

// ── HTTP methods ───────────────────────────────────────────────────

describe('crm handler — HTTP methods', () => {
  it('GET returns probe', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    expect(getResult().body).toEqual({ status: 'ok', target: 'apps-script' });
  });

  it('returns 405 on DELETE', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'DELETE' }), res);
    expect(getResult().statusCode).toBe(405);
  });
});

// ── Formula injection sanitization ─────────────────────────────────

describe('crm handler — sanitization', () => {
  it('sanitizes formula-like string values before forwarding', async () => {
    const fetchMock = stubAppsScript();
    const { res } = mockRes();
    const body = { action: 'update', name: '=IMPORTRANGE()' };
    await handler(mockReq({ method: 'POST', body }), res);
    // The forwarded body should have the '= prefix sanitized
    const sentBody = fetchMock.mock.calls[0][1].body;
    expect(sentBody).toContain("name=%27%3DIMPORTRANGE"); // URL-encoded '=IMPORTRANGE
    expect(sentBody).toContain('action=update'); // safe string untouched
  });
});

// ── Origin check ───────────────────────────────────────────────────

describe('crm handler — origin', () => {
  it('rejects disallowed origin', async () => {
    const { res, getResult } = mockRes();
    await handler(
      mockReq({
        method: 'POST',
        headers: { origin: 'https://hacker.com', 'content-type': 'application/json', 'x-forwarded-for': '1.1.1.1' },
        body: { action: 'list' },
      }),
      res,
    );
    expect(getResult().statusCode).toBe(403);
  });
});

// ── Proxy behavior ─────────────────────────────────────────────────

describe('crm handler — proxy', () => {
  it('returns raw Apps Script body on success', async () => {
    stubAppsScript('{"status":"ok","result":"success"}');
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: { action: 'list' } }), res);
    const result = getResult();
    expect(result.statusCode).toBe(200);
    expect(result.rawBody).toBe('{"status":"ok","result":"success"}');
  });

  it('returns 502 when Apps Script fails', async () => {
    mockGlobalFetch(async () => mockFetchResponse('{"error":"boom"}', { status: 500, ok: false }));
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: { action: 'list' } }), res);
    expect(getResult().statusCode).toBe(502);
  });
});

// ── Error handling ─────────────────────────────────────────────────

describe('crm handler — errors', () => {
  it('handles fetch timeout gracefully', async () => {
    mockGlobalFetch(async () => {
      const err = new Error('Apps Script request timed out');
      err.name = 'AbortError';
      throw err;
    });
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: { action: 'list' } }), res);
    // Should map to an error response
    expect(getResult().statusCode).toBeGreaterThanOrEqual(400);
  });
});
