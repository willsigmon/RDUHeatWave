import { mockReq, mockRes, mockGlobalFetch, mockFetchResponse } from './helpers.js';

const originalFetch = globalThis.fetch;

const handler = (await import('../api/survey.js')).default;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function validSurvey() {
  return {
    q1: '3', q2: '2', q3: '4', q4: ['intros', 'bizchat'],
    q5: '5', q6: '10-19', q7: 'n/a', q8: 'referrals', q9: '4',
    q10: 'Great meeting!',
  };
}

function stubAppsScript() {
  return mockGlobalFetch(async () => mockFetchResponse('{"status":"ok"}'));
}

// ── HTTP methods ───────────────────────────────────────────────────

describe('survey handler — HTTP methods', () => {
  it('returns status probe on GET', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    expect(getResult().body).toEqual({ status: 'ok', target: 'survey' });
  });

  it('returns 405 on PUT', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'PUT' }), res);
    expect(getResult().statusCode).toBe(405);
  });
});

// ── Validation — radio questions ───────────────────────────────────

describe('survey handler — radio validation', () => {
  it('rejects missing radio answer', async () => {
    stubAppsScript();
    const { res, getResult } = mockRes();
    const body = validSurvey();
    delete body.q1;
    await handler(mockReq({ method: 'POST', body }), res);
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/missing answer for q1/i);
  });

  it('rejects invalid value for radio question', async () => {
    stubAppsScript();
    const { res, getResult } = mockRes();
    const body = validSurvey();
    body.q1 = '99';
    await handler(mockReq({ method: 'POST', body }), res);
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/invalid value for q1/i);
  });
});

// ── Validation — checkbox questions ────────────────────────────────

describe('survey handler — checkbox validation', () => {
  it('rejects empty checkbox selection', async () => {
    stubAppsScript();
    const { res, getResult } = mockRes();
    const body = validSurvey();
    body.q4 = [];
    await handler(mockReq({ method: 'POST', body }), res);
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/missing answer for q4/i);
  });

  it('rejects too many checkbox selections', async () => {
    stubAppsScript();
    const { res, getResult } = mockRes();
    const body = validSurvey();
    body.q4 = ['intros', 'bizchat', 'mentor'];
    await handler(mockReq({ method: 'POST', body }), res);
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/too many selections/i);
  });

  it('rejects invalid checkbox value', async () => {
    stubAppsScript();
    const { res, getResult } = mockRes();
    const body = validSurvey();
    body.q4 = ['invalid_option'];
    await handler(mockReq({ method: 'POST', body }), res);
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/invalid value for q4/i);
  });
});

// ── Validation — allowlist ─────────────────────────────────────────

describe('survey handler — allowlists', () => {
  it('accepts all valid q6 values', async () => {
    const allowed = ['0', '1-9', '10-19', '20-29', '30+'];
    for (const val of allowed) {
      stubAppsScript();
      const { res, getResult } = mockRes();
      const body = validSurvey();
      body.q6 = val;
      await handler(mockReq({ method: 'POST', body }), res);
      expect(getResult().statusCode).toBe(200);
    }
  });

  it('accepts n/a for q7', async () => {
    stubAppsScript();
    const { res, getResult } = mockRes();
    const body = validSurvey();
    body.q7 = 'n/a';
    await handler(mockReq({ method: 'POST', body }), res);
    expect(getResult().statusCode).toBe(200);
  });
});

// ── Happy path ─────────────────────────────────────────────────────

describe('survey handler — success', () => {
  it('forwards entry with source=survey', async () => {
    const fetchMock = stubAppsScript();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: validSurvey() }), res);
    expect(getResult().statusCode).toBe(200);
    // Verify fetch was called (Apps Script forward)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The body sent should contain source=survey
    const callBody = fetchMock.mock.calls[0][1].body;
    expect(callBody).toContain('source=survey');
    expect(callBody).toContain('q4=intros');
  });
});

// ── Origin check ───────────────────────────────────────────────────

describe('survey handler — origin check', () => {
  it('rejects disallowed origin', async () => {
    const { res, getResult } = mockRes();
    await handler(
      mockReq({
        method: 'POST',
        headers: { origin: 'https://evil.com', 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
        body: validSurvey(),
      }),
      res,
    );
    expect(getResult().statusCode).toBe(403);
  });
});
