(function () {
  // ── Config ────────────────────────────────────────────────
  // First meeting: Thursday, January 9, 2025 (adjust if needed)
  var SITE_CONFIG = window.HEATWAVE_SITE_CONFIG || {};
  var MEETING_CONFIG = SITE_CONFIG.meeting || {};
  var CURRENT_SPEAKER_CONFIG = SITE_CONFIG.currentSpeaker || {};
  var PUBLIC_STATS = SITE_CONFIG.publicStats || {};
  var ROTATION = SITE_CONFIG.speakerRotation || {};
  var params = new URLSearchParams(window.location.search);
  var isAdminMode = params.get('mode') === 'admin' ||
    params.get('view') === 'admin' ||
    params.get('admin') === '1' ||
    /\/agenda\/admin\/?$/.test(window.location.pathname);
  var isPublicMode = !isAdminMode;
  var FIRST_MEETING = new Date('2025-01-09T00:00:00');
  var MEETING_TIME  = MEETING_CONFIG.publicTimeShort || '4:00 PM';
  var MEETING_VENUE = MEETING_CONFIG.venueName || 'Clouds Brewing';

  window.HEATWAVE_AGENDA_ADMIN_MODE = isAdminMode;
  document.body.classList.toggle('agenda-admin-mode', isAdminMode);
  document.body.classList.toggle('agenda-public-mode', !isAdminMode);

  // ── Next-Thursday calculation (ET-aware) ──────────────────
  // Get today's date in America/New_York so we don't shift on
  // the day of the meeting due to the viewer's local timezone.
  function todayInET() {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    var p = {};
    parts.forEach(function (x) { p[x.type] = x.value; });
    return new Date(p.year + '-' + p.month + '-' + p.day + 'T00:00:00');
  }

  function nextThursday(from) {
    var d = new Date(from);
    var dow = d.getDay(); // 0=Sun … 4=Thu
    var diff = dow === 4 ? 0 : (4 - dow + 7) % 7;
    d.setDate(d.getDate() + diff);
    return d;
  }

  function formatLong(d) {
    return d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
  }

  function formatShort(d) {
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'numeric', day: 'numeric', year: 'numeric'
    });
  }

  // ── Meeting number ────────────────────────────────────────
  function meetingNumber(meetingDate) {
    var ms = meetingDate - FIRST_MEETING;
    if (ms < 0) return 1;
    return Math.round(ms / (7 * 24 * 60 * 60 * 1000)) + 1;
  }

  // ── Inject ────────────────────────────────────────────────
  var today = todayInET();
  var meeting = nextThursday(today);
  var num = meetingNumber(meeting);

  var dateMeta = document.getElementById('meeting-date-meta');
  var meetingLabel = formatLong(meeting) + ' \u2022 ' + MEETING_TIME + ' \u2022 ' + MEETING_VENUE;
  if (dateMeta) {
    dateMeta.textContent = meetingLabel;
  }

  var paperlessDateMeta = document.getElementById('paperless-date-meta');
  if (paperlessDateMeta) {
    paperlessDateMeta.textContent = meetingLabel + '. Keep this open during the meeting when paper agendas are unavailable.';
  }

  var statsAsOfEl = document.getElementById('stats-as-of');
  if (statsAsOfEl) {
    statsAsOfEl.textContent = 'Stats updated through ' + (PUBLIC_STATS.asOf || 'April 23, 2026');
  }

  var footerMeta = document.getElementById('footer-date-meta');
  if (footerMeta) {
    var short = formatShort(meeting);
    var revised = new Date().toLocaleDateString('en-US', {
      month: 'numeric', day: 'numeric', year: 'numeric'
    });
    footerMeta.textContent = 'Prepared for ' + short + ' \u25c6 Revised ' + revised;
  }

  // ── Speaker rotation ──────────────────────────────────────
  var getSpeaker = ROTATION.getSpeakerForMeeting;
  var rotationSpeaker = getSpeaker ? getSpeaker(meeting) : null;
  var defaultName = rotationSpeaker ? rotationSpeaker.name : (CURRENT_SPEAKER_CONFIG.name || 'Will Sigmon');
  var defaultCompany = rotationSpeaker ? rotationSpeaker.company : (CURRENT_SPEAKER_CONFIG.company || 'Will Sigmon Media');

  var speaker = (params.get('speaker') || defaultName).trim();
  var speakerCompany = (params.get('company') || defaultCompany).trim();
  var venueBar = document.querySelector('.venue-bar');
  if (venueBar) {
    venueBar.innerHTML = '<strong>' + (MEETING_CONFIG.venueName || 'Clouds Brewing') + '</strong>' +
      '<span class="venue-dot">&#9670;</span>' +
      (MEETING_CONFIG.venueAddressShort || '1233 Front St, Raleigh NC') +
      '<span class="venue-dot">&#9670;</span>' +
      (MEETING_CONFIG.supportMessage || 'Please stay for a drink after the meeting to support the brewery &mdash; they provide our space at no cost.');
  }
  // Mentor Moment
  var mentorName = SITE_CONFIG.currentMentor || '';
  var mentorItem = document.getElementById('mentor-agenda-item');
  if (mentorItem && mentorName) {
    mentorItem.textContent = 'Mentor Moment \u2014 ' + mentorName;
  }

  if (speaker) {
    // Agenda list item
    var spotlightItem = document.getElementById('spotlight-agenda-item');
    if (spotlightItem) {
      spotlightItem.textContent = 'Member Spotlight \u2014 ' + speaker;
    }

    // Spotlight card hero name (right column)
    var heroName = document.querySelector('.spotlight-hero-name');
    if (heroName) heroName.textContent = speaker;

    var heroCompany = document.querySelector('.spotlight-hero-prof');
    if (heroCompany && speakerCompany) heroCompany.textContent = speakerCompany;

    var paperlessSpeaker = document.getElementById('paperless-speaker-name');
    if (paperlessSpeaker) paperlessSpeaker.textContent = speaker;
  }

  var paperlessMentor = document.getElementById('paperless-mentor-name');
  if (paperlessMentor) paperlessMentor.textContent = mentorName || 'TBA';

  // ── Tip of the week ───────────────────────────────────────
  var TIPS = [
    '\u201CDon\u2019t ask for \u2018anyone.\u2019 Ask for one specific introduction. Specific asks are easier to remember, repeat, and actually send.\u201D',
    '\u201CThe best referral isn\u2019t a name\u2014it\u2019s context. Tell them why you\u2019re connecting them and what they have in common.\u201D',
    '\u201CFollow up within 24 hours. Speed signals that you value the relationship, not just the referral.\u201D',
    '\u201CBefore asking for a referral, give one. Generosity creates momentum.\u201D',
    '\u201CYour 30-second intro should make people curious, not confused. One clear problem you solve, one memorable line.\u201D',
    '\u201CA BizChat isn\u2019t a sales pitch\u2014it\u2019s a chance to learn someone\u2019s business well enough to spot opportunities for them.\u201D',
    '\u201CWhen you pass a referral, follow up with both sides. Closing the loop builds trust faster than anything.\u201D',
    '\u201CDon\u2019t wait for the perfect referral. A warm introduction to the right person is worth more than a cold lead to the perfect one.\u201D',
    '\u201CKeep a running list of who your teammates serve best. The easiest referral is the one you already know fits.\u201D',
    '\u201CShow up consistently. Trust compounds\u2014people refer the person they see every week, not the one who drops in once a month.\u201D',
    '\u201CAfter every meeting you attend outside this room, ask yourself: who here would benefit from knowing someone on my team?\u201D'
  ];
  var tipIndex = ((num - 1) % TIPS.length + TIPS.length) % TIPS.length;
  var tipEl = document.getElementById('tip-of-week');
  if (tipEl) tipEl.textContent = TIPS[tipIndex];

  // ── Upcoming speakers ────────────────────────────────────
  if (getSpeaker) {
    for (var i = 1; i <= 3; i++) {
      var futureDate = new Date(meeting);
      futureDate.setDate(futureDate.getDate() + (i * 7));
      var futureSpeaker = getSpeaker(futureDate);
      var el = document.getElementById('upcoming-' + i);
      if (el && futureSpeaker) el.textContent = futureSpeaker.name;
    }
  }
})();

(function () {
  var STORAGE_KEY = 'rduheatwave.agenda.manualStats.v2';
  var SITE_CONFIG = window.HEATWAVE_SITE_CONFIG || {};
  var PUBLIC_STATS = SITE_CONFIG.publicStats || {};
  var statEls = Array.prototype.slice.call(document.querySelectorAll('[data-stat-key]'));
  var resetButton = document.getElementById('reset-agenda-stats');
  var statusEl = document.getElementById('manual-stats-status');
  var isAdminMode = !!window.HEATWAVE_AGENDA_ADMIN_MODE;
  var manualStatsActive = false;
  var latestLiveStats = null;
  var defaultStats = {};

  function updateStatus(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function readSavedStats() {
    try {
      var raw = window.localStorage && window.localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function writeSavedStats(stats) {
    try {
      if (!window.localStorage) return;
      var keys = Object.keys(stats).filter(function (key) {
        return stats[key] != null && String(stats[key]).trim() !== '';
      });
      if (keys.length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      var cleaned = {};
      keys.forEach(function (key) {
        cleaned[key] = String(stats[key]).trim();
      });
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    } catch (error) {
      // Manual edits should still work for the current print even if storage is blocked.
    }
  }

  function getCurrentStats() {
    return statEls.reduce(function (stats, el) {
      var key = el.getAttribute('data-stat-key');
      if (!key) return stats;
      stats[key] = el.textContent.replace(/\s+/g, ' ').trim();
      return stats;
    }, {});
  }

  function applyStats(stats, source) {
    statEls.forEach(function (el) {
      var key = el.getAttribute('data-stat-key');
      if (!key || stats[key] == null || String(stats[key]).trim() === '') return;
      el.textContent = String(stats[key]).trim();
      if (source === 'manual') {
        el.setAttribute('data-manual', 'true');
      } else {
        el.removeAttribute('data-manual');
      }
    });
  }

  function markManualStats() {
    manualStatsActive = true;
    statEls.forEach(function (el) {
      el.setAttribute('data-manual', 'true');
    });
    writeSavedStats(getCurrentStats());
    updateStatus('Using manual stats. They will print as shown.');
  }

  function pastePlainText(event) {
    event.preventDefault();
    var text = '';
    if (event.clipboardData) {
      text = event.clipboardData.getData('text/plain');
    } else if (window.clipboardData) {
      text = window.clipboardData.getData('Text');
    }
    document.execCommand('insertText', false, text.replace(/\s+/g, ' ').trim());
  }

  function selectStatText(el) {
    if (!window.getSelection || !document.createRange) return;
    var range = document.createRange();
    range.selectNodeContents(el);
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function bindEditableStats() {
    if (!isAdminMode) {
      statEls.forEach(function (el) {
        el.setAttribute('contenteditable', 'false');
        el.removeAttribute('inputmode');
        el.removeAttribute('role');
      });
      return;
    }

    statEls.forEach(function (el) {
      el.addEventListener('focus', function () {
        window.setTimeout(function () { selectStatText(el); }, 0);
      });
      el.addEventListener('input', markManualStats);
      el.addEventListener('blur', function () {
        el.textContent = el.textContent.replace(/\s+/g, ' ').trim() || '—';
        if (manualStatsActive) writeSavedStats(getCurrentStats());
      });
      el.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          el.blur();
        }
      });
      el.addEventListener('paste', pastePlainText);
    });
  }

  function formatNumber(value) {
    if (value == null || value === '') return '—';
    var number = Number(value);
    return isFinite(number) ? number.toLocaleString('en-US') : String(value);
  }

  function formatCurrency(value) {
    if (value == null || value === '') return '—';
    var number = Number(value);
    return isFinite(number) ? '$' + number.toLocaleString('en-US') : String(value);
  }

  function parseStatNumber(value) {
    var number = Number(String(value == null ? '' : value).replace(/[^0-9.-]/g, ''));
    return isFinite(number) ? number : 0;
  }

  function getVerifiedStats() {
    return Object.assign({}, defaultStats, {
      members: formatNumber(PUBLIC_STATS.members != null ? PUBLIC_STATS.members : defaultStats.members),
      guests: formatNumber(PUBLIC_STATS.guestVisits != null ? PUBLIC_STATS.guestVisits : defaultStats.guests),
      bizChats: formatNumber(PUBLIC_STATS.bizChats != null ? PUBLIC_STATS.bizChats : defaultStats.bizChats),
      referrals: formatNumber(PUBLIC_STATS.referralsPassed != null ? PUBLIC_STATS.referralsPassed : defaultStats.referrals),
      gis: formatNumber(PUBLIC_STATS.totalGis != null ? PUBLIC_STATS.totalGis : defaultStats.gis),
      revenue: formatCurrency(PUBLIC_STATS.closedRevenue != null ? PUBLIC_STATS.closedRevenue : defaultStats.revenue)
    });
  }

  function maxNumberStat(apiValue, verifiedValue) {
    return formatNumber(Math.max(parseStatNumber(apiValue), parseStatNumber(verifiedValue)));
  }

  function maxCurrencyStat(apiValue, verifiedValue) {
    return formatCurrency(Math.max(parseStatNumber(apiValue), parseStatNumber(verifiedValue)));
  }

  function statsFromApi(data) {
    var s = data && data.stats ? data.stats : {};
    var verified = getVerifiedStats();
    var apiGuestValue = s.guestVisits != null ? s.guestVisits : s.guestsHosted;
    var apiReferralValue = s.referralsPassed != null ? s.referralsPassed : s.referrals;
    var apiGiValue = s.totalGis != null ? s.totalGis : (s.gratitudeIncentives != null ? s.gratitudeIncentives : s.guestIncentives);
    var apiRevenueValue = s.closedRevenue != null ? s.closedRevenue : s.revenue;

    return Object.assign({}, verified, {
      members: verified.members,
      guests: maxNumberStat(apiGuestValue, verified.guests),
      bizChats: maxNumberStat(s.bizChats, verified.bizChats),
      referrals: maxNumberStat(apiReferralValue, verified.referrals),
      gis: maxNumberStat(apiGiValue, verified.gis),
      revenue: maxCurrencyStat(apiRevenueValue, verified.revenue)
    });
  }

  function applyVerifiedStats() {
    latestLiveStats = getVerifiedStats();
    if (!manualStatsActive) {
      applyStats(latestLiveStats, 'live');
      updateStatus('Using verified stats through ' + (PUBLIC_STATS.asOf || 'April 23, 2026') + '. Click a number to override.');
    }
  }

  function fetchLiveStats() {
    applyVerifiedStats();

    return fetch('/api/stats').then(function (response) {
      if (!response.ok) throw new Error('Stats unavailable');
      return response.json();
    }).then(function (data) {
      if (!data || data.status !== 'ok' || !data.stats) throw new Error('Stats unavailable');
      latestLiveStats = statsFromApi(data);
      if (!manualStatsActive) {
        applyStats(latestLiveStats, 'live');
        updateStatus('Using verified stats. Live stats will only raise numbers when newer.');
      }
      return latestLiveStats;
    }).catch(function () {
      updateStatus(manualStatsActive ? 'Using manual stats. Live stats are unavailable.' : 'Using verified stats. Live stats are unavailable.');
      return null;
    });
  }

  bindEditableStats();
  defaultStats = getCurrentStats();

  if (isAdminMode) {
    var savedStats = readSavedStats();
    if (Object.keys(savedStats).length > 0) {
      manualStatsActive = true;
      applyStats(savedStats, 'manual');
      updateStatus('Using saved manual stats. They will print as shown.');
    }
  }

  if (resetButton && isAdminMode) {
    resetButton.addEventListener('click', function () {
      manualStatsActive = false;
      writeSavedStats({});
      statEls.forEach(function (el) { el.removeAttribute('data-manual'); });
      updateStatus('Manual stats cleared. Loading verified stats…');
      latestLiveStats = getVerifiedStats();
      applyStats(latestLiveStats, 'live');
      updateStatus('Using verified stats through ' + (PUBLIC_STATS.asOf || 'April 23, 2026') + '. Click a number to override.');
      fetchLiveStats();
    });
  }

  fetchLiveStats();
})();

(function () {
  var STORAGE_KEY = 'rduheatwave.agenda.typedNotes.v1';
  var noteEls = Array.prototype.slice.call(document.querySelectorAll('[data-note-key]'));
  if (noteEls.length === 0) return;

  function readSavedNotes() {
    try {
      var raw = window.localStorage && window.localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function cleanText(value) {
    return String(value == null ? '' : value)
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function collectNotes() {
    return noteEls.reduce(function (notes, el) {
      var key = el.getAttribute('data-note-key');
      if (!key) return notes;
      var value = cleanText(el.textContent);
      if (value) notes[key] = value;
      return notes;
    }, {});
  }

  function writeSavedNotes() {
    try {
      if (!window.localStorage) return;
      var notes = collectNotes();
      if (Object.keys(notes).length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (error) {
      // Notes still remain visible for the current session if storage is blocked.
    }
  }

  function markFilled(el) {
    if (cleanText(el.textContent)) {
      el.setAttribute('data-filled', 'true');
    } else {
      el.removeAttribute('data-filled');
    }
  }

  function pastePlainText(event) {
    event.preventDefault();
    var text = '';
    if (event.clipboardData) {
      text = event.clipboardData.getData('text/plain');
    } else if (window.clipboardData) {
      text = window.clipboardData.getData('Text');
    }
    document.execCommand('insertText', false, cleanText(text));
  }

  var savedNotes = readSavedNotes();
  noteEls.forEach(function (el) {
    var key = el.getAttribute('data-note-key');
    if (key && savedNotes[key]) {
      el.textContent = savedNotes[key];
    }
    markFilled(el);

    el.addEventListener('input', function () {
      markFilled(el);
      writeSavedNotes();
    });

    el.addEventListener('blur', function () {
      el.textContent = cleanText(el.textContent);
      markFilled(el);
      writeSavedNotes();
    });

    el.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        el.blur();
      }
    });

    el.addEventListener('paste', pastePlainText);
  });
})();
