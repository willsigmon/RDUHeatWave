(function() {
  'use strict';

  var SITE_CONFIG = window.HEATWAVE_SITE_CONFIG || {};
  var MEETING_CONFIG = SITE_CONFIG.meeting || {};

  // ===== EMBER PARTICLES =====
  var embersContainer = document.getElementById('embers-container');
  var EMBER_INTERVAL = 800;

  function spawnEmber() {
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

  setInterval(spawnEmber, EMBER_INTERVAL);

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

  if (networkingTimeEl) networkingTimeEl.textContent = MEETING_CONFIG.networkingTimeShort || '3:45 PM';
  if (meetingTimeEl) meetingTimeEl.textContent = MEETING_CONFIG.publicTimeShort || '4:00 PM';
  if (connectTimeEl) connectTimeEl.textContent = MEETING_CONFIG.connectTimeShort || '5:00 PM';
  if (kioskVenueEl && MEETING_CONFIG.venueLineShort) {
    kioskVenueEl.innerHTML = '<strong>' + (MEETING_CONFIG.venueName || 'Clouds Brewing') + '</strong> &bull; ' + (MEETING_CONFIG.venueAddressShort || '1233 Front St, Raleigh NC');
  }

  datetimeEl.textContent = meeting.dateStr + ' \u2022 ' + MEETING_TIME_LABEL;

  function updateCountdown() {
    var now = Date.now();
    var diff = meeting.timestamp - now;

    if (diff <= 0) {
      countdownGrid.style.display = 'none';
      statusEl.style.display = 'block';
      if (diff > -2 * 60 * 60 * 1000) {
        statusEl.textContent = 'MEETING IN PROGRESS';
      } else {
        meeting = getNextMeeting();
        datetimeEl.textContent = meeting.dateStr + ' \u2022 ' + MEETING_TIME_LABEL;
        countdownGrid.style.display = 'grid';
        statusEl.style.display = 'none';
      }
      return;
    }

    var days = Math.floor(diff / (1000 * 60 * 60 * 24));
    var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    var secs = Math.floor((diff % (1000 * 60)) / 1000);

    document.getElementById('cd-days').textContent = String(days).padStart(2, '0');
    document.getElementById('cd-hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('cd-mins').textContent = String(mins).padStart(2, '0');
    document.getElementById('cd-secs').textContent = String(secs).padStart(2, '0');
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

  // ===== LIVE CLOCK =====
  var kioskTimeEl = document.getElementById('kiosk-time');
  var kioskDateEl = document.getElementById('kiosk-date');
  function updateKioskClock() {
    var now = new Date();
    var opts = { timeZone: MEETING_TIME_ZONE };
    kioskTimeEl.textContent = now.toLocaleTimeString('en-US', Object.assign({ hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }, opts));
    kioskDateEl.textContent = now.toLocaleDateString('en-US', Object.assign({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }, opts));
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
    var tickerHtml = '';
    var tickerItems = buildTickerItems();
    for (var t = 0; t < 2; t++) {
      tickerItems.forEach(function(item) {
        tickerHtml += '<span class="kiosk-ticker-item"><span class="ticker-dot"></span>' + item + '</span>';
      });
    }
    tickerTrack.innerHTML = tickerHtml;
  }
  renderTicker();

  fetch('/api/members')
    .then(function(response) {
      if (!response.ok) throw new Error('members unavailable');
      return response.json();
    })
    .then(function(data) {
      if (!data || !Array.isArray(data.members) || !data.members.length) return;
      activeMemberCount = data.members.length;
      renderTicker();
    })
    .catch(function() { /* keep fallback ticker count */ });

})();
