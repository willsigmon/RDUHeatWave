'use strict';

var shared = require('./_lib/shared');

var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkchMEuPQlPe91xWx3QGeSD_yk0q4g-1iBZ0gumknVqBu1s57_A0Dg2pbd64huh21D/exec';
var APPS_SCRIPT_TIMEOUT_MS = 10 * 1000;
var CACHE_HEADER = 'public, max-age=0, s-maxage=300, stale-while-revalidate=600';

var DEFAULT_MEMBERS = [
  { name: 'Carter Helms', title: 'Team Chair', company: 'Highstreet Ins & Financial Svcs', leader: true, website: 'https://carterhelms.com' },
  { name: 'Craig Morrill', title: 'Vice Chair', company: 'Summit Global', leader: true, website: '' },
  { name: 'Will Sigmon', title: 'Team Admin', company: 'Will Sigmon Media', leader: true, website: 'https://willsigmon.media' },
  { name: 'Rusty Sutton', title: 'Team Marketing Specialist', company: 'Monkey Fans Creative', leader: true, specialTitle: true, website: 'https://monkeyfansraleigh.com' },
  { name: 'Robert Courts', title: 'Mortgage Lending', company: 'Advantage Lending', leader: false, website: 'https://advantagelending.com' },
  { name: 'Dana Walsh', title: 'Magazine Publisher', company: 'Stroll Magazine', leader: false, website: 'https://strollmag.com/locations/hayes-barton-nc' },
  { name: 'Nathan Senn', title: 'Property Restoration', company: 'Franco Restorations', leader: false, website: 'https://francorestorations.com' },
  { name: 'Roni Payne', title: 'Accounting / Tax', company: 'R. Payne LLC', leader: false, website: '' }
];

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

function normalizeMember(member) {
  var normalized = {
    name: shared.normalizeText(member && member.name),
    title: shared.normalizeText(member && member.title) || 'Member',
    company: shared.normalizeText(member && member.company),
    website: normalizeWebsite(member && member.website),
    leader: normalizeBoolean(member && member.leader),
    specialTitle: normalizeBoolean(member && member.specialTitle)
  };
  return normalized.name ? normalized : null;
}

async function fetchRemoteMembers() {
  var url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('resource', 'members');

  var controller = new AbortController();
  var timeoutId = setTimeout(function () { controller.abort(); }, APPS_SCRIPT_TIMEOUT_MS);

  try {
    var response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'follow',
      signal: controller.signal
    });
    if (!response.ok) throw new Error('Apps Script members request failed');
    var payload = await response.json();
    if (!payload || payload.status !== 'ok' || !Array.isArray(payload.members)) {
      throw new Error('Apps Script members payload was invalid');
    }
    return payload.members.map(normalizeMember).filter(Boolean);
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'HEAD') return shared.handleHead(res, CACHE_HEADER);
  if (req.method === 'OPTIONS') return shared.handleOptions(res, ['GET', 'HEAD', 'OPTIONS'], CACHE_HEADER);
  if (req.method !== 'GET') return shared.handleMethodNotAllowed(req, res, ['GET', 'HEAD', 'OPTIONS']);

  try {
    var remoteMembers = await fetchRemoteMembers();
    if (remoteMembers.length) {
      return shared.sendCachedJson(res, 200, { status: 'ok', source: 'apps-script', members: remoteMembers });
    }
  } catch (error) {
    console.error('[api/members]', error);
  }

  return shared.sendCachedJson(res, 200, {
    status: 'ok',
    source: 'fallback',
    members: DEFAULT_MEMBERS.map(normalizeMember).filter(Boolean)
  });
};
