import { mockReq, mockRes, mockGlobalFetch, mockFetchResponse } from './helpers.js';

const originalFetch = globalThis.fetch;

const handler = (await import('../api/upcoming-events.js')).default;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('upcoming-events handler — HTTP methods', () => {
  it('returns 405 on POST', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST' }), res);
    expect(getResult().statusCode).toBe(405);
  });

  it('returns 200 on HEAD', async () => {
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

describe('upcoming-events handler — Apps Script proxy', () => {
  it('returns normalized events from Apps Script when available', async () => {
    mockGlobalFetch(async () => mockFetchResponse({
      status: 'ok',
      source: 'calendar',
      events: [
        {
          title: 'RDU Heatwave Meeting',
          start: '2026-04-02T19:45:00.000Z',
          end: '2026-04-02T21:00:00.000Z',
          location: 'Clouds Brewing Taproom',
          description: 'Weekly networking meeting',
        }
      ]
    }));

    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET', query: { limit: '2' } }), res);
    const result = getResult();

    expect(result.statusCode).toBe(200);
    expect(result.body.status).toBe('ok');
    expect(result.body.source).toBe('apps-script');
    expect(result.body.events).toHaveLength(1);
    expect(result.body.events[0].title).toBe('RDU Heatwave Meeting');
  });

  it('falls back to generated weekly events when Apps Script fails', async () => {
    mockGlobalFetch(async () => {
      throw new Error('network down');
    });

    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET', query: { limit: '3' } }), res);
    const result = getResult();

    expect(result.statusCode).toBe(200);
    expect(result.body.status).toBe('ok');
    expect(result.body.source).toBe('fallback');
    expect(result.body.events).toHaveLength(3);
    expect(result.body.events[0].title).toBe('RDU Heatwave Meeting');
  });

  it('falls back when Apps Script returns invalid JSON', async () => {
    mockGlobalFetch(async () => mockFetchResponse('RDU Heatwave form endpoint is live.'));

    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    const result = getResult();

    expect(result.statusCode).toBe(200);
    expect(result.body.source).toBe('fallback');
    expect(result.body.events.length).toBeGreaterThan(0);
  });
});
