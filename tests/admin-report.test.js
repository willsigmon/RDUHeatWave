import { mockReq, mockRes, mockGlobalFetch, mockFetchResponse, gvizResponse } from './helpers.js';

const originalFetch = globalThis.fetch;
const PASSCODE = 'admin-test-passcode';

process.env.ADMIN_PASSCODE = PASSCODE;

let handler;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-06T16:00:00-04:00'));
  vi.resetModules();
  handler = (await import('../api/admin-report.js')).default;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
});

function stubAdminSheets() {
  return mockGlobalFetch(async (url) => {
    const urlStr = String(url);

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

    throw new Error(`Unmocked admin sheet URL: ${urlStr}`);
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
      guests: 5,
      bizChats: 40,
      referrals: 0,
      closedRevenue: '$0',
    });
  });
});
