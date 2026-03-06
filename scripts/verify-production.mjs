#!/usr/bin/env node

const base = (process.argv[2] || 'https://rduheatwave.team').replace(/\/$/, '');
const timestamp = Date.now();

function ok(label, detail = '') {
  console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label, detail = '') {
  console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
  process.exitCode = 1;
}

async function fetchText(path, options) {
  const response = await fetch(`${base}${path}`, options);
  return { response, text: await response.text() };
}

async function fetchJson(path, options) {
  const response = await fetch(`${base}${path}`, options);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (error) {
    // handled by caller
  }
  return { response, text, json };
}

function expect(condition, label, detail) {
  if (condition) ok(label, detail);
  else fail(label, detail);
}

(async function run() {
  const paths = [
    ['/', ['text/html']],
    ['/meet', ['text/html']],
    ['/agenda', ['text/html']],
    ['/api/checkin', ['application/json']],
    ['/robots.txt', ['text/plain']],
    ['/sitemap.xml', ['application/xml']],
    ['/site.webmanifest', ['application/manifest+json']],
    ['/favicon.ico', ['image/x-icon', 'image/vnd.microsoft.icon']],
    ['/icons/heatwave-icon-192.png', ['image/png']]
  ];

  for (const [path, expectedTypes] of paths) {
    const response = await fetch(`${base}${path}`);
    expect(response.ok, `${path} returns 200`, String(response.status));
    const type = response.headers.get('content-type') || '';
    expect(expectedTypes.some((expectedType) => type.includes(expectedType)), `${path} content-type`, type || 'missing');
  }

  const { response: homeResponse, text: homeHtml } = await fetchText('/');
  expect(homeResponse.headers.get('content-security-policy'), 'home has CSP header', homeResponse.headers.get('content-security-policy') || 'missing');
  expect(homeResponse.headers.get('referrer-policy') === 'strict-origin-when-cross-origin', 'home has referrer-policy', homeResponse.headers.get('referrer-policy') || 'missing');
  expect(homeResponse.headers.get('x-content-type-options') === 'nosniff', 'home has nosniff', homeResponse.headers.get('x-content-type-options') || 'missing');
  expect(homeHtml.includes('/api/checkin'), 'home points at /api/checkin');
  expect(homeHtml.includes('/site.webmanifest'), 'home links manifest');
  expect(homeHtml.includes('icons/heatwave-icon-512.png'), 'home has OG image');

  const validPayload = {
    firstName: 'Smoke',
    lastName: 'Check',
    profession: 'QA',
    phone: '555-0110',
    email: `smoke-${timestamp}@example.com`,
    guestOf: 'Automated Check'
  };

  const valid = await fetchJson('/api/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload)
  });
  expect(valid.response.status === 200, 'valid check-in returns 200', String(valid.response.status));
  expect(valid.json && valid.json.status === 'ok', 'valid check-in returns status ok', valid.text);

  const badJson = await fetchJson('/api/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json'
  });
  expect(badJson.response.status === 400, 'invalid JSON returns 400', String(badJson.response.status));

  const invalidEmail = await fetchJson('/api/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...validPayload, email: 'not-an-email' })
  });
  expect(invalidEmail.response.status === 400, 'invalid email returns 400', String(invalidEmail.response.status));

  if (process.exitCode) {
    console.error(`\nVerification failed for ${base}`);
    process.exit(process.exitCode);
  }

  console.log(`\nAll production checks passed for ${base}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
