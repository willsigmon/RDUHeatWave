(function () {
  // ── Config ────────────────────────────────────────────────
  // First meeting: Thursday, January 9, 2025 (adjust if needed)
  var SITE_CONFIG = window.HEATWAVE_SITE_CONFIG || {};
  var MEETING_CONFIG = SITE_CONFIG.meeting || {};
  var CURRENT_SPEAKER_CONFIG = SITE_CONFIG.currentSpeaker || {};
  var ROTATION = SITE_CONFIG.speakerRotation || {};
  var FIRST_MEETING = new Date('2025-01-09T00:00:00');
  var MEETING_TIME  = MEETING_CONFIG.publicTimeShort || '4:00 PM';
  var MEETING_VENUE = MEETING_CONFIG.venueName || 'Clouds Brewing';

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
  if (dateMeta) {
    dateMeta.textContent = formatLong(meeting) + ' \u2022 ' + MEETING_TIME + ' \u2022 ' + MEETING_VENUE;
  }

  var numSpan = document.getElementById('meeting-number');
  if (numSpan) numSpan.textContent = num;

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

  var params = new URLSearchParams(window.location.search);
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
  if (speaker) {
    // Header pill badge
    var badge = document.getElementById('speaker-badge');
    var badgeName = document.getElementById('speaker-badge-name');
    if (badge && badgeName) {
      badgeName.textContent = speaker;
      badge.classList.add('visible');
    }

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
  }

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

// Fetch live stats
fetch('/api/stats').then(function(r) { return r.json(); }).then(function(data) {
  if (data.status !== 'ok' || !data.stats) return;
  var s = data.stats;
  var el = function(id) { return document.getElementById(id); };
  if (el('stat-guests'))    el('stat-guests').textContent = s.guestsHosted || '—';
  if (el('stat-bizchats'))  el('stat-bizchats').textContent = s.bizChats || '—';
  if (el('stat-referrals')) el('stat-referrals').textContent = s.referrals || '—';
  if (el('stat-gis'))       el('stat-gis').textContent = s.guestIncentives || '—';
  if (el('stat-revenue'))   el('stat-revenue').textContent = '$' + Number(s.revenue || 0).toLocaleString('en-US');
}).catch(function() {});

fetch('/api/members').then(function(r) { return r.json(); }).then(function(data) {
  if (data.status !== 'ok' || !Array.isArray(data.members)) return;
  var membersEl = document.getElementById('stat-members');
  if (membersEl) membersEl.textContent = data.members.length;
}).catch(function() {});
