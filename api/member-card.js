'use strict';

var shared = require('./_lib/shared');
var memberDirectory = require('./_lib/member-directory');

var SHEET_ID = '1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA';
var SHEET_NAME = 'Membership Directory';

/**
 * GET /api/member-card?name=carter-helms
 * Returns a styled HTML digital business card for the member.
 * Cross-pollinated from willsigmonmediaco's DigitalBusinessCard.
 */
module.exports = async function handler(req, res) {
  if (req.method === 'HEAD') return shared.handleHead(res, 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  if (req.method === 'OPTIONS') return shared.handleOptions(res, ['GET', 'HEAD', 'OPTIONS'], 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  if (req.method !== 'GET') return shared.handleMethodNotAllowed(req, res, ['GET', 'HEAD', 'OPTIONS']);

  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');

  var slug = shared.normalizeText(req.query && req.query.name).toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!slug) {
    return shared.sendJson(res, 400, { error: 'name parameter required (e.g., ?name=carter-helms)' });
  }

  var members;
  try {
    members = await memberDirectory.fetchMembersFromSheet(SHEET_ID, SHEET_NAME, 8000);
  } catch (e) {
    console.error('[api/member-card] Sheet fetch failed:', e.message || e);
    members = memberDirectory.DEFAULT_MEMBERS;
  }

  var member = members.find(function (m) {
    return memberDirectory.slugifyMemberName(m.name) === slug;
  });

  if (!member) {
    return shared.sendJson(res, 404, { error: 'Member not found: ' + slug });
  }

  var html = buildCard(member);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.end(html);
};

function buildCard(m) {
  var esc = shared.escapeHtml;
  var name = esc(m.name);
  var title = esc(m.title);
  var company = esc(m.company);
  var initials = m.name.split(' ').map(function (w) { return w[0]; }).join('').toUpperCase();
  var safeUrl = shared.sanitizeUrl(m.website);
  var websiteDisplay = safeUrl ? esc(m.website.replace(/^https?:\/\//, '').replace(/\/$/, '')) : '';
  var safePhoto = /^\/member-photos\//.test(String(m.photo || ''))
    ? esc(m.photo)
    : shared.sanitizeUrl(m.photo || '');

  return '<!DOCTYPE html>\n' +
    '<html lang="en"><head>\n' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>' + name + ' — RDU Heatwave</title>\n' +
    '<meta name="description" content="' + name + ', ' + title + ' at ' + company + '. RDU Heatwave member.">\n' +
    '<meta property="og:title" content="' + name + ' — RDU Heatwave">\n' +
    '<meta property="og:description" content="' + title + ' at ' + company + '">\n' +
    '<link rel="stylesheet" href="/shared.css">\n' +
    '<style>\n' +
    'body { min-height: 100dvh; display: flex; align-items: center; justify-content: center; font-family: var(--font-body); background: var(--color-bg); color: var(--color-text); padding: 2rem; }\n' +
    '.card { max-width: 380px; width: 100%; border-radius: 1.5rem; border: 1px solid var(--color-border); background: var(--color-surface); overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3); }\n' +
    '.card-accent { height: 4px; background: linear-gradient(135deg, #E8580C, #FF8C42); }\n' +
    '.card-body { padding: 2rem; text-align: center; }\n' +
    '.avatar { width: 96px; height: 96px; border-radius: 50%; background: linear-gradient(135deg, #E8580C, #FF8C42); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-family: var(--font-display); font-size: 1.75rem; color: white; overflow: hidden; border: 3px solid rgba(255,255,255,0.08); }\n' +
    '.avatar img { width: 100%; height: 100%; object-fit: cover; object-position: ' + esc(m.photoObjectPosition || 'center 18%') + '; }\n' +
    '.name { font-family: var(--font-display); font-size: 1.75rem; letter-spacing: 0.04em; color: var(--color-primary); }\n' +
    '.role { font-size: 0.875rem; color: var(--color-text-muted); margin-top: 0.25rem; }\n' +
    '.company { font-size: 1rem; color: var(--color-text); margin-top: 0.75rem; font-weight: 600; }\n' +
    '.divider { height: 1px; background: var(--color-divider); margin: 1.5rem 0; }\n' +
    '.badge { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 999px; border: 1px solid var(--color-border); font-size: 0.75rem; color: var(--color-text-muted); }\n' +
    '.link { display: block; margin-top: 1rem; padding: 0.75rem 1.5rem; border-radius: 0.75rem; background: rgba(232, 88, 12, 0.15); color: var(--color-primary); font-weight: 600; text-decoration: none; font-size: 0.875rem; transition: background 0.2s; }\n' +
    '.link:hover { background: rgba(232, 88, 12, 0.25); }\n' +
    '.back { display: block; text-align: center; margin-top: 1.5rem; font-size: 0.75rem; color: var(--color-text-muted); text-decoration: none; }\n' +
    '.back:hover { color: var(--color-primary); }\n' +
    '</style>\n' +
    '</head><body data-theme="dark">\n' +
    '<div>\n' +
    '<div class="card" data-haptic="light">\n' +
    '  <div class="card-accent"></div>\n' +
    '  <div class="card-body">\n' +
    '    <div class="avatar">' + (safePhoto ? '<img src="' + safePhoto + '" alt="' + name + '">' : esc(initials)) + '</div>\n' +
    '    <div class="name">' + name + '</div>\n' +
    '    <div class="role">' + title + '</div>\n' +
    '    <div class="company">' + company + '</div>\n' +
    '    <div class="divider"></div>\n' +
    '    <div class="badge">🔥 RDU Heatwave &middot; 212 Referral Network</div>\n' +
    (safeUrl ? '    <a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" class="link">' + websiteDisplay + ' &rarr;</a>\n' : '') +
    '  </div>\n' +
    '</div>\n' +
    '<a href="/" class="back">&larr; rduheatwave.team</a>\n' +
    '</div>\n' +
    '<script src="/scripts/scroll-reveal.js"></' + 'script>\n' +
    '</body></html>';
}
