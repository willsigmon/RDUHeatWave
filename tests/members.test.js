import { mockReq, mockRes, mockGlobalFetch, mockFetchResponse, gvizResponse } from './helpers.js';

const originalFetch = globalThis.fetch;

const handler = (await import('../api/members.js')).default;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubMemberSheet() {
  const body = gvizResponse(
    ['Name', 'Profession', 'Company', 'Website'],
    [
      ['Carter Helms', 'Insurance', 'Highstreet', 'https://carterhelms.com'],
      ['Alice Smith', 'Engineer', 'Acme Inc', 'acme.com'],
    ],
  );
  return mockGlobalFetch(async () => mockFetchResponse(body));
}

// ── HTTP methods ───────────────────────────────────────────────────

describe('members handler — HTTP methods', () => {
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
});

// ── Sheet data ─────────────────────────────────────────────────────

describe('members handler — sheet data', () => {
  it('returns members from sheet with source: sheet', async () => {
    stubMemberSheet();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    const result = getResult();
    expect(result.statusCode).toBe(200);
    expect(result.body.source).toBe('sheet');
    expect(result.body.members).toHaveLength(2);
  });

  it('sets leader flag based on LEADER_OVERRIDES', async () => {
    stubMemberSheet();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    const members = getResult().body.members;
    const carter = members.find((m) => m.name === 'Carter Helms');
    const alice = members.find((m) => m.name === 'Alice Smith');
    expect(carter.leader).toBe(true);
    expect(alice.leader).toBe(false);
  });

  it('normalizes website URLs (adds https://)', async () => {
    stubMemberSheet();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    const alice = getResult().body.members.find((m) => m.name === 'Alice Smith');
    expect(alice.website).toBe('https://acme.com/');
  });
});

// ── Fallback behavior ──────────────────────────────────────────────

describe('members handler — fallback', () => {
  it('returns DEFAULT_MEMBERS when sheet fetch fails', async () => {
    mockGlobalFetch(async () => { throw new Error('network down'); });
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    const result = getResult();
    expect(result.statusCode).toBe(200);
    expect(result.body.source).toBe('fallback');
    expect(result.body.members.length).toBeGreaterThan(0);
    expect(result.body.members[0].name).toBe('Carter Helms');
  });

  it('falls back when sheet returns empty data', async () => {
    const body = gvizResponse([], []);
    mockGlobalFetch(async () => mockFetchResponse(body));
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    expect(getResult().body.source).toBe('fallback');
  });
});

// ── Caching ────────────────────────────────────────────────────────

describe('members handler — caching', () => {
  it('returns CDN cache headers', async () => {
    stubMemberSheet();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    expect(getResult().headers['cache-control']).toContain('s-maxage=300');
  });
});
