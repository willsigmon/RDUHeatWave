import { generateKeyPairSync } from 'crypto';
import { mockReq, mockRes, mockGlobalFetch, mockFetchResponse, gvizResponse } from './helpers.js';

const originalFetch = globalThis.fetch;
const PASSCODE = 'admin-test-passcode';
const originalServiceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const originalPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
const { privateKey: testPrivateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

process.env.ADMIN_PASSCODE = PASSCODE;

let handler;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-06T16:00:00-04:00'));
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@test.iam.gserviceaccount.com';
  process.env.GOOGLE_PRIVATE_KEY = testPrivateKey;
  vi.resetModules();
  handler = (await import('../api/admin-report.js')).default;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  if (originalServiceEmail === undefined) {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  } else {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = originalServiceEmail;
  }
  if (originalPrivateKey === undefined) {
    delete process.env.GOOGLE_PRIVATE_KEY;
  } else {
    process.env.GOOGLE_PRIVATE_KEY = originalPrivateKey;
  }
});

function stubAdminSheets() {
  return mockGlobalFetch(async (url, opts) => {
    const urlStr = String(url);

    if (urlStr.includes('oauth2.googleapis.com/token')) {
      return mockFetchResponse({ access_token: 'fake-token', expires_in: 3600 });
    }

    if (urlStr.includes('sheets.googleapis.com') && urlStr.includes('/values/')) {
      return mockFetchResponse({
        values: [
          ['Meeting', 'First Name', 'Last Name'],
          ...Array.from({ length: 12 }, (_, index) => ['4/23/2026', 'Apr23-' + index, 'Guest']),
          ...Array.from({ length: 10 }, (_, index) => ['4/30/2026', 'Apr30-' + index, 'Guest']),
        ],
      });
    }

    if (urlStr.includes('Guest%20Incentive%20Report')) {
      return mockFetchResponse(gvizResponse(
        ['Rolling 12 Mo', 'Carter Points', 'Weekly Total Points', 'Total'],
        [
          ['4-23-26', '3', '11', '11'],
          ['4-30-26', '1', '5', '5'],
          ['5-7-26', '0', '0', '0'],
          ['', '53', '160', '160'],
        ],
      ));
    }

    if (urlStr.includes('Attendance%20Report')) {
      return mockFetchResponse(gvizResponse(
        ['Member', 'Unexcused', 'Excused', 'Sub'],
        [['', '0', '0', '0']],
      ));
    }

    if (urlStr.includes('BizChats%20Report')) {
      return mockFetchResponse(gvizResponse(
        ['Rolling 12 Mo', 'Will', 'Weekly Total'],
        [
          ['4-23-26', '46', '46'],
          ['4-30-26', '40', '40'],
          ['5-7-26', '0', '0'],
          ['', '119', '430'],
        ],
      ));
    }

    if (urlStr.includes('Referral%20Pipeline')) {
      return mockFetchResponse(gvizResponse(
        ['From', 'To', 'Date', 'Prospect', 'Disposition', 'Revenue'],
        [
          ['A', 'B', '4-23-26', 'One', 'Closed Business', '$100'],
          ['A', 'B', '4-23-26', 'Two', '', ''],
        ],
      ));
    }

    if (urlStr.includes('Revenue%20Report')) {
      return mockFetchResponse(gvizResponse(
        ['Date', 'Weekly Total Given', 'Rcvd'],
        [
          ['4-23-26', '$0', '$30,376'],
          ['4-30-26', '$0', '$0'],
        ],
      ));
    }

    throw new Error(`Unmocked admin sheet URL: ${urlStr} ${opts && opts.method ? opts.method : ''}`);
  });
}

describe('admin-report handler', () => {
  it('uses the latest completed activity week for the snapshot', async () => {
    stubAdminSheets();
    const { res, getResult } = mockRes();

    await handler(
      mockReq({
        method: 'POST',
        body: { passcode: PASSCODE },
      }),
      res,
    );

    const result = getResult();
    expect(result.statusCode).toBe(200);
    expect(result.body.report.lastWeek).toEqual({
      label: 'Apr 30',
      guests: 10,
      bizChats: 40,
      referrals: 0,
      closedRevenue: '$0',
    });
  });
});
