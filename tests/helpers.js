/**
 * Create a mock Vercel request object.
 * @param {object} overrides
 * @returns {object} mock req
 */
export function mockReq(overrides) {
  const defaults = {
    method: 'GET',
    headers: {
      origin: 'https://rduheatwave.team',
      'content-type': 'application/json',
      'x-forwarded-for': `test-${Math.random().toString(36).slice(2)}`,
    },
    body: undefined,
  };
  return { ...defaults, ...overrides };
}

/**
 * Create a mock Vercel response object that captures output.
 * @returns {{ res: object, getResult: () => object }}
 */
export function mockRes() {
  const _headers = {};
  let _statusCode = 200;
  let _body = '';
  let _ended = false;

  const res = {
    get statusCode() { return _statusCode; },
    set statusCode(code) { _statusCode = code; },
    setHeader(key, value) { _headers[key.toLowerCase()] = value; },
    getHeader(key) { return _headers[key.toLowerCase()]; },
    end(chunk) {
      if (chunk) _body = chunk;
      _ended = true;
    },
  };

  function getResult() {
    let parsed = null;
    try { parsed = JSON.parse(_body); } catch { /* raw body */ }
    return {
      statusCode: _statusCode,
      headers: { ..._headers },
      body: parsed,
      rawBody: _body,
      ended: _ended,
    };
  }

  return { res, getResult };
}

/**
 * Build a gviz JSONP response string.
 */
export function gvizResponse(cols, rows) {
  const table = {
    cols: cols.map((label) => ({ label })),
    rows: rows.map((cells) => ({
      c: cells.map((v) => (v == null ? null : { v })),
    })),
  };
  return '/*O_o*/\ngoogle.visualization.Query.setResponse(' + JSON.stringify({ table }) + ');';
}

/**
 * Create a mock fetch Response.
 */
export function mockFetchResponse(body, options = {}) {
  const { status = 200, ok = true, headers = {} } = options;
  return {
    ok,
    status,
    headers: new Headers(headers),
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
  };
}

/**
 * Mock globalThis.fetch with a handler function.
 * Returns the mock function for assertions.
 */
export function mockGlobalFetch(handler) {
  const mockFn = vi.fn(handler);
  globalThis.fetch = mockFn;
  return mockFn;
}

/**
 * Create a fetch mock that routes by URL pattern.
 * @param {Array<{ pattern: RegExp|string, response: () => object }>} routes
 */
export function mockFetchRoutes(routes) {
  return mockGlobalFetch(async (url, _opts) => {
    const urlStr = String(url);
    for (const route of routes) {
      const matches = route.pattern instanceof RegExp
        ? route.pattern.test(urlStr)
        : urlStr.includes(route.pattern);
      if (matches) return route.response();
    }
    throw new Error(`Unmocked fetch URL: ${urlStr}`);
  });
}
