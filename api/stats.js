'use strict';

var shared = require('./_lib/shared');

var SHEET_ID = '1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA';
var CACHE_HEADER = 'public, max-age=0, s-maxage=300, stale-while-revalidate=600';
var lastKnownGoodStats = null;
var lastKnownGoodAt = null;

var STAT_DEFINITIONS = [
  {
    key: 'guestsHosted',
    sheetName: 'Guest Incentive Report',
    compute: function (report) { return getTotalFromColumn(report, 'weekly total points'); }
  },
  {
    key: 'bizChats',
    sheetName: 'BizChats Report',
    compute: function (report) { return getTotalFromColumn(report, 'weekly total'); }
  },
  {
    key: 'referrals',
    sheetName: 'Referral Pipeline',
    compute: function (report) { return getPipelineReferrals(report); }
  },
  {
    key: 'revenue',
    sheetName: 'Revenue Report',
    compute: function (report) { return getRevenueFromReport(report); }
  },
  {
    key: 'gratitudeIncentives',
    sheetName: 'GIs Report',
    compute: function (report) { return getGiTotalFromReport(report); }
  }
];

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
  var nowMs = now.getTime();
  var twelveMonthsAgo = Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate());

  report.rows.forEach(function (row) {
    var date = shared.parseDate(row[2]);
    if (!date) return;
    var time = date.getTime();
    if (time < twelveMonthsAgo || time > nowMs) return;
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

function getGiTotalFromReport(report) {
  var totalIndex = -1;
  var weeklyGivenIndex = report.cols.findIndex(function (label) {
    return /weekly total given/i.test(shared.normalizeText(label));
  });

  if (weeklyGivenIndex >= 0) {
    for (var i = weeklyGivenIndex + 1; i < report.cols.length; i++) {
      if (/^rcvd$/i.test(shared.normalizeText(report.cols[i]))) {
        totalIndex = i;
      }
    }
  }

  if (totalIndex < 0) {
    for (var j = report.cols.length - 1; j >= 0; j--) {
      if (/^rcvd$/i.test(shared.normalizeText(report.cols[j]))) {
        totalIndex = j;
        break;
      }
    }
  }

  var totalsRow = report.rows
    .filter(function (row) {
      return !shared.normalizeText(row[0]) && totalIndex >= 0 && shared.normalizeText(row[totalIndex]);
    })
    .slice(-1)[0] || [];

  return totalIndex >= 0 ? shared.parseNumber(totalsRow[totalIndex]) : 0;
}

async function buildStats() {
  var uniqueSheetNames = Array.from(new Set(STAT_DEFINITIONS.map(function (item) { return item.sheetName; })));
  var sheetResults = await Promise.allSettled(uniqueSheetNames.map(function (sheetName) {
    return shared.fetchSheet(SHEET_ID, sheetName);
  }));

  var reportsBySheet = {};
  var warnings = [];
  var stats = {};
  var fulfilledSheetCount = 0;

  sheetResults.forEach(function (result, index) {
    var sheetName = uniqueSheetNames[index];
    if (result.status === 'fulfilled') {
      reportsBySheet[sheetName] = result.value;
      fulfilledSheetCount += 1;
      return;
    }

    warnings.push(sheetName + ': ' + ((result.reason && result.reason.message) || 'Unavailable'));
  });

  STAT_DEFINITIONS.forEach(function (definition) {
    var report = reportsBySheet[definition.sheetName];
    if (!report) return;

    try {
      stats[definition.key] = definition.compute(report);
    } catch (error) {
      warnings.push(definition.key + ': ' + ((error && error.message) || 'Unavailable'));
    }
  });

  if (lastKnownGoodStats) {
    STAT_DEFINITIONS.forEach(function (definition) {
      if (stats[definition.key] == null && lastKnownGoodStats[definition.key] != null) {
        stats[definition.key] = lastKnownGoodStats[definition.key];
      }
    });
    if (fulfilledSheetCount === 0) {
      warnings.unshift('Serving last known good stats');
    }
  }

  var hasAnyStats = STAT_DEFINITIONS.some(function (definition) {
    return stats[definition.key] != null;
  });

  if (!hasAnyStats) {
    throw new Error('Stats unavailable');
  }

  var isFresh = warnings.length === 0;
  if (isFresh) {
    lastKnownGoodStats = Object.assign({}, stats);
    lastKnownGoodAt = new Date().toISOString();
  }

  return {
    stats: stats,
    stale: !isFresh,
    updatedAt: isFresh ? lastKnownGoodAt : (lastKnownGoodAt || null),
    warnings: warnings
  };
}

module.exports = async function handler(req, res) {
  if (req.method === 'HEAD') return shared.handleHead(res, CACHE_HEADER);
  if (req.method === 'OPTIONS') return shared.handleOptions(res, ['GET', 'HEAD', 'OPTIONS'], CACHE_HEADER);
  if (req.method !== 'GET') return shared.handleMethodNotAllowed(req, res, ['GET', 'HEAD', 'OPTIONS']);

  try {
    var payload = await buildStats();
    return shared.sendCachedJson(res, 200, Object.assign({ status: 'ok' }, payload));
  } catch (error) {
    console.error('[api/stats]', error);
    if (lastKnownGoodStats) {
      return shared.sendCachedJson(res, 200, {
        status: 'ok',
        stats: Object.assign({}, lastKnownGoodStats),
        stale: true,
        updatedAt: lastKnownGoodAt,
        warnings: ['Serving last known good stats']
      });
    }
    return shared.sendCachedJson(res, 500, { status: 'error', message: 'Stats unavailable' });
  }
};

module.exports._resetForTests = function resetStatsCache() {
  lastKnownGoodStats = null;
  lastKnownGoodAt = null;
};
