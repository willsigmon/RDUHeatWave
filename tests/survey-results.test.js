import { mockReq, mockRes, mockGlobalFetch, mockFetchResponse, gvizResponse } from './helpers.js';

const PASSCODE = 'survey-secret-456';
process.env.ADMIN_PASSCODE = PASSCODE;

const originalFetch = globalThis.fetch;

const handler = (await import('../api/survey-results.js')).default;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubSurveySheet() {
  const body = gvizResponse(
    ['Timestamp', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'],
    [
      ['Timestamp', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'], // header row — skipped
      ['2026-03-15 10:00', '5', '3', '4', 'intros, bizchat', '4', '10-19', '5', 'referrals', '4', 'Great!'],
      ['2026-03-15 11:00', '4', '2', '3', 'mentor', '5', '0', 'n/a', 'relationships', '3', ''],
    ],
  );
  return mockGlobalFetch(async () => mockFetchResponse(body));
}

// ── HTTP methods ───────────────────────────────────────────────────

describe('survey-results handler — HTTP methods', () => {
  it('returns 405 on GET', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    expect(getResult().statusCode).toBe(405);
  });

  it('returns 200 on HEAD', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'HEAD' }), res);
    expect(getResult().statusCode).toBe(200);
  });
});

// ── Passcode gating ────────────────────────────────────────────────

describe('survey-results handler — passcode gating', () => {
  it('rejects requests without passcode', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: {} }), res);
    expect(getResult().statusCode).toBe(401);
  });

  it('rejects wrong passcode', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: { passcode: 'wrong' } }), res);
    expect(getResult().statusCode).toBe(401);
  });

  it('accepts correct passcode in body', async () => {
    stubSurveySheet();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: { passcode: PASSCODE } }), res);
    expect(getResult().statusCode).toBe(200);
  });

  it('accepts correct passcode in header', async () => {
    stubSurveySheet();
    const { res, getResult } = mockRes();
    await handler(
      mockReq({
        method: 'POST',
        headers: {
          origin: 'https://rduheatwave.team',
          'content-type': 'application/json',
          'x-forwarded-for': '1.2.3.4',
          'x-admin-passcode': PASSCODE,
        },
        body: {},
      }),
      res,
    );
    expect(getResult().statusCode).toBe(200);
  });
});

// ── Aggregation ────────────────────────────────────────────────────

describe('survey-results handler — aggregation', () => {
  it('returns aggregated results with correct counts', async () => {
    stubSurveySheet();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: { passcode: PASSCODE } }), res);
    const { results } = getResult().body;

    expect(results.totalResponses).toBe(2);
    expect(results.q1).toEqual({ '5': 1, '4': 1 });
    expect(results.q4).toEqual({ intros: 1, bizchat: 1, mentor: 1 });
    expect(results.q10).toEqual(['Great!']);
  });
});

// ── Error handling ─────────────────────────────────────────────────

describe('survey-results handler — errors', () => {
  it('returns 500 when sheet fetch fails', async () => {
    mockGlobalFetch(async () => { throw new Error('network down'); });
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: { passcode: PASSCODE } }), res);
    expect(getResult().statusCode).toBe(500);
    expect(getResult().body.message).toMatch(/unable to load/i);
  });
});
