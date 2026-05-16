'use strict';

var shared = require('./_lib/shared');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return shared.handleOptions(res, ['GET', 'POST']);
  return shared.sendJson(res, 410, {
    status: 'gone',
    message: 'This one-time meeting import endpoint has been retired.'
  });
};
