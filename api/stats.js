'use strict';

var shared = require('./_lib/shared');

var SHEET_ID = '1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA';
var CACHE_HEADER = 'public, max-age=0, s-maxage=300, stale-while-revalidate=600';

function getTotalFromColumn(report, columnLabel) {
  var colIndex = report.cols.findIndex(function (label) {
    return label.toLowerCase() === columnLabel.toLowerCase();
  });
  if (colIndex < 0) return 0;

  var totalsRow = report.rows
    .filter(function (row) {
      return !shared.normalizeText(row[0]) && shared.normalizeText(row[colIndex]);
    })
    .slice(-1)[0] || [];

  return shared.parseNumber(totalsRow[colIndex]);
}

function getPipelineReferrals(report) {
  var totalReferrals = 0;
  var now = new Date();
  var twelveMonthsAgo = Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate());

  report.rows.forEach(function (row) {
    var date = shared.parseDate(row[2]);
    if (!date || date.getTime() < twelveMonthsAgo) return;
    totalReferrals += 1;
  });

  return totalReferrals;
}

function getRevenueFromReport(report) {
  var rcvdIndex = report.cols.findIndex(function (label) {
    return /^rcvd$/i.test(shared.normalizeText(label));
  });

  if (rcvdIndex < 0) {
    for (var i = report.cols.length - 1; i >= 0; i--) {
      if (/^rcvd$/i.test(shared.normalizeText(report.cols[i]))) {
        rcvdIndex = i;
        break;
      }
    }
  }

  var givenIndex = report.cols.findIndex(function (label) {
    return /weekly total given/i.test(shared.normalizeText(label));
  });

  var totalsRow = report.rows
    .filter(function (row) { return !shared.normalizeText(row[0]); })
    .slice(-1)[0] || [];

  var targetIndex = rcvdIndex >= 0 ? rcvdIndex : givenIndex;

  if (givenIndex >= 0) {
    for (var j = givenIndex + 1; j < report.cols.length; j++) {
      if (/^rcvd$/i.test(shared.normalizeText(report.cols[j]))) {
        targetIndex = j;
        break;
      }
    }
  }

  return targetIndex >= 0 ? shared.parseNumber(totalsRow[targetIndex]) : 0;
}

async function buildStats() {
  var sheets = await Promise.all([
    shared.fetchSheet(SHEET_ID, 'Guest Incentive Report'),
    shared.fetchSheet(SHEET_ID, 'BizChats Report'),
    shared.fetchSheet(SHEET_ID, 'Referral Pipeline'),
    shared.fetchSheet(SHEET_ID, 'Revenue Report')
  ]);

  return {
    guestsHosted: getTotalFromColumn(sheets[0], 'weekly total points'),
    bizChats: getTotalFromColumn(sheets[1], 'weekly total'),
    referrals: getPipelineReferrals(sheets[2]),
    revenue: getRevenueFromReport(sheets[3]),
    guestIncentives: getTotalFromColumn(sheets[0], 'total')
  };
}

module.exports = async function handler(req, res) {
  if (req.method === 'HEAD') return shared.handleHead(res, CACHE_HEADER);
  if (req.method === 'OPTIONS') return shared.handleOptions(res, ['GET', 'HEAD', 'OPTIONS'], CACHE_HEADER);
  if (req.method !== 'GET') return shared.handleMethodNotAllowed(req, res, ['GET', 'HEAD', 'OPTIONS']);

  try {
    var stats = await buildStats();
    return shared.sendCachedJson(res, 200, { status: 'ok', stats: stats });
  } catch (error) {
    console.error('[api/stats]', error);
    return shared.sendCachedJson(res, 500, { status: 'error', message: 'Stats unavailable' });
  }
};
