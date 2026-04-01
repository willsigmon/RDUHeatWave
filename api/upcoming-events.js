'use strict';

var shared = require('./_lib/shared');

var CACHE_HEADER = 'public, max-age=0, s-maxage=300, stale-while-revalidate=600';
var MEETING_TIME_ZONE = 'America/New_York';
var MEETING_DAY = 4; // Thursday
var MEETING_HOUR = 15;
var MEETING_MIN = 45;
var MEETING_DURATION = 75 * 60 * 1000;
var FALLBACK_LOCATION = 'Clouds Brewing Taproom, 1233 Front St, Raleigh, NC 27609, USA';
var DEFAULT_LIMIT = 4;
var MAX_LIMIT = 6;

function clampLimit(value) {
  var parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)));
}

function getDateParts(date, timeZone) {
  var parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  var mapped = {};
  parts.forEach(function(part) {
    if (part.type !== 'literal') mapped[part.type] = part.value;
  });
  return mapped;
}

function weekdayToNumber(weekday) {
  return {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  }[weekday] || 0;
}

function getMeetingOffsetMs(date) {
  var parts = getDateParts(date, MEETING_TIME_ZONE);
  var zonedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour || '0'),
    Number(parts.minute || '0'),
    0
  );
  return zonedAsUtc - date.getTime();
}

function getMeetingTimestamp(year, month, day, hour, minute) {
  var utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  var offset = getMeetingOffsetMs(new Date(utcGuess));
  var timestamp = utcGuess - offset;
  var refinedOffset = getMeetingOffsetMs(new Date(timestamp));
  if (refinedOffset !== offset) {
    timestamp = utcGuess - refinedOffset;
  }
  return timestamp;
}

function buildFallbackEvents(limit) {
  var now = new Date();
  var parts = getDateParts(now, MEETING_TIME_ZONE);
  var todayUtc = new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day)
  ));

  var weekday = weekdayToNumber(parts.weekday);
  var currentMinutes = (Number(parts.hour || '0') * 60) + Number(parts.minute || '0');
  var meetingEndMinutes = (MEETING_HOUR * 60) + MEETING_MIN + (MEETING_DURATION / 60000);
  var daysUntil = (MEETING_DAY - weekday + 7) % 7;
  if (daysUntil === 0 && currentMinutes >= meetingEndMinutes) {
    daysUntil = 7;
  }

  var events = [];
  for (var i = 0; i < limit; i += 1) {
    var meetingDate = new Date(todayUtc);
    meetingDate.setUTCDate(meetingDate.getUTCDate() + daysUntil + (i * 7));

    var year = meetingDate.getUTCFullYear();
    var month = meetingDate.getUTCMonth() + 1;
    var day = meetingDate.getUTCDate();
    var startTs = getMeetingTimestamp(year, month, day, MEETING_HOUR, MEETING_MIN);

    events.push({
      title: 'RDU Heatwave Meeting',
      start: new Date(startTs).toISOString(),
      end: new Date(startTs + MEETING_DURATION).toISOString(),
      location: FALLBACK_LOCATION,
      description: 'Weekly networking meeting for RDU Heatwave at Clouds Brewing.',
      allDay: false
    });
  }

  return events;
}

function normalizeEvents(payload, limit) {
  var rawEvents = Array.isArray(payload && payload.events) ? payload.events : [];
  return rawEvents.map(function(event) {
    return {
      title: shared.normalizeText(event.title || event.summary) || 'Upcoming Event',
      start: shared.normalizeText(event.start),
      end: shared.normalizeText(event.end),
      location: shared.normalizeText(event.location),
      description: shared.normalizeText(event.description),
      allDay: !!event.allDay
    };
  }).filter(function(event) {
    return event.start && !Number.isNaN(new Date(event.start).getTime());
  }).sort(function(a, b) {
    return new Date(a.start).getTime() - new Date(b.start).getTime();
  }).slice(0, limit);
}

async function fetchAppsScriptEvents(limit) {
  var url = new URL(shared.getAppsScriptUrl());
  url.searchParams.set('resource', 'upcomingevents');
  url.searchParams.set('limit', String(limit));

  var controller = new AbortController();
  var timeoutId = setTimeout(function() { controller.abort(); }, 8000);

  try {
    var response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'follow',
      signal: controller.signal
    });

    if (!response.ok) {
      var requestError = new Error('Apps Script request failed: ' + response.status);
      requestError.code = 'APPS_SCRIPT_REQUEST_FAILED';
      throw requestError;
    }

    var text = await response.text();
    var payload;
    try {
      payload = JSON.parse(text);
    } catch (_parseError) {
      var invalidPayloadError = new Error('Apps Script returned a non-JSON payload');
      invalidPayloadError.code = 'APPS_SCRIPT_FALLBACK';
      throw invalidPayloadError;
    }

    var events = normalizeEvents(payload, limit);

    if (!events.length) {
      var noEventsError = new Error('No calendar events returned');
      noEventsError.code = 'APPS_SCRIPT_FALLBACK';
      throw noEventsError;
    }

    return {
      status: 'ok',
      source: 'apps-script',
      events: events
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'HEAD') return shared.handleHead(res, CACHE_HEADER);
  if (req.method === 'OPTIONS') return shared.handleOptions(res, ['GET', 'HEAD', 'OPTIONS'], CACHE_HEADER);
  if (req.method !== 'GET') return shared.handleMethodNotAllowed(req, res, ['GET', 'HEAD', 'OPTIONS']);

  var limit = clampLimit(req.query && req.query.limit);

  try {
    var payload = await fetchAppsScriptEvents(limit);
    return shared.sendCachedJson(res, 200, payload);
  } catch (error) {
    if (!error || error.code !== 'APPS_SCRIPT_FALLBACK') {
      console.error('[api/upcoming-events]', error);
    }
  }

  return shared.sendCachedJson(res, 200, {
    status: 'ok',
    source: 'fallback',
    events: buildFallbackEvents(limit)
  });
};
