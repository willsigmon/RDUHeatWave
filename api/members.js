'use strict';

var shared = require('./_lib/shared');

var SHEET_ID = '1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA';
var SHEET_NAME = 'Membership Directory';
var CACHE_HEADER = 'public, max-age=0, s-maxage=300, stale-while-revalidate=600';

// Governance committee members (leader: true shows under "Governance" heading)
var LEADER_OVERRIDES = {
  'carter helms': true,
  'craig morrill': true,
  'will sigmon': true
};

var DEFAULT_MEMBERS = [
  { name: 'Carter Helms', title: 'Team Chair', company: 'Highstreet Ins & Financial Svcs', leader: true, website: 'https://carterhelms.com' },
  { name: 'Craig Morrill', title: 'Vice Chair', company: 'Summit Global Investments', leader: true, website: 'https://sgiam.com' },
  { name: 'Will Sigmon', title: 'Team Admin', company: 'Will Sigmon Media Co.', leader: true, website: 'https://willsigmon.media' },
  { name: 'Rusty Sutton', title: 'Team Marketing Specialist', company: 'MonkeyFans Creative', leader: false, specialTitle: true, website: 'https://monkeyfansraleigh.com/about' },
  { name: 'Robert Courts', title: 'Mortgage Lending', company: 'Advantage Lending', leader: false, website: 'https://advantagelending.com/mortgage-loan-services' },
  { name: 'Dana Walsh', title: 'Magazine Publisher', company: 'Stroll Magazine', leader: false, website: 'https://strollmag.com/locations/hayes-barton-nc' },
  { name: 'Nathan Senn', title: 'Property Restoration', company: 'Franco Restorations', leader: false, website: 'https://francorestorations.com' },
  { name: 'Roni Payne', title: 'Accounting / Tax', company: 'R. Payne LLC', leader: false, website: 'https://rpayne.org/about' },
  { name: 'Shannida Ramsey', title: 'Property Maintenance', company: 'Ram-Z Services LLC', leader: false, website: 'https://ramzservices.com' },
  { name: 'David Mercado', title: 'HOA Management', company: 'William Douglas Management', leader: false, website: 'https://wmdouglas.com/raleigh-hoa-management' },
  { name: 'Sue Kerata', title: 'Realtor', company: 'Century 21 Triangle Group', leader: false, website: 'https://suekhomes.com' }
];

// ── Field mapping ───────────────────────────────────────────────────
// The Membership Directory tab uses simple headers: Name, Profession,
// Company, Website. We map them to our member object shape.

var FIELD_ALIASES = {
  name: ['name', 'fullname', 'member', 'membername'],
  title: ['profession', 'title', 'category', 'industry'],
  company: ['company', 'companyname', 'business'],
  website: ['website', 'url', 'site', 'link'],
  leader: ['leader', 'governance', 'admin', 'officer']
};

function normalizeHeader(value) {
  return shared.normalizeText(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  var normalized = shared.normalizeText(value).toLowerCase();
  return normalized === 'true' || normalized === 'yes' || normalized === '1';
}

function normalizeWebsite(value) {
  var normalized = shared.normalizeText(value);
  if (!normalized) return '';
  if (/^(mailto:|tel:)/i.test(normalized)) return normalized;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)) {
    normalized = 'https://' + normalized.replace(/^\/+/, '');
  }
  try {
    return new URL(normalized).href;
  } catch (_err) {
    return '';
  }
}

function findFieldIndex(headers, fieldName) {
  var aliases = FIELD_ALIASES[fieldName] || [];
  for (var i = 0; i < headers.length; i++) {
    if (aliases.indexOf(headers[i]) !== -1) return i;
  }
  return -1;
}

function parseMembersFromSheet(report) {
  // First row is the header if the sheet has labels; gviz cols may be empty
  // if the sheet uses row 1 as data. Check cols first, fall back to first row.
  var headers = report.cols.map(function (col) {
    return normalizeHeader(col);
  });

  var dataRows = report.rows;

  // If headers are all empty, treat first data row as headers
  var hasHeaders = headers.some(function (h) { return h; });
  if (!hasHeaders && dataRows.length > 0) {
    headers = dataRows[0].map(function (cell) {
      return normalizeHeader(cell != null ? String(cell) : '');
    });
    dataRows = dataRows.slice(1);
  }

  var nameIdx = findFieldIndex(headers, 'name');
  var titleIdx = findFieldIndex(headers, 'title');
  var companyIdx = findFieldIndex(headers, 'company');
  var websiteIdx = findFieldIndex(headers, 'website');
  var leaderIdx = findFieldIndex(headers, 'leader');

  if (nameIdx < 0) return [];

  return dataRows.map(function (row) {
    var rawName = shared.normalizeText(row[nameIdx]);
    if (!rawName) return null;

    var isLeader = leaderIdx >= 0
      ? normalizeBoolean(row[leaderIdx])
      : (LEADER_OVERRIDES[rawName.toLowerCase()] || false);

    return {
      name: rawName,
      title: titleIdx >= 0 ? shared.normalizeText(row[titleIdx]) || 'Member' : 'Member',
      company: companyIdx >= 0 ? shared.normalizeText(row[companyIdx]) : '',
      website: websiteIdx >= 0 ? normalizeWebsite(row[websiteIdx]) : '',
      leader: isLeader
    };
  }).filter(Boolean);
}

async function fetchMembersFromSheet() {
  var report = await shared.fetchSheet(SHEET_ID, SHEET_NAME, 8000);
  var members = parseMembersFromSheet(report);
  if (!members.length) throw new Error('No members found in sheet');
  return members;
}

module.exports = async function handler(req, res) {
  if (req.method === 'HEAD') return shared.handleHead(res, CACHE_HEADER);
  if (req.method === 'OPTIONS') return shared.handleOptions(res, ['GET', 'HEAD', 'OPTIONS'], CACHE_HEADER);
  if (req.method !== 'GET') return shared.handleMethodNotAllowed(req, res, ['GET', 'HEAD', 'OPTIONS']);

  try {
    var members = await fetchMembersFromSheet();
    return shared.sendCachedJson(res, 200, { status: 'ok', source: 'sheet', members: members });
  } catch (error) {
    console.error('[api/members]', error);
  }

  return shared.sendCachedJson(res, 200, {
    status: 'ok',
    source: 'fallback',
    members: DEFAULT_MEMBERS
  });
};
