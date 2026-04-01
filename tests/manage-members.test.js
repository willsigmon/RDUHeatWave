import { generateKeyPairSync } from 'crypto';
import { mockReq, mockRes, mockGlobalFetch, mockFetchResponse } from './helpers.js';

// Generate a real RSA key so crypto.createSign works in google-sheets.js
const { privateKey: testPrivateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

// Set env vars before loading the handler
const PASSCODE = 'test-secret-123';
process.env.ADMIN_PASSCODE = PASSCODE;
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@test.iam.gserviceaccount.com';
process.env.GOOGLE_PRIVATE_KEY = testPrivateKey;

const originalFetch = globalThis.fetch;

const handler = (await import('../api/manage-members.js')).default;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/**
 * Mock the Google Sheets API responses used by manage-members.
 * The handler calls sheets.readRange (GET), sheets.appendRows (POST),
 * sheets.writeRange (PUT), and sheets.clearRange (POST).
 * All go through getAccessToken first (POST to oauth2.googleapis.com).
 */
function stubSheetsApi(rows) {
  const sheetData = rows || {
    values: [
      ['Name', 'Profession', 'Company', 'Website'],
      ['Alice Smith', 'Engineer', 'Acme Inc', 'https://acme.com'],
      ['Bob Jones', 'Designer', 'Design Co', 'https://design.co'],
    ],
  };

  return mockGlobalFetch(async (url, opts) => {
    const urlStr = String(url);

    // Token exchange
    if (urlStr.includes('oauth2.googleapis.com/token')) {
      return mockFetchResponse({ access_token: 'fake-token', expires_in: 3600 });
    }

    // Sheets API: read range
    if (urlStr.includes('/values/') && (!opts || opts.method === 'GET' || !opts.method)) {
      return mockFetchResponse(sheetData);
    }

    // Spreadsheet metadata lookup
    if (urlStr.includes('/v4/spreadsheets/1WWS') && (!opts || opts.method === 'GET' || !opts.method) && !urlStr.includes('/values/')) {
      return mockFetchResponse({
        sheets: [
          { properties: { sheetId: 123456, title: 'Membership Directory' } },
        ],
      });
    }

    // Sheets API: append rows
    if (urlStr.includes(':append')) {
      return mockFetchResponse({ updates: { updatedRows: 1 } });
    }

    // Sheets API: batch update (delete row)
    if (urlStr.includes(':batchUpdate')) {
      return mockFetchResponse({ replies: [{}] });
    }

    // Sheets API: clear range
    if (urlStr.includes(':clear')) {
      return mockFetchResponse({ clearedRange: 'Sheet!A1:D10' });
    }

    // Sheets API: write range (PUT)
    if (opts && opts.method === 'PUT') {
      return mockFetchResponse({ updatedRows: 3 });
    }

    throw new Error(`Unmocked sheets URL: ${urlStr}`);
  });
}

// ── HTTP methods ───────────────────────────────────────────────────

describe('manage-members handler — HTTP methods', () => {
  it('returns 405 on GET', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    expect(getResult().statusCode).toBe(405);
  });

  it('returns empty 200 on HEAD', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'HEAD' }), res);
    expect(getResult().statusCode).toBe(200);
  });

  it('returns 204 on OPTIONS', async () => {
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'OPTIONS' }), res);
    expect(getResult().statusCode).toBe(204);
  });
});

// ── Auth ───────────────────────────────────────────────────────────

describe('manage-members handler — passcode auth', () => {
  it('rejects requests without passcode', async () => {
    stubSheetsApi();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: { action: 'list' } }), res);
    expect(getResult().statusCode).toBe(401);
  });

  it('rejects wrong passcode', async () => {
    stubSheetsApi();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: { action: 'list', passcode: 'wrong' } }), res);
    expect(getResult().statusCode).toBe(401);
  });

  it('accepts passcode in body', async () => {
    stubSheetsApi();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: { action: 'list', passcode: PASSCODE } }), res);
    expect(getResult().statusCode).toBe(200);
  });

  it('accepts passcode in x-admin-passcode header', async () => {
    stubSheetsApi();
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
        body: { action: 'list' },
      }),
      res,
    );
    expect(getResult().statusCode).toBe(200);
  });
});

// ── Service account not configured ─────────────────────────────────

describe('manage-members handler — no service account', () => {
  it('returns 503 when Google Sheets not configured', async () => {
    const savedEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const savedKey = process.env.GOOGLE_PRIVATE_KEY;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;

    // Need to re-import to pick up the env change since isConfigured checks env at call time
    vi.resetModules();
    const { default: freshHandler } = await import('../api/manage-members.js');

    const { res, getResult } = mockRes();
    await freshHandler(mockReq({ method: 'POST', body: { action: 'list', passcode: PASSCODE } }), res);
    expect(getResult().statusCode).toBe(503);

    // Restore env
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = savedEmail;
    process.env.GOOGLE_PRIVATE_KEY = savedKey;
  });
});

// ── CRUD — list ────────────────────────────────────────────────────

describe('manage-members handler — list', () => {
  it('returns current members', async () => {
    stubSheetsApi();
    const { res, getResult } = mockRes();
    await handler(mockReq({ method: 'POST', body: { action: 'list', passcode: PASSCODE } }), res);
    const result = getResult();
    expect(result.statusCode).toBe(200);
    expect(result.body.status).toBe('ok');
    expect(result.body.members).toHaveLength(2);
    expect(result.body.members[0].name).toBe('Alice Smith');
  });
});

// ── CRUD — add ─────────────────────────────────────────────────────

describe('manage-members handler — add', () => {
  it('adds a new member', async () => {
    const fetchMock = stubSheetsApi();
    const { res, getResult } = mockRes();
    await handler(
      mockReq({
        method: 'POST',
        body: { action: 'add', passcode: PASSCODE, name: 'New Person', title: 'Lawyer' },
      }),
      res,
    );
    const result = getResult();
    expect(result.statusCode).toBe(200);
    expect(result.body.message).toContain('New Person added');
    // Should have called appendRows (a POST to :append endpoint)
    const appendCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes(':append'));
    expect(appendCalls.length).toBe(1);
  });

  it('rejects duplicate name', async () => {
    stubSheetsApi();
    const { res, getResult } = mockRes();
    await handler(
      mockReq({
        method: 'POST',
        body: { action: 'add', passcode: PASSCODE, name: 'Alice Smith' },
      }),
      res,
    );
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/already on the roster/i);
  });

  it('rejects missing name', async () => {
    stubSheetsApi();
    const { res, getResult } = mockRes();
    await handler(
      mockReq({
        method: 'POST',
        body: { action: 'add', passcode: PASSCODE, name: '' },
      }),
      res,
    );
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/name is required/i);
  });
});

// ── CRUD — remove ──────────────────────────────────────────────────

describe('manage-members handler — remove', () => {
  it('removes an existing member', async () => {
    const fetchMock = stubSheetsApi();
    const { res, getResult } = mockRes();
    await handler(
      mockReq({
        method: 'POST',
        body: { action: 'remove', passcode: PASSCODE, name: 'Alice Smith' },
      }),
      res,
    );
    expect(getResult().statusCode).toBe(200);
    expect(getResult().body.message).toContain('Alice Smith removed');
    const deleteCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes(':batchUpdate'));
    expect(deleteCalls.length).toBe(1);
  });

  it('returns error for non-existent member', async () => {
    stubSheetsApi();
    const { res, getResult } = mockRes();
    await handler(
      mockReq({
        method: 'POST',
        body: { action: 'remove', passcode: PASSCODE, name: 'Nobody' },
      }),
      res,
    );
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/not found/i);
  });
});

// ── CRUD — update ──────────────────────────────────────────────────

describe('manage-members handler — update', () => {
  it('updates an existing member', async () => {
    const fetchMock = stubSheetsApi();
    const { res, getResult } = mockRes();
    await handler(
      mockReq({
        method: 'POST',
        body: { action: 'update', passcode: PASSCODE, name: 'Alice Smith', title: 'CEO' },
      }),
      res,
    );
    expect(getResult().statusCode).toBe(200);
    expect(getResult().body.message).toContain('Alice Smith updated');
    // Should call writeRange (PUT) for a single row, not rewrite the full roster
    const putCalls = fetchMock.mock.calls.filter(([, opts]) => opts && opts.method === 'PUT');
    expect(putCalls.length).toBe(1);
    expect(String(putCalls[0][0])).toContain('Membership%20Directory!A2%3AD2');
  });

  it('returns error for non-existent member', async () => {
    stubSheetsApi();
    const { res, getResult } = mockRes();
    await handler(
      mockReq({
        method: 'POST',
        body: { action: 'update', passcode: PASSCODE, name: 'Nobody', title: 'CEO' },
      }),
      res,
    );
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/not found/i);
  });
});

// ── Unknown action ─────────────────────────────────────────────────

describe('manage-members handler — unknown action', () => {
  it('rejects unknown action', async () => {
    stubSheetsApi();
    const { res, getResult } = mockRes();
    await handler(
      mockReq({
        method: 'POST',
        body: { action: 'destroy', passcode: PASSCODE },
      }),
      res,
    );
    expect(getResult().statusCode).toBe(400);
    expect(getResult().body.message).toMatch(/unknown action/i);
  });
});
