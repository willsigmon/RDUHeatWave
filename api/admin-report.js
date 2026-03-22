'use strict';

const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || '755671';
const SHEET_ID = '1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA';
const SHEET_BASE_URL = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json&sheet=';
const REQUEST_TIMEOUT_MS = 12 * 1000;
const MAX_BODY_BYTES = 4 * 1024;

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getPasscode(req, body) {
  return normalizeText(
    (req.headers && (req.headers['x-admin-passcode'] || req.headers['X-Admin-Passcode'])) ||
    (body && body.passcode) ||
    ''
  );
}

async function readRequestBody(req) {
  if (req.method !== 'POST') return {};
  if (req.body && typeof req.body === 'object') return req.body;

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      return {};
    }
    chunks.push(Buffer.from(chunk));
  }

  if (!chunks.length) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    return {};
  }
}

function parseGvizResponse(text) {
  const matched = text.match(/setResponse\(([\s\S]+)\);?\s*$/);
  if (!matched) {
    throw new Error('Invalid Google Visualization response');
  }

  const payload = JSON.parse(matched[1]);
  const cols = ((payload.table && payload.table.cols) || []).map(function(col) {
    return normalizeText(col && col.label);
  });
  const rows = ((payload.table && payload.table.rows) || []).map(function(row) {
    return ((row && row.c) || []).map(function(cell) {
      if (!cell) return null;
      return cell.f != null ? cell.f : cell.v;
    });
  });

  return { cols: cols, rows: rows };
}

async function fetchSheet(sheetName) {
  const controller = new AbortController();
  const timeoutId = setTimeout(function() {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(SHEET_BASE_URL + encodeURIComponent(sheetName), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error('Failed to fetch sheet: ' + sheetName);
    }

    return parseGvizResponse(await response.text());
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseNumber(value) {
  const normalized = normalizeText(value)
    .replace(/\$/g, '')
    .replace(/,/g, '');

  if (!normalized || normalized === '-') return 0;

  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function parseDate(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  const match = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return null;

  let year = Number(match[3]);
  if (year < 100) year += 2000;

  const date = new Date(Date.UTC(year, Number(match[1]) - 1, Number(match[2])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount || 0);
}

function compareRowsByDateAsc(a, b) {
  return a.date.getTime() - b.date.getTime();
}

function getLatestCompletedRow(rows) {
  const completed = getCompletedRows(rows);
  return completed.length ? completed[completed.length - 1] : null;
}

function getCompletedRows(rows) {
  const now = new Date();
  const currentUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  return rows.filter(function(row) {
    return row.date && row.date.getTime() <= currentUtc;
  });
}

function parseGuestReport(report) {
  const weeklyTotalIndex = report.cols.findIndex(function(label) {
    return label.toLowerCase() === 'weekly total points';
  });
  const grandTotalIndex = report.cols.findIndex(function(label) {
    return label.toLowerCase() === 'total';
  });

  const memberColumns = report.cols
    .map(function(label, index) {
      return { label: label, index: index };
    })
    .filter(function(entry) {
      return /points$/i.test(entry.label) && !/^weekly total points$/i.test(entry.label);
    });

  const weeklyRows = report.rows
    .map(function(row) {
      const date = parseDate(row[0]);
      return {
        date: date,
        dateLabel: date ? formatShortDate(date) : '',
        guests: weeklyTotalIndex >= 0 ? parseNumber(row[weeklyTotalIndex]) : 0,
        totalWithBonus: grandTotalIndex >= 0 ? parseNumber(row[grandTotalIndex]) : 0
      };
    })
    .filter(function(row) {
      return !!row.date;
    })
    .sort(compareRowsByDateAsc);

  const totalsRow = report.rows
    .filter(function(row) {
      return !normalizeText(row[0]) && (weeklyTotalIndex >= 0 ? normalizeText(row[weeklyTotalIndex]) : '');
    })
    .slice(-1)[0] || [];

  return {
    currentWeek: getLatestCompletedRow(weeklyRows),
    recentWeeks: getCompletedRows(weeklyRows).slice(-6),
    totalGuests: weeklyTotalIndex >= 0 ? parseNumber(totalsRow[weeklyTotalIndex]) : 0,
    totalGuestPointsWithBonus: grandTotalIndex >= 0 ? parseNumber(totalsRow[grandTotalIndex]) : 0,
    leaderboard: memberColumns.map(function(entry) {
      return {
        name: normalizeText(entry.label.replace(/\s*Points$/i, '')),
        value: parseNumber(totalsRow[entry.index])
      };
    }).filter(function(entry) {
      return entry.name && entry.value;
    }).sort(function(a, b) {
      return b.value - a.value;
    })
  };
}

function parseBizChatsReport(report) {
  const weeklyTotalIndex = report.cols.findIndex(function(label) {
    return label.toLowerCase() === 'weekly total';
  });

  const memberColumns = report.cols
    .map(function(label, index) {
      return { label: label, index: index };
    })
    .filter(function(entry) {
      return entry.index > 0 && entry.index < weeklyTotalIndex && entry.label;
    });

  const weeklyRows = report.rows
    .map(function(row) {
      const date = parseDate(row[0]);
      return {
        date: date,
        dateLabel: date ? formatShortDate(date) : '',
        total: weeklyTotalIndex >= 0 ? parseNumber(row[weeklyTotalIndex]) : 0
      };
    })
    .filter(function(row) {
      return !!row.date;
    })
    .sort(compareRowsByDateAsc);

  const totalsRow = report.rows
    .filter(function(row) {
      return !normalizeText(row[0]) && (weeklyTotalIndex >= 0 ? normalizeText(row[weeklyTotalIndex]) : '');
    })
    .slice(-1)[0] || [];

  return {
    currentWeek: getLatestCompletedRow(weeklyRows),
    recentWeeks: getCompletedRows(weeklyRows).slice(-6),
    totalBizChats: weeklyTotalIndex >= 0 ? parseNumber(totalsRow[weeklyTotalIndex]) : 0,
    leaderboard: memberColumns.map(function(entry) {
      return {
        name: normalizeText(entry.label),
        value: parseNumber(totalsRow[entry.index])
      };
    }).filter(function(entry) {
      return entry.name && entry.value;
    }).sort(function(a, b) {
      return b.value - a.value;
    })
  };
}

function parseAttendanceReport(report) {
  const memberTotals = [];
  const totalsRow = report.rows
    .filter(function(row) {
      return !normalizeText(row[0]) && row.slice(1).some(function(value) { return normalizeText(value); });
    })
    .slice(-1)[0] || [];

  for (let index = 1; index < report.cols.length; index += 3) {
    const label = report.cols[index] || '';
    const name = normalizeText(label.replace(/\s+Unexcused$/i, ''));
    if (!name) continue;

    const summary = {
      name: name,
      unexcused: parseNumber(totalsRow[index]),
      excused: parseNumber(totalsRow[index + 1]),
      sub: parseNumber(totalsRow[index + 2])
    };
    summary.totalFlags = summary.unexcused + summary.excused + summary.sub;
    memberTotals.push(summary);
  }

  return {
    watchlist: memberTotals
      .filter(function(entry) { return entry.totalFlags > 0; })
      .sort(function(a, b) {
        return b.unexcused - a.unexcused || b.totalFlags - a.totalFlags || a.name.localeCompare(b.name);
      })
  };
}

function parsePipelineReport(report) {
  const weekly = new Map();
  const closedDeals = [];
  let totalReferrals = 0;
  let totalClosedDeals = 0;
  let totalRevenue = 0;

  report.rows.forEach(function(row) {
    const date = parseDate(row[2]);
    if (!date || date.getUTCFullYear() !== 2026) return;

    const key = date.toISOString().slice(0, 10);
    if (!weekly.has(key)) {
      weekly.set(key, {
        date: date,
        dateLabel: formatShortDate(date),
        referrals: 0,
        closedDeals: 0,
        revenue: 0
      });
    }

    const bucket = weekly.get(key);
    bucket.referrals += 1;
    totalReferrals += 1;

    const disposition = normalizeText(row[4]).toLowerCase();
    const revenue = parseNumber(row[5]);

    if (disposition === 'closed business') {
      bucket.closedDeals += 1;
      bucket.revenue += revenue;
      totalClosedDeals += 1;
      totalRevenue += revenue;
      closedDeals.push({
        date: date,
        dateLabel: formatShortDate(date),
        from: normalizeText(row[0]),
        to: normalizeText(row[1]),
        prospect: normalizeText(row[3]),
        revenue: revenue
      });
    }
  });

  const recentWeeks = Array.from(weekly.values()).sort(compareRowsByDateAsc);

  return {
    currentWeek: getLatestCompletedRow(recentWeeks),
    recentWeeks: recentWeeks.slice(-6),
    totalReferrals: totalReferrals,
    totalClosedDeals: totalClosedDeals,
    totalRevenue: totalRevenue,
    recentClosedDeals: closedDeals
      .sort(function(a, b) { return b.date.getTime() - a.date.getTime(); })
      .slice(0, 6)
      .map(function(entry) {
        return {
          dateLabel: entry.dateLabel,
          from: entry.from,
          to: entry.to,
          prospect: entry.prospect,
          revenue: formatCurrency(entry.revenue)
        };
      })
  };
}

function buildRecentWeeks(guests, bizChats, pipeline) {
  const buckets = new Map();

  [guests.recentWeeks, bizChats.recentWeeks, pipeline.recentWeeks].forEach(function(collection) {
    collection.forEach(function(entry) {
      const key = entry.date.toISOString().slice(0, 10);
      if (!buckets.has(key)) {
        buckets.set(key, {
          date: entry.date,
          week: entry.dateLabel,
          guests: 0,
          bizChats: 0,
          referrals: 0,
          revenue: 0
        });
      }
    });
  });

  guests.recentWeeks.forEach(function(entry) {
    buckets.get(entry.date.toISOString().slice(0, 10)).guests = entry.guests;
  });
  bizChats.recentWeeks.forEach(function(entry) {
    buckets.get(entry.date.toISOString().slice(0, 10)).bizChats = entry.total;
  });
  pipeline.recentWeeks.forEach(function(entry) {
    const bucket = buckets.get(entry.date.toISOString().slice(0, 10));
    bucket.referrals = entry.referrals;
    bucket.revenue = entry.revenue;
  });

  return Array.from(buckets.values())
    .sort(compareRowsByDateAsc)
    .slice(-6)
    .map(function(entry) {
      return {
        week: entry.week,
        guests: entry.guests,
        bizChats: entry.bizChats,
        referrals: entry.referrals,
        revenue: formatCurrency(entry.revenue)
      };
    });
}

function buildAttendancePresenterLine(watchlist) {
  if (!watchlist.length) {
    return 'Attendance is clean right now, so there is nothing that needs to be called out to the room.';
  }

  return 'Attendance note: ' + watchlist.slice(0, 3).map(function(entry) {
    return entry.name + ' has ' + entry.unexcused + ' unexcused, ' + entry.excused + ' excused, and ' + entry.sub + ' sub' + (entry.sub === 1 ? '' : 's');
  }).join('; ') + '.';
}

function buildPresenterPayload(report) {
  const leadDeal = report.recentClosedDeals[0];

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
  const [guestReport, attendanceReport, bizChatsReport, pipelineReport] = await Promise.all([
    fetchSheet('Guest Incentive Report'),
    fetchSheet('Attendance Report'),
    fetchSheet('BizChats Report'),
    fetchSheet('Referral Pipeline')
  ]);

  const guests = parseGuestReport(guestReport);
  const attendance = parseAttendanceReport(attendanceReport);
  const bizChats = parseBizChatsReport(bizChatsReport);
  const pipeline = parsePipelineReport(pipelineReport);

  const report = {
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
  if (req.method === 'HEAD') {
    res.statusCode = 200;
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end();
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', 'POST, HEAD, OPTIONS');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, HEAD, OPTIONS');
    return sendJson(res, 405, { status: 'error', message: 'Method not allowed' });
  }

  try {
    const body = await readRequestBody(req);
    const passcode = getPasscode(req, body);

    if (!passcode || passcode !== ADMIN_PASSCODE) {
      return sendJson(res, 401, { status: 'error', message: 'Invalid passcode' });
    }

    const report = await buildAdminReport();
    return sendJson(res, 200, { status: 'ok', report: report });
  } catch (error) {
    return sendJson(res, 500, {
      status: 'error',
      message: 'Unable to load admin report right now'
    });
  }
};
