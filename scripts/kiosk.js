(function() {
  'use strict';

  var SITE_CONFIG = window.HEATWAVE_SITE_CONFIG || {};
  var MEETING_CONFIG = SITE_CONFIG.meeting || {};

  // ===== EMBER PARTICLES =====
  var embersContainer = document.getElementById('embers-container');
  var EMBER_INTERVAL = 800;

  function spawnEmber() {
    if (!embersContainer) return;
    // Pause when tab/screen is hidden to avoid runaway DOM growth on locked kiosks
    if (document.visibilityState !== 'visible') return;
    var ember = document.createElement('div');
    ember.className = 'ember';
    var size = 3 + Math.random() * 6;
    ember.style.width = size + 'px';
    ember.style.height = size + 'px';
    ember.style.left = (Math.random() * 100) + '%';
    ember.style.animationDuration = (4 + Math.random() * 5) + 's';
    embersContainer.appendChild(ember);
    setTimeout(function() {
      if (ember.parentNode) ember.parentNode.removeChild(ember);
    }, 9000);
  }

  if (embersContainer) setInterval(spawnEmber, EMBER_INTERVAL);

  // ===== COUNTDOWN TIMER =====
  var MEETING_DAY = Number.isFinite(MEETING_CONFIG.day) ? MEETING_CONFIG.day : 4;
  var MEETING_HOUR = Number.isFinite(MEETING_CONFIG.hour) ? MEETING_CONFIG.hour : 16;
  var MEETING_MIN = Number.isFinite(MEETING_CONFIG.minute) ? MEETING_CONFIG.minute : 0;
  var MEETING_TIME_LABEL = MEETING_CONFIG.publicTimeLabel || '4:00 PM ET';
  var MEETING_TIME_ZONE = MEETING_CONFIG.timezone || 'America/New_York';
  var MEETING_DURATION = 2 * 60 * 60 * 1000;
  var meetingDateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: MEETING_TIME_ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  var meetingPartsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: MEETING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  function getMeetingParts(date) {
    var parts = {};
    meetingPartsFormatter.formatToParts(date).forEach(function(part) {
      if (part.type !== 'literal') parts[part.type] = part.value;
    });
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      second: Number(parts.second)
    };
  }

  function getMeetingOffsetMs(date) {
    var parts = getMeetingParts(date);
    var zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
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

  function getNextMeeting() {
    var eastNow = getMeetingParts(new Date());
    var todayUtc = new Date(Date.UTC(eastNow.year, eastNow.month - 1, eastNow.day));
    var dow = todayUtc.getUTCDay();
    var daysUntil = (MEETING_DAY - dow + 7) % 7;
    var meetingEndMinutes = (MEETING_HOUR * 60) + MEETING_MIN + (MEETING_DURATION / 60000);
    var currentMinutes = (eastNow.hour * 60) + eastNow.minute + (eastNow.second / 60);

    if (daysUntil === 0 && currentMinutes >= meetingEndMinutes) {
      daysUntil = 7;
    }

    todayUtc.setUTCDate(todayUtc.getUTCDate() + daysUntil);
    var year = todayUtc.getUTCFullYear();
    var month = todayUtc.getUTCMonth() + 1;
    var day = todayUtc.getUTCDate();
    var timestamp = getMeetingTimestamp(year, month, day, MEETING_HOUR, MEETING_MIN);

    return {
      timestamp: timestamp,
      dateStr: meetingDateFormatter.format(new Date(timestamp))
    };
  }

  var meeting = getNextMeeting();
  var datetimeEl = document.getElementById('meeting-datetime');
  var countdownGrid = document.getElementById('countdown-grid');
  var statusEl = document.getElementById('meeting-status');
  var networkingTimeEl = document.getElementById('schedule-networking-time');
  var meetingTimeEl = document.getElementById('schedule-meeting-time');
  var connectTimeEl = document.getElementById('schedule-connect-time');
  var kioskVenueEl = document.getElementById('kiosk-venue');
  var cdDaysEl = document.getElementById('cd-days');
  var cdHoursEl = document.getElementById('cd-hours');
  var cdMinsEl = document.getElementById('cd-mins');
  var cdSecsEl = document.getElementById('cd-secs');

  if (networkingTimeEl) networkingTimeEl.textContent = MEETING_CONFIG.networkingTimeShort || '3:45 PM';
  if (meetingTimeEl) meetingTimeEl.textContent = MEETING_CONFIG.publicTimeShort || '4:00 PM';
  if (connectTimeEl) connectTimeEl.textContent = MEETING_CONFIG.connectTimeShort || '5:00 PM';
  if (kioskVenueEl && MEETING_CONFIG.venueLineShort) {
    // Safe DOM construction (no innerHTML \u2014 values come from config, not user input,
    // but textContent + element building is XSS-proof regardless).
    while (kioskVenueEl.firstChild) kioskVenueEl.removeChild(kioskVenueEl.firstChild);
    var venueStrong = document.createElement('strong');
    venueStrong.textContent = MEETING_CONFIG.venueName || 'Clouds Brewing';
    kioskVenueEl.appendChild(venueStrong);
    kioskVenueEl.appendChild(document.createTextNode(' \u2022 ' + (MEETING_CONFIG.venueAddressShort || '1233 Front St, Raleigh NC')));
  }

  if (datetimeEl) datetimeEl.textContent = meeting.dateStr + ' \u2022 ' + MEETING_TIME_LABEL;

  function setMeetingLabel() {
    if (datetimeEl) datetimeEl.textContent = meeting.dateStr + ' \u2022 ' + MEETING_TIME_LABEL;
  }

  function updateCountdown() {
    if (!countdownGrid || !statusEl) return;
    var now = Date.now();
    var diff = meeting.timestamp - now;

    if (diff <= 0) {
      countdownGrid.style.display = 'none';
      statusEl.style.display = 'block';
      if (diff > -MEETING_DURATION) {
        statusEl.textContent = 'MEETING IN PROGRESS';
      } else {
        meeting = getNextMeeting();
        setMeetingLabel();
        countdownGrid.style.display = 'grid';
        statusEl.style.display = 'none';
      }
      return;
    }

    // Self-heal: long-running kiosks (left on overnight, across DST) can drift.
    // Recompute meeting once per minute and re-render the label if it changed.
    if (!updateCountdown._lastCheck || (now - updateCountdown._lastCheck) > 60000) {
      var fresh = getNextMeeting();
      if (fresh.timestamp !== meeting.timestamp) {
        meeting = fresh;
        setMeetingLabel();
      }
      updateCountdown._lastCheck = now;
    }

    var days = Math.floor(diff / (1000 * 60 * 60 * 24));
    var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    var secs = Math.floor((diff % (1000 * 60)) / 1000);

    if (cdDaysEl) cdDaysEl.textContent = String(days).padStart(2, '0');
    if (cdHoursEl) cdHoursEl.textContent = String(hours).padStart(2, '0');
    if (cdMinsEl) cdMinsEl.textContent = String(mins).padStart(2, '0');
    if (cdSecsEl) cdSecsEl.textContent = String(secs).padStart(2, '0');
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

  // ===== LIVE CLOCK =====
  var kioskTimeEl = document.getElementById('kiosk-time');
  var kioskDateEl = document.getElementById('kiosk-date');
  function updateKioskClock() {
    if (!kioskTimeEl && !kioskDateEl) return;
    var now = new Date();
    var opts = { timeZone: MEETING_TIME_ZONE };
    try {
      if (kioskTimeEl) {
        kioskTimeEl.textContent = now.toLocaleTimeString('en-US', Object.assign({ hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }, opts));
      }
      if (kioskDateEl) {
        kioskDateEl.textContent = now.toLocaleDateString('en-US', Object.assign({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }, opts));
      }
    } catch (e) {
      // Some older WebViews (rare on tablets) may not support timeZone option — fall back to local time
      if (kioskTimeEl) kioskTimeEl.textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
      if (kioskDateEl) kioskDateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  }
  updateKioskClock();
  setInterval(updateKioskClock, 1000);

  // ===== TICKER =====
  var activeMemberCount = 8;
  function buildTickerItems() {
    return [
      activeMemberCount + ' ACTIVE MEMBERS',
      String((MEETING_CONFIG.dayNamePlural || 'Thursdays') + ' AT ' + (MEETING_CONFIG.publicTimeLabel || '4:00 PM ET')).toUpperCase(),
      String(MEETING_CONFIG.venueCityLabel || 'Clouds Brewing • Raleigh, NC').toUpperCase(),
      'THE EXTRA DEGREE MAKES ALL THE DIFFERENCE',
      '211\u00B0 IS HOT \u2022 212\u00B0 BOILS \u2022 STEAM = POWER',
      'CATEGORY-EXCLUSIVE NETWORKING',
      'BIZCHAT \u2022 GRATITUDE INCENTIVES \u2022 ACCOUNTABILITY',
      'TRUSTED REFERRALS \u2022 REAL FOLLOW-THROUGH',
      'RDUHEATWAVE.TEAM'
    ];
  }
  var tickerTrack = document.getElementById('ticker-track');
  function renderTicker() {
    if (!tickerTrack) return;
    // Safe DOM construction — no innerHTML, no string concatenation of user-facing text.
    while (tickerTrack.firstChild) tickerTrack.removeChild(tickerTrack.firstChild);
    var tickerItems = buildTickerItems();
    for (var t = 0; t < 2; t++) {
      tickerItems.forEach(function(item) {
        var span = document.createElement('span');
        span.className = 'kiosk-ticker-item';
        var dot = document.createElement('span');
        dot.className = 'ticker-dot';
        span.appendChild(dot);
        span.appendChild(document.createTextNode(item));
        tickerTrack.appendChild(span);
      });
    }
  }
  renderTicker();

  // Member-count fetch — graceful degradation if API is down or network is flaky.
  // Use AbortController to avoid hanging requests on a slow venue Wi-Fi.
  try {
    var membersController = ('AbortController' in window) ? new AbortController() : null;
    var membersTimeout = membersController ? setTimeout(function(){ membersController.abort(); }, 6000) : null;
    fetch('/api/members', membersController ? { signal: membersController.signal } : undefined)
      .then(function(response) {
        if (!response.ok) throw new Error('members unavailable');
        return response.json();
      })
      .then(function(data) {
        if (!data || !Array.isArray(data.members) || !data.members.length) return;
        activeMemberCount = data.members.length;
        renderTicker();
      })
      .catch(function() { /* keep fallback ticker count */ })
      .finally(function() { if (membersTimeout) clearTimeout(membersTimeout); });
  } catch (e) { /* fetch unavailable — keep fallback ticker */ }

})();
