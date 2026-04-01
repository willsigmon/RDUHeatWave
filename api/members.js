'use strict';

var shared = require('./_lib/shared');
var memberDirectory = require('./_lib/member-directory');

var SHEET_ID = '1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA';
var SHEET_NAME = 'Membership Directory';
var CACHE_HEADER = 'public, max-age=0, s-maxage=300, stale-while-revalidate=600';

module.exports = async function handler(req, res) {
  if (req.method === 'HEAD') return shared.handleHead(res, CACHE_HEADER);
  if (req.method === 'OPTIONS') return shared.handleOptions(res, ['GET', 'HEAD', 'OPTIONS'], CACHE_HEADER);
  if (req.method !== 'GET') return shared.handleMethodNotAllowed(req, res, ['GET', 'HEAD', 'OPTIONS']);

  try {
    var members = await memberDirectory.fetchMembersFromSheet(SHEET_ID, SHEET_NAME, 8000);
    return shared.sendCachedJson(res, 200, { status: 'ok', source: 'sheet', members: members });
  } catch (error) {
    console.error('[api/members]', error);
  }

  return shared.sendCachedJson(res, 200, {
    status: 'ok',
    source: 'fallback',
    members: memberDirectory.DEFAULT_MEMBERS
  });
};
