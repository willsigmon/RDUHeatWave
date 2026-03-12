'use strict';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwvYv_BYJznuumdC51jP-P6RuYRRgK5MEONjUywvl322MbR1W1_nA1hZHcsSj5oLfzvoQ/exec';
const APPS_SCRIPT_TIMEOUT_MS = 10 * 1000;
const DEFAULT_MEMBERS = [
  { name: 'Carter Helms', title: 'Team Chair', company: 'Highstreet Ins & Financial Svcs', leader: true, website: 'https://carterhelms.com' },
  { name: 'Craig Morrill', title: 'Vice Chair', company: 'Summit Global', leader: true, website: '' },
  { name: 'Will Sigmon', title: 'Team Admin', company: 'Will Sigmon Media', leader: true, website: 'https://willsigmon.media' },
  { name: 'Rusty Sutton', title: 'Team Marketing Specialist', company: 'Monkey Fans Creative', leader: true, specialTitle: true, website: 'https://monkeyfansraleigh.com' },
  { name: 'Robert Courts', title: 'Mortgage Lending', company: 'Advantage Lending', leader: false, website: 'https://advantagelending.com' },
  { name: 'Dana Walsh', title: 'Magazine Publisher', company: 'Stroll Magazine', leader: false, website: 'https://strollmag.com/locations/hayes-barton-nc' },
  { name: 'Nathan Senn', title: 'Property Restoration', company: 'Franco Restorations', leader: false, website: 'https://francorestorations.com' },
  { name: 'Roni Payne', title: 'Accounting / Tax', company: 'R. Payne LLC', leader: false, website: '' }
];

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeText(value).toLowerCase();
  return normalized === 'true' || normalized === 'yes' || normalized === '1';
}

function normalizeWebsite(value) {
  let normalized = normalizeText(value);
  if (!normalized) return '';
  if (/^(mailto:|tel:)/i.test(normalized)) return normalized;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)) {
    normalized = 'https://' + normalized.replace(/^\/+/, '');
  }

  try {
    return new URL(normalized).href;
  } catch (error) {
    return '';
  }
}

function normalizeMember(member) {
  const normalized = {
    name: normalizeText(member && member.name),
    title: normalizeText(member && member.title) || 'Member',
    company: normalizeText(member && member.company),
    website: normalizeWebsite(member && member.website),
    leader: normalizeBoolean(member && member.leader),
    specialTitle: normalizeBoolean(member && member.specialTitle)
  };

  return normalized.name ? normalized : null;
}

async function fetchRemoteMembers() {
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('resource', 'members');

  const controller = new AbortController();
  const timeoutId = setTimeout(function() {
    controller.abort();
  }, APPS_SCRIPT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'follow',
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error('Apps Script members request failed');
    }

    const payload = await response.json();
    if (!payload || payload.status !== 'ok' || !Array.isArray(payload.members)) {
      throw new Error('Apps Script members payload was invalid');
    }

    return payload.members.map(normalizeMember).filter(Boolean);
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'HEAD') {
    res.statusCode = 200;
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end();
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', 'GET, HEAD, OPTIONS');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
    return res.end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, HEAD, OPTIONS');
    return sendJson(res, 405, { status: 'error', message: 'Method not allowed' });
  }

  try {
    const remoteMembers = await fetchRemoteMembers();
    if (remoteMembers.length) {
      return sendJson(res, 200, { status: 'ok', source: 'apps-script', members: remoteMembers });
    }
  } catch (error) {
    // Fall through to the local static fallback.
  }

  return sendJson(res, 200, {
    status: 'ok',
    source: 'fallback',
    members: DEFAULT_MEMBERS.map(normalizeMember).filter(Boolean)
  });
};
