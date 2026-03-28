import { mockReq, mockRes, mockGlobalFetch, mockFetchResponse, gvizResponse } from './helpers.js';

const originalFetch = globalThis.fetch;

const handler = (await import('../api/stats.js')).default;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubAllSheets() {
  const now = new Date();
  const recentDate = `${now.getMonth() + 1}/1/${now.getFullYear()}`;

  // Sheet names are URL-encoded with encodeURIComponent (spaces → %20)
  const sheets = [
    { pattern: 'Guest%20Incentive%20Report', body: gvizResponse(
      ['Member', 'Weekly Total Points', 'Total'],
      [['Alice', '10', '5'], ['Bob', '8', '3'], ['', '18', '8']],
    )},
    { pattern: 'BizChats%20Report', body: gvizResponse(
      ['Member', 'Weekly Total'],
      [['Alice', '5'], ['Bob', '3'], ['', '8']],
    )},
    { pattern: 'Referral%20Pipeline', body: gvizResponse(
      ['From', 'To', 'Date'],
      [['Alice', 'Bob', recentDate], ['Bob', 'Alice', recentDate], ['Old', 'Ref', '1/1/2020']],
    )},
    { pattern: 'Revenue%20Report', body: gvizResponse(
      ['Member', 'Weekly Total Given', 'Rcvd'],
      [['Alice', '$100', '$200'], ['Bob', '$150', '$300'], ['', '$250', '$500']],
    )},
  ];

  return mockGlobalFetch(async (url) => {
    const urlStr = String(url);
    for (const sheet of sheets) {
      if (urlStr.includes(sheet.pattern)) return mockFetchResponse(sheet.body);
    }
    throw new Error(`Unmocked sheet URL: ${urlStr}`);
  });
}

// ── HTTP methods ───────────────────────────────────────────────────

describe('stats handler — HTTP methods', () => {
  it('returns 405 on POST', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST' }), res);
    expect(getResult().statusCode).toBe(405);
  });

  it('returns empty 200 on HEAD', async () => {
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
});

// ── Response shape ─────────────────────────────────────────────────

describe('stats handler — response shape', () => {
  it('returns stats object with expected keys', async () => {
    stubAllSheets();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    const result = getResult();
    expect(result.statusCode).toBe(200);
    expect(result.body.status).toBe('ok');
    const { stats } = result.body;
    expect(stats).toHaveProperty('guestsHosted');
    expect(stats).toHaveProperty('bizChats');
    expect(stats).toHaveProperty('referrals');
    expect(stats).toHaveProperty('revenue');
    expect(stats).toHaveProperty('guestIncentives');
  });

  it('calculates correct values', async () => {
    stubAllSheets();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    const { stats } = getResult().body;
    expect(stats.guestsHosted).toBe(18);
    expect(stats.bizChats).toBe(8);
    expect(stats.referrals).toBe(2); // only recent dates
    expect(stats.revenue).toBe(500);
    expect(stats.guestIncentives).toBe(8);
  });
});

// ── Caching ────────────────────────────────────────────────────────

describe('stats handler — caching', () => {
  it('returns CDN cache headers on success', async () => {
    stubAllSheets();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    expect(getResult().headers['cache-control']).toContain('s-maxage=300');
  });

  it('returns CDN cache headers even on error', async () => {
    mockGlobalFetch(async () => mockFetchResponse('', { status: 500, ok: false }));
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    expect(getResult().statusCode).toBe(500);
    expect(getResult().headers['cache-control']).toContain('s-maxage=300');
  });
});

// ── Error handling ─────────────────────────────────────────────────

describe('stats handler — errors', () => {
  it('returns 500 with error message when sheet fetch fails', async () => {
    mockGlobalFetch(async () => { throw new Error('network down'); });
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    expect(getResult().statusCode).toBe(500);
    expect(getResult().body.message).toBe('Stats unavailable');
  });
});
