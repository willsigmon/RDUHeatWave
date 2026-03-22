'use strict';

var shared = require('./_lib/shared');

var ADMIN_PASSCODE = process.env.ADMIN_PASSCODE;
var SHEET_ID = '1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA';
var REQUEST_TIMEOUT_MS = 12 * 1000;

if (!ADMIN_PASSCODE) {
  console.warn('[api/admin-report] ADMIN_PASSCODE env var is not set — endpoint will reject all requests');
}

function getPasscode(req, body) {
  return shared.normalizeText(
    (req.headers && (req.headers['x-admin-passcode'] || req.headers['X-Admin-Passcode'])) ||
    (body && body.passcode) ||
    ''
  );
}

function fetchReportSheet(sheetName) {
  return shared.fetchSheet(SHEET_ID, sheetName, REQUEST_TIMEOUT_MS);
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC'
  }).format(date);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(amount || 0);
}

function compareRowsByDateAsc(a, b) {
  return a.date.getTime() - b.date.getTime();
}

function getCompletedRows(rows) {
  var now = new Date();
  var currentUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return rows.filter(function (row) {
    return row.date && row.date.getTime() <= currentUtc;
  });
}

function getLatestCompletedRow(rows) {
  var completed = getCompletedRows(rows);
  return completed.length ? completed[completed.length - 1] : null;
}

function parseGuestReport(report) {
  var weeklyTotalIndex = report.cols.findIndex(function (label) {
    return label.toLowerCase() === 'weekly total points';
  });
  var grandTotalIndex = report.cols.findIndex(function (label) {
    return label.toLowerCase() === 'total';
  });

  var memberColumns = report.cols
    .map(function (label, index) { return { label: label, index: index }; })
    .filter(function (entry) {
      return /points$/i.test(entry.label) && !/^weekly total points$/i.test(entry.label);
    });

  var weeklyRows = report.rows
    .map(function (row) {
      var date = shared.parseDate(row[0]);
      return {
        date: date,
        dateLabel: date ? formatShortDate(date) : '',
        guests: weeklyTotalIndex >= 0 ? shared.parseNumber(row[weeklyTotalIndex]) : 0,
        totalWithBonus: grandTotalIndex >= 0 ? shared.parseNumber(row[grandTotalIndex]) : 0
      };
    })
    .filter(function (row) { return !!row.date; })
    .sort(compareRowsByDateAsc);

  var totalsRow = report.rows
    .filter(function (row) {
      return !shared.normalizeText(row[0]) && (weeklyTotalIndex >= 0 ? shared.normalizeText(row[weeklyTotalIndex]) : '');
    })
    .slice(-1)[0] || [];

  return {
    currentWeek: getLatestCompletedRow(weeklyRows),
    recentWeeks: getCompletedRows(weeklyRows).slice(-6),
    totalGuests: weeklyTotalIndex >= 0 ? shared.parseNumber(totalsRow[weeklyTotalIndex]) : 0,
    totalGuestPointsWithBonus: grandTotalIndex >= 0 ? shared.parseNumber(totalsRow[grandTotalIndex]) : 0,
    leaderboard: memberColumns.map(function (entry) {
      return {
        name: shared.normalizeText(entry.label.replace(/\s*Points$/i, '')),
        value: shared.parseNumber(totalsRow[entry.index])
      };
    }).filter(function (entry) {
      return entry.name && entry.value;
    }).sort(function (a, b) { return b.value - a.value; })
  };
}

function parseBizChatsReport(report) {
  var weeklyTotalIndex = report.cols.findIndex(function (label) {
    return label.toLowerCase() === 'weekly total';
  });

  var memberColumns = report.cols
    .map(function (label, index) { return { label: label, index: index }; })
    .filter(function (entry) {
      return entry.index > 0 && entry.index < weeklyTotalIndex && entry.label;
    });

  var weeklyRows = report.rows
    .map(function (row) {
      var date = shared.parseDate(row[0]);
      return {
        date: date,
        dateLabel: date ? formatShortDate(date) : '',
        total: weeklyTotalIndex >= 0 ? shared.parseNumber(row[weeklyTotalIndex]) : 0
      };
    })
    .filter(function (row) { return !!row.date; })
    .sort(compareRowsByDateAsc);

  var totalsRow = report.rows
    .filter(function (row) {
      return !shared.normalizeText(row[0]) && (weeklyTotalIndex >= 0 ? shared.normalizeText(row[weeklyTotalIndex]) : '');
    })
    .slice(-1)[0] || [];

  return {
    currentWeek: getLatestCompletedRow(weeklyRows),
    recentWeeks: getCompletedRows(weeklyRows).slice(-6),
    totalBizChats: weeklyTotalIndex >= 0 ? shared.parseNumber(totalsRow[weeklyTotalIndex]) : 0,
    leaderboard: memberColumns.map(function (entry) {
      return {
        name: shared.normalizeText(entry.label),
        value: shared.parseNumber(totalsRow[entry.index])
      };
    }).filter(function (entry) {
      return entry.name && entry.value;
    }).sort(function (a, b) { return b.value - a.value; })
  };
}

function parseAttendanceReport(report) {
  var memberTotals = [];
  var totalsRow = report.rows
    .filter(function (row) {
      return !shared.normalizeText(row[0]) && row.slice(1).some(function (v) { return shared.normalizeText(v); });
    })
    .slice(-1)[0] || [];

  for (var index = 1; index < report.cols.length; index += 3) {
    var label = report.cols[index] || '';
    var name = shared.normalizeText(label.replace(/\s+Unexcused$/i, ''));
    if (!name) continue;

    var summary = {
      name: name,
      unexcused: shared.parseNumber(totalsRow[index]),
      excused: shared.parseNumber(totalsRow[index + 1]),
      sub: shared.parseNumber(totalsRow[index + 2])
    };
    summary.totalFlags = summary.unexcused + summary.excused + summary.sub;
    memberTotals.push(summary);
  }

  return {
    watchlist: memberTotals
      .filter(function (entry) { return entry.totalFlags > 0; })
      .sort(function (a, b) {
        return b.unexcused - a.unexcused || b.totalFlags - a.totalFlags || a.name.localeCompare(b.name);
      })
  };
}

function parsePipelineReport(report) {
  var weekly = new Map();
  var closedDeals = [];
  var totalReferrals = 0;
  var totalClosedDeals = 0;
  var totalRevenue = 0;

  report.rows.forEach(function (row) {
    var date = shared.parseDate(row[2]);
    if (!date || date.getUTCFullYear() !== 2026) return;

    var key = date.toISOString().slice(0, 10);
    if (!weekly.has(key)) {
      weekly.set(key, {
        date: date,
        dateLabel: formatShortDate(date),
        referrals: 0, closedDeals: 0, revenue: 0
      });
    }

    var bucket = weekly.get(key);
    bucket.referrals += 1;
    totalReferrals += 1;

    var disposition = shared.normalizeText(row[4]).toLowerCase();
    var revenue = shared.parseNumber(row[5]);

    if (disposition === 'closed business') {
      bucket.closedDeals += 1;
      bucket.revenue += revenue;
      totalClosedDeals += 1;
      totalRevenue += revenue;
      closedDeals.push({
        date: date, dateLabel: formatShortDate(date),
        from: shared.normalizeText(row[0]), to: shared.normalizeText(row[1]),
        prospect: shared.normalizeText(row[3]), revenue: revenue
      });
    }
  });

  var recentWeeks = Array.from(weekly.values()).sort(compareRowsByDateAsc);

  return {
    currentWeek: getLatestCompletedRow(recentWeeks),
    recentWeeks: recentWeeks.slice(-6),
    totalReferrals: totalReferrals,
    totalClosedDeals: totalClosedDeals,
    totalRevenue: totalRevenue,
    recentClosedDeals: closedDeals
      .sort(function (a, b) { return b.date.getTime() - a.date.getTime(); })
      .slice(0, 6)
      .map(function (entry) {
        return {
          dateLabel: entry.dateLabel, from: entry.from,
          to: entry.to, prospect: entry.prospect,
          revenue: formatCurrency(entry.revenue)
        };
      })
  };
}

function buildRecentWeeks(guests, bizChats, pipeline) {
  var buckets = new Map();

  [guests.recentWeeks, bizChats.recentWeeks, pipeline.recentWeeks].forEach(function (collection) {
    collection.forEach(function (entry) {
      var key = entry.date.toISOString().slice(0, 10);
      if (!buckets.has(key)) {
        buckets.set(key, {
          date: entry.date, week: entry.dateLabel,
          guests: 0, bizChats: 0, referrals: 0, revenue: 0
        });
      }
    });
  });

  guests.recentWeeks.forEach(function (entry) {
    buckets.get(entry.date.toISOString().slice(0, 10)).guests = entry.guests;
  });
  bizChats.recentWeeks.forEach(function (entry) {
    buckets.get(entry.date.toISOString().slice(0, 10)).bizChats = entry.total;
  });
  pipeline.recentWeeks.forEach(function (entry) {
    var bucket = buckets.get(entry.date.toISOString().slice(0, 10));
    bucket.referrals = entry.referrals;
    bucket.revenue = entry.revenue;
  });

  return Array.from(buckets.values())
    .sort(compareRowsByDateAsc)
    .slice(-6)
    .map(function (entry) {
      return {
        week: entry.week, guests: entry.guests,
        bizChats: entry.bizChats, referrals: entry.referrals,
        revenue: formatCurrency(entry.revenue)
      };
    });
}

function buildAttendancePresenterLine(watchlist) {
  if (!watchlist.length) {
    return 'Attendance is clean right now, so there is nothing that needs to be called out to the room.';
  }
  return 'Attendance note: ' + watchlist.slice(0, 3).map(function (entry) {
    return entry.name + ' has ' + entry.unexcused + ' unexcused, ' + entry.excused + ' excused, and ' + entry.sub + ' sub' + (entry.sub === 1 ? '' : 's');
  }).join('; ') + '.';
}

function buildPresenterPayload(report) {
  var leadDeal = report.recentClosedDeals[0];

  return {
    guidance: 'Stand at the front, sell the team, hit last week first, then rolling 12 months, and only read attendance if there is actually something to flag.',
    lastWeekStats: [
      { label: 'Guests', value: report.currentWeek.guests },
      { label: 'BizChats', value: report.currentWeek.bizChats },
      { label: 'Referrals', value: report.currentWeek.referrals },
      { label: 'Closed Revenue', value: report.currentWeek.closedRevenue }
    ],
    rollingStats: [
      { label: 'Guests Hosted', value: report.kpis.guestsHosted },
      { label: 'BizChats', value: report.kpis.bizChats },
      { label: 'Referrals', value: report.kpis.referrals },
      { label: 'Closed Revenue', value: report.kpis.closedRevenue }
    ],
    scriptLines: [
      'Last week we hosted ' + report.currentWeek.guests + ' guests, logged ' + report.currentWeek.bizChats + ' BizChats, passed ' + report.currentWeek.referrals + ' referrals, and closed ' + report.currentWeek.closedRevenue + '.',
      'Rolling 12 months, we have hosted ' + report.kpis.guestsHosted + ' guests, logged ' + report.kpis.bizChats + ' BizChats, passed ' + report.kpis.referrals + ' referrals, and closed ' + report.kpis.closedRevenue + '.',
      buildAttendancePresenterLine(report.attendanceWatchlist),
      leadDeal
        ? 'Closed business highlight: ' + leadDeal.dateLabel + ', ' + leadDeal.from + ' to ' + leadDeal.to + ' with ' + leadDeal.prospect + ' for ' + leadDeal.revenue + '.'
        : 'There is no recent closed business highlight to call out right now.',
      'If you want to sell the room, lean hard into the revenue and momentum numbers.'
    ]
  };
}

async function buildAdminReport() {
  var sheets = await Promise.all([
    fetchReportSheet('Guest Incentive Report'),
    fetchReportSheet('Attendance Report'),
    fetchReportSheet('BizChats Report'),
    fetchReportSheet('Referral Pipeline')
  ]);

  var guests = parseGuestReport(sheets[0]);
  var attendance = parseAttendanceReport(sheets[1]);
  var bizChats = parseBizChatsReport(sheets[2]);
  var pipeline = parsePipelineReport(sheets[3]);

  var report = {
    generatedAt: new Date().toISOString(),
    kpis: {
      guestsHosted: guests.totalGuests,
      bizChats: bizChats.totalBizChats,
      referrals: pipeline.totalReferrals,
      closedRevenue: formatCurrency(pipeline.totalRevenue)
    },
    currentWeek: {
      label: (guests.currentWeek && guests.currentWeek.dateLabel) || (bizChats.currentWeek && bizChats.currentWeek.dateLabel) || (pipeline.currentWeek && pipeline.currentWeek.dateLabel) || 'Latest',
      guests: guests.currentWeek ? guests.currentWeek.guests : 0,
      bizChats: bizChats.currentWeek ? bizChats.currentWeek.total : 0,
      referrals: pipeline.currentWeek ? pipeline.currentWeek.referrals : 0,
      closedRevenue: formatCurrency(pipeline.currentWeek ? pipeline.currentWeek.revenue : 0)
    },
    recentWeeks: buildRecentWeeks(guests, bizChats, pipeline),
    leaders: {
      guestHosts: guests.leaderboard.slice(0, 6),
      bizChats: bizChats.leaderboard.slice(0, 6)
    },
    attendanceWatchlist: attendance.watchlist,
    recentClosedDeals: pipeline.recentClosedDeals
  };

  report.presenter = buildPresenterPayload(report);
  return report;
}

module.exports = async function handler(req, res) {
  if (req.method === 'HEAD') return shared.handleHead(res);
  if (req.method === 'OPTIONS') return shared.handleOptions(res, ['POST', 'HEAD', 'OPTIONS']);
  if (req.method !== 'POST') return shared.handleMethodNotAllowed(req, res, ['POST', 'HEAD', 'OPTIONS']);

  try {
    var body = await shared.readRequestBody(req, 4 * 1024);
    var passcode = getPasscode(req, body);

    if (!ADMIN_PASSCODE || !passcode || passcode !== ADMIN_PASSCODE) {
      return shared.sendJson(res, 401, { status: 'error', message: 'Invalid passcode' });
    }

    var report = await buildAdminReport();
    return shared.sendJson(res, 200, { status: 'ok', report: report });
  } catch (error) {
    console.error('[api/admin-report]', error);
    return shared.sendJson(res, 500, {
      status: 'error',
      message: 'Unable to load admin report right now'
    });
  }
};
