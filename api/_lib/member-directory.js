'use strict';

var shared = require('./shared');
var memberPhotoOverrides = require('./member-photo-overrides');

// Governance committee members (leader: true shows under "Governance" heading).
// These names are always treated as leaders regardless of what the sheet says,
// because the live sheet occasionally has the leader column blank/FALSE for
// governance rows.
var LEADER_OVERRIDES = {
  'carter helms': true,
  'craig morrill': true,
  'will sigmon': true
};

// The single Team Chair gets the full-width "chair" card treatment at the top
// of the Governance Committee section on the About panel.
var CHAIR_OVERRIDES = {
  'carter helms': true
};

var DEFAULT_MEMBERS = [
  { name: 'Carter Helms', title: 'Team Chair', company: 'Highstreet Ins & Financial Svcs', leader: true, chair: true, website: 'https://carterhelms.com' },
  { name: 'Craig Morrill', title: 'Vice Chair', company: 'Summit Global Investments', leader: true, chair: false, website: 'https://sgiam.com' },
  { name: 'Will Sigmon', title: 'Team Admin', company: 'Will Sigmon Media Co.', leader: true, chair: false, website: 'https://willsigmon.media' },
  { name: 'Rusty Sutton', title: 'Team Marketing Specialist', company: 'MonkeyFans Creative', leader: false, chair: false, specialTitle: true, website: 'https://monkeyfansraleigh.com/about' },
  { name: 'Robert Courts', title: 'Mortgage Lending', company: 'Advantage Lending', leader: false, chair: false, website: 'https://advantagelending.com/mortgage-loan-services' },
  { name: 'Dana Walsh', title: 'Magazine Publisher', company: 'Stroll Magazine', leader: false, chair: false, website: 'https://strollmag.com/locations/hayes-barton-nc' },
  { name: 'Nathan Senn', title: 'Property Restoration', company: 'Franco Restorations', leader: false, chair: false, website: 'https://francorestorations.com' },
  { name: 'Roni Payne', title: 'Accounting / Tax', company: 'R. Payne Financial & Tax Solutions', leader: false, chair: false, website: 'https://rpayne.org/about' },
  { name: 'Shannida Ramsey', title: 'Property Maintenance', company: 'Ram-Z Services LLC', leader: false, chair: false, website: 'https://ramzservices.com' },
  { name: 'David Mercado', title: 'HOA Management', company: 'William Douglas Management', leader: false, chair: false, website: 'https://wmdouglas.com/raleigh-hoa-management' },
  { name: 'Sue Kerata', title: 'Realtor', company: 'Century 21 Triangle Group', leader: false, chair: false, website: 'https://suekhomes.com' }
].map(memberPhotoOverrides.applyMemberPhotoOverride);

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

function repairKnownDirectoryAnomalies(member) {
  var normalizedName = shared.normalizeText(member && member.name).toLowerCase();
  var normalizedCompany = shared.normalizeText(member && member.company).toLowerCase();

  // The live Membership Directory currently has Carter's row stored as
  // "Name | Team Chair | Highstreet..." instead of using his real name.
  if (normalizedName === 'name' && normalizedCompany.indexOf('highstreet') !== -1) {
    return Object.assign({}, member, { name: 'Carter Helms' });
  }

  return member;
}

function parseMembersFromSheet(report) {
  var headers = report.cols.map(function (col) {
    return normalizeHeader(col);
  });

  var dataRows = report.rows;
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

    var sheetLeader = leaderIdx >= 0 ? normalizeBoolean(row[leaderIdx]) : false;

    var repaired = repairKnownDirectoryAnomalies({
      name: rawName,
      title: titleIdx >= 0 ? shared.normalizeText(row[titleIdx]) || 'Member' : 'Member',
      company: companyIdx >= 0 ? shared.normalizeText(row[companyIdx]) : '',
      website: websiteIdx >= 0 ? normalizeWebsite(row[websiteIdx]) : '',
      leader: sheetLeader
    });

    // Apply governance + chair overrides AFTER the anomaly repair so lookups
    // use the corrected name (the live sheet occasionally stores Carter's row
    // with name="Name", which the repair rewrites before we key the override).
    var nameKey = repaired.name.toLowerCase();
    repaired.leader = repaired.leader || LEADER_OVERRIDES[nameKey] || false;
    repaired.chair = CHAIR_OVERRIDES[nameKey] || false;

    return memberPhotoOverrides.applyMemberPhotoOverride(repaired);
  }).filter(Boolean);
}

// Merge sheet members with the hardcoded DEFAULT_MEMBERS so members
// missing from the sheet still appear.  Sheet data wins for shared
// fields; DEFAULT_MEMBERS supplies any extras (website, specialTitle).
function mergeWithDefaults(sheetMembers) {
  var byName = {};
  DEFAULT_MEMBERS.forEach(function (m) {
    byName[m.name.toLowerCase()] = Object.assign({}, m);
  });

  sheetMembers.forEach(function (m) {
    var key = m.name.toLowerCase();
    if (byName[key]) {
      // Overlay sheet values onto the default, keeping default-only fields
      byName[key] = Object.assign(byName[key], m);
    } else {
      byName[key] = m;
    }
  });

  return Object.keys(byName).map(function (k) { return byName[k]; });
}

async function fetchMembersFromSheet(sheetId, sheetName, timeoutMs) {
  var report = await shared.fetchSheet(sheetId, sheetName, timeoutMs || 8000);
  var members = parseMembersFromSheet(report);
  if (!members.length) throw new Error('No members found in sheet');
  return mergeWithDefaults(members);
}

function slugifyMemberName(name) {
  return shared.normalizeText(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = {
  DEFAULT_MEMBERS: DEFAULT_MEMBERS,
  FIELD_ALIASES: FIELD_ALIASES,
  parseMembersFromSheet: parseMembersFromSheet,
  fetchMembersFromSheet: fetchMembersFromSheet,
  slugifyMemberName: slugifyMemberName
};
