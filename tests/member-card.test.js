import { mockReq, mockRes, mockGlobalFetch, mockFetchResponse, gvizResponse } from './helpers.js';

const originalFetch = globalThis.fetch;

const handler = (await import('../api/member-card.js')).default;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubMemberSheet() {
  return mockGlobalFetch(async () => mockFetchResponse(gvizResponse(
    ['Name', 'Profession', 'Company', 'Website'],
    [
      ['Carter Helms', 'Team Chair', 'Highstreet Ins & Financial Svcs', 'https://carterhelms.com'],
      ['Alice Smith', 'Engineer', 'Acme Inc', 'https://acme.com']
    ]
  )));
}

describe('member-card handler', () => {
  it('returns html for a known member slug', async () => {
    stubMemberSheet();
    const { res, getResult } = mockRes();

    await handler(mockReq({ method: 'GET', query: { name: 'carter-helms' } }), res);

    const result = getResult();
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toContain('text/html');
    expect(result.rawBody).toContain('Carter Helms');
    expect(result.rawBody).toContain('/member-photos/carter-helms.jpg');
  });

  it('falls back to checked-in default members when the sheet is unavailable', async () => {
    mockGlobalFetch(async () => { throw new Error('network down'); });
    const { res, getResult } = mockRes();

    await handler(mockReq({ method: 'GET', query: { name: 'will-sigmon' } }), res);

    const result = getResult();
    expect(result.statusCode).toBe(200);
    expect(result.rawBody).toContain('Will Sigmon');
    expect(result.rawBody).toContain('/member-photos/will-sigmon.jpg');
  });

  it('returns 404 for an unknown slug', async () => {
    stubMemberSheet();
    const { res, getResult } = mockRes();

    await handler(mockReq({ method: 'GET', query: { name: 'missing-person' } }), res);

    const result = getResult();
    expect(result.statusCode).toBe(404);
    expect(result.body.error).toMatch(/Member not found/i);
  });

  it('returns 400 when name is missing', async () => {
    const { res, getResult } = mockRes();

    await handler(mockReq({ method: 'GET', query: {} }), res);

    const result = getResult();
    expect(result.statusCode).toBe(400);
    expect(result.body.error).toMatch(/name parameter required/i);
  });
});
