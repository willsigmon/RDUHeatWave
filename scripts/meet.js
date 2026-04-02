(function() {
  'use strict';

  var SITE_CONFIG = window.HEATWAVE_SITE_CONFIG || {};
  var MEETING_CONFIG = SITE_CONFIG.meeting || {};
  var CURRENT_SPEAKER_CONFIG = SITE_CONFIG.currentSpeaker || {};

  var MEETING_DAY = Number.isFinite(MEETING_CONFIG.day) ? MEETING_CONFIG.day : 4;
  var MEETING_HOUR = Number.isFinite(MEETING_CONFIG.hour) ? MEETING_CONFIG.hour : 16;
  var MEETING_MIN = Number.isFinite(MEETING_CONFIG.minute) ? MEETING_CONFIG.minute : 0;
  var MEETING_TIME_LABEL = MEETING_CONFIG.publicTimeLabel || '4:00 PM ET';
  var MEETING_PUBLIC_TIME_SHORT = MEETING_CONFIG.publicTimeShort || '4:00 PM';
  var MEETING_TIME_ZONE = MEETING_CONFIG.timezone || 'America/New_York';
  var PREHEAT_WINDOW_SECS = 15 * 60;
  var WARMUP_SECS = 300;
  var HORN_DURATION = 30 * 1000;
  var MEETING_DURATION = 1 * 60 * 60 * 1000;
  var CARD_INTERVAL = 10000;
  var CARD_SETTLE_DELAY = 1200;

  /* ──────────────────────────────────────────────
   *  TEAM STATS — fetched live from /api/stats
   * ────────────────────────────────────────────── */
  var STATS_BIZCHAT    = 207;
  var STATS_GUESTS     = 113;
  var STATS_REVENUE    = '$115,331';
  var STATS_REFERRALS  = 49;
  var STATS_GIS        = 158;

  function formatCurrency(n) {
    return '$' + Number(n).toLocaleString('en-US');
  }

  function buildTicker() {
    var items = [
      '\uD83D\uDCAC ' + STATS_BIZCHAT + ' BIZCHATS',
      '\uD83E\uDD1D ' + STATS_GUESTS + ' GUESTS HOSTED',
      '\uD83D\uDCB0 ' + STATS_REVENUE + ' REVENUE GENERATED',
      '\uD83D\uDCE8 ' + STATS_REFERRALS + ' REFERRALS PASSED',
      '\uD83C\uDF1F ' + STATS_GIS + ' GRATITUDE INCENTIVES RECEIVED',
      '\uD83D\uDD25 ROLLING 12-MONTH STATS \u2014 RDU HEATWAVE'
    ];
    var sep = '<span class="ticker-sep">\u2022</span>';
    var html = items.map(function(t) { return '<span class="ticker-stat">' + t + '</span>'; }).join(sep);
    document.getElementById('ticker-content').innerHTML = html + sep + html;
  }

  // Render immediately with defaults, then update with live data
  buildTicker();

  var liveStatsPromise = null;
  function fetchStatsOnce() {
    if (!liveStatsPromise) {
      liveStatsPromise = fetch('/api/stats')
        .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .catch(function() { return null; });
    }
    return liveStatsPromise;
  }

  fetchStatsOnce().then(function(data) {
    if (data && data.status === 'ok' && data.stats) {
      STATS_BIZCHAT  = data.stats.bizChats || STATS_BIZCHAT;
      STATS_GUESTS   = data.stats.guestsHosted || STATS_GUESTS;
      STATS_REVENUE  = formatCurrency(data.stats.revenue || 0);
      STATS_REFERRALS = data.stats.referrals || STATS_REFERRALS;
      STATS_GIS      = data.stats.guestIncentives || STATS_GIS;
      buildTicker();
    }
  }).catch(function() {});

  var PHASE = { COUNTDOWN: 0, WARMUP: 1, HORN: 2, LIVE: 3, OVER: 4 };

  /* ── Speaker config via URL params ──────────────────────────────── */
  var _qp = new URLSearchParams(window.location.search);
  var DEFAULT_SPEAKER_NAME = CURRENT_SPEAKER_CONFIG.name || 'Will Sigmon';
  var DEFAULT_SPEAKER_COMPANY = CURRENT_SPEAKER_CONFIG.company || 'Will Sigmon Media';
  var DEFAULT_SPEAKER_PHOTO = CURRENT_SPEAKER_CONFIG.photo || '/member-photos/will-sigmon.jpg';
  var DEFAULT_SPEAKER_PHOTO_OBJECT_POSITION = CURRENT_SPEAKER_CONFIG.photoObjectPosition || 'center 18%';
  var _hasSpeakerQuery = !!_qp.get('speaker');
  var _hasSpeakerCompanyQuery = !!_qp.get('company');
  var _hasSpeakerPhotoQuery = !!_qp.get('photo');
  var SPEAKER_NAME    = _qp.get('speaker') || DEFAULT_SPEAKER_NAME;
  var SPEAKER_COMPANY = _qp.get('company') || DEFAULT_SPEAKER_COMPANY;
  var SPEAKER_PHOTO = _hasSpeakerPhotoQuery
    ? _qp.get('photo')
    : (_hasSpeakerQuery ? '' : DEFAULT_SPEAKER_PHOTO);
  var SPEAKER_PHOTO_OBJECT_POSITION = _hasSpeakerQuery ? '' : DEFAULT_SPEAKER_PHOTO_OBJECT_POSITION;
  var SPEAKER_NAME_UPPER = String(SPEAKER_NAME || '').toUpperCase();

  function normalizeMemberName(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function getSpeakerInitials(name) {
    return String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .map(function(w) { return w.charAt(0); })
      .join('')
      .slice(0, 3)
      .toUpperCase();
  }

  function setSpeakerVisual(name, photoUrl, photoObjectPosition) {
    var headshot = document.getElementById('speaker-headshot');
    var initials = document.getElementById('speaker-initials');

    if (headshot) {
      headshot.alt = name || 'Speaker';
      if (photoUrl) {
        headshot.src = photoUrl;
        headshot.style.display = 'block';
        if (photoObjectPosition) {
          headshot.style.objectPosition = photoObjectPosition;
        } else {
          headshot.style.removeProperty('object-position');
        }
      } else {
        headshot.removeAttribute('src');
        headshot.style.display = 'none';
        headshot.style.removeProperty('object-position');
      }
    }
    if (initials) {
      initials.textContent = getSpeakerInitials(name);
      initials.style.display = photoUrl ? 'none' : 'flex';
    }
  }

  function renderSpeakerCard(name, company, photoUrl, photoObjectPosition) {
    var speakerName = name || 'Team Member';
    var speakerCompany = company || '';
    SPEAKER_NAME = speakerName;
    SPEAKER_COMPANY = speakerCompany;
    SPEAKER_NAME_UPPER = speakerName.toUpperCase();

    setSpeakerVisual(speakerName, photoUrl, photoObjectPosition);

    var cardBody = document.getElementById('speaker-card-body');
    if (cardBody) {
      /* Build safely without innerHTML: text + em-dash + text */
      cardBody.textContent = '';
      cardBody.appendChild(document.createTextNode(speakerName + (speakerCompany ? ' from ' + speakerCompany : '') + ' is up today. Give them your full attention \u2014 and a warm intro if someone comes to mind.'));
    }
    var anchorName = document.getElementById('anchor-speaker-name');
    if (anchorName) {
      anchorName.textContent = speakerName.toUpperCase();
    }
  }

  function initSpeakerElements() {
    renderSpeakerCard(SPEAKER_NAME, SPEAKER_COMPANY, SPEAKER_PHOTO, SPEAKER_PHOTO_OBJECT_POSITION);
  }
  /* ─────────────────────────────────────────────────────────────────── */

  var embersContainer = document.getElementById('embers-container');
  var emberInterval = null;
  var currentSpawnRate = 0;
  var countdownGrid = document.getElementById('countdown-grid');
  var countdownHeader = document.getElementById('countdown-header');
  var statusBanner = document.getElementById('status-banner');
  var warmupDisplay = document.getElementById('warmup-display');
  var warmupTime = document.getElementById('warmup-time');
  var progressWrap = document.getElementById('progress-wrap');
  var progressFill = document.getElementById('progress-fill');
  var anchorDisplay = document.getElementById('anchor-display');
  var hornDisplay = document.getElementById('horn-display');
  var hornTextEl = document.getElementById('horn-text');
  var hornJokeEl = document.getElementById('horn-joke');
  var screenFlash = document.getElementById('screen-flash');
  var edgeGlow = document.getElementById('edge-glow');
  var datetimeEl = document.getElementById('meeting-datetime');
  var topDate = document.getElementById('top-date');
  var topTime = document.getElementById('top-time');
  var overscanToast = document.getElementById('overscan-toast');
  var headerLocation = document.querySelector('.header-location');
  var afterglowCloudsText = document.querySelector('.afterglow-clouds-text');

  if (headerLocation && MEETING_CONFIG.venueCityLabel) {
    headerLocation.textContent = MEETING_CONFIG.venueCityLabel;
  }
  if (afterglowCloudsText && MEETING_CONFIG.supportMessage) {
    afterglowCloudsText.innerHTML = (MEETING_CONFIG.venueName || 'Clouds Brewing') + ' is hosting us tonight.<br>' + MEETING_CONFIG.supportMessage;
  }

  var hornJokes = [
    'WOOOOO! WE\'RE ABOUT TO BOIL OVER!',
    'THE EXTRA DEGREE STARTS NOW!',
    'IT\'S 212° IN HERE — TAKE YOUR SEATS!',
    'TURN UP THE HEAT AND TAKE YOUR SEAT!',
    'NO MORE SMALL TALK — IT\'S SHOWTIME!',
    'THIS IS WHERE CHAMPIONS NETWORK!',
    'BUCKLE UP — HEATWAVE IS LIVE!',
    'STYLIN\', PROFILIN\', AND NETWORKING!'
  ];

  var currentPhase = null;
  var hornPlayed = false;
  var hornJokeIndex = 0;
  var hornJokeTimer = null;

  var AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  var audioContext = null;
  var masterGain = null;
  var currentSoundMode = null;
  var soundLoopTimer = null;
  var hornTimeout = null;
  var soundCleanups = [];
  var overscanStorageKey = 'rduheatwave:overscan';
  var overscanCurrent = 0;
  var overscanToastTimer = null;

  function applyOverscan(value, showToast) {
    overscanCurrent = Math.max(0, Math.min(120, Number(value) || 0));
    var zoomLevel = 1 - (overscanCurrent * 2 / 1920);
    document.documentElement.style.setProperty('--overscan', overscanCurrent + 'px');
    document.documentElement.style.zoom = zoomLevel;
    try { localStorage.setItem(overscanStorageKey, String(overscanCurrent)); } catch (e) {}
    if (showToast && overscanToast) {
      overscanToast.textContent = overscanCurrent === 0 ? 'OVERSCAN: OFF' : 'OVERSCAN: ' + overscanCurrent + 'PX';
      overscanToast.classList.add('visible');
      clearTimeout(overscanToastTimer);
      overscanToastTimer = setTimeout(function() { overscanToast.classList.remove('visible'); }, 1500);
    }
  }

  // Load saved overscan (default 0 for direct HDMI)
  (function() {
    var stored = null;
    try { stored = localStorage.getItem(overscanStorageKey); } catch (e) {}
    // Migrate old defaults to 0 (direct HDMI doesn't need overscan)
    if (stored === '42' || stored === '56') stored = null;
    applyOverscan(stored || 0, false);
  })();

  // Keyboard: +/= to increase, -/_ to decrease, 0 to reset
  document.addEventListener('keydown', function(e) {
    if (e.key === '+' || e.key === '=') { applyOverscan(overscanCurrent + 4, true); }
    else if (e.key === '-' || e.key === '_') { applyOverscan(overscanCurrent - 4, true); }
    else if (e.key === '0' && !e.ctrlKey && !e.metaKey) { applyOverscan(0, true); }
  });


  var MAX_EMBERS = 40;
  function createEmber() {
    if (embersContainer.children.length >= MAX_EMBERS) return;
    var ember = document.createElement('div');
    ember.className = 'ember';
    var size = Math.random() * 18 + 6;
    ember.style.width = size + 'px';
    ember.style.height = size + 'px';
    ember.style.left = Math.random() * 100 + 'vw';
    var duration = Math.random() * 8 + 6;
    ember.style.animationDuration = duration + 's';
    embersContainer.appendChild(ember);
    setTimeout(function() {
      if (ember.parentNode) ember.parentNode.removeChild(ember);
    }, duration * 1000);
  }

  function updateEmbers(spawnRate) {
    if (spawnRate === currentSpawnRate) return;
    currentSpawnRate = spawnRate;
    if (emberInterval) clearInterval(emberInterval);
    if (spawnRate > 0) emberInterval = setInterval(createEmber, spawnRate);
  }


  function getAudioContext() {
    if (!AudioContextCtor) return null;
    if (!audioContext) {
      audioContext = new AudioContextCtor();
      masterGain = audioContext.createGain();
      masterGain.gain.value = 1.0;
      masterGain.connect(audioContext.destination);
    }
    return audioContext;
  }

  function ensureAudioReady() {
    var ctx = getAudioContext();
    if (!ctx) return Promise.resolve(false);
    if (ctx.state === 'suspended') {
      return ctx.resume().then(function() { return true; }).catch(function() { return false; });
    }
    return Promise.resolve(true);
  }

  function rememberSoundCleanup(cleanup) {
    soundCleanups.push(cleanup);
  }

  function playTone(options) {
    var ctx = getAudioContext();
    if (!ctx || !masterGain) return function() {};

    var startTime = ctx.currentTime + (options.delay || 0);
    var duration = options.duration || 0.2;
    var attack = options.attack || 0.02;
    var release = options.release || Math.min(0.18, duration);
    var endTime = startTime + duration;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.type = options.type || 'sine';
    osc.frequency.setValueAtTime(options.frequency || 220, startTime);
    if (options.detune) osc.detune.setValueAtTime(options.detune, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(options.volume || 0.05, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, Math.max(startTime + attack + 0.01, endTime - release));

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(startTime);
    osc.stop(endTime + 0.02);

    var cleaned = false;
    return function cleanup() {
      if (cleaned) return;
      cleaned = true;
      try { osc.stop(); } catch (e) {}
      try { osc.disconnect(); } catch (e) {}
      try { gain.disconnect(); } catch (e) {}
    };
  }

  function clearScheduledSounds() {
    while (soundCleanups.length) {
      try { soundCleanups.pop()(); } catch (e) {}
    }
  }

  var warmupIntensity = 0;
  function queueWarmupPulse() {
    warmupIntensity = Math.min(warmupIntensity + 1, 100);
    var intensity = warmupIntensity / 100;
    var baseVol = 0.15 + intensity * 0.35;
    var baseFreq = 56 + intensity * 80;
    rememberSoundCleanup(playTone({ frequency: baseFreq, type: 'sine', volume: baseVol, duration: 0.15 }));
    rememberSoundCleanup(playTone({ frequency: baseFreq * 1.5, type: 'triangle', volume: baseVol * 0.5, duration: 0.1, delay: 0.12 }));
    if (intensity > 0.4) {
      rememberSoundCleanup(playTone({ frequency: baseFreq * 2, type: 'square', volume: baseVol * 0.2, duration: 0.06, delay: 0.2 }));
    }
    if (intensity > 0.7) {
      rememberSoundCleanup(playTone({ frequency: 110, type: 'sawtooth', volume: 0.03, duration: 0.3, delay: 0.05 }));
    }
  }

  var warmupAccelTimer = null;
  function startLoopedSound(mode) {
    if (currentSoundMode === mode) return;
    stopAllAudio();
    warmupIntensity = 0;
    ensureAudioReady().then(function(ready) {
      if (!ready) return;
      currentSoundMode = mode;
      if (mode === 'warmup') {
        var interval = 900;
        function scheduleNext() {
          queueWarmupPulse();
          interval = Math.max(250, interval - 8);
          warmupAccelTimer = setTimeout(scheduleNext, interval);
        }
        scheduleNext();
      }
    });
  }

  function stopHornJokes() {
    if (hornJokeTimer) {
      clearInterval(hornJokeTimer);
      hornJokeTimer = null;
    }
  }

  function startHornJokes() {
    if (!hornJokeEl) return;
    stopHornJokes();
    hornJokeEl.textContent = hornJokes[hornJokeIndex % hornJokes.length];
    hornJokeTimer = setInterval(function() {
      hornJokeIndex += 1;
      hornJokeEl.textContent = hornJokes[hornJokeIndex % hornJokes.length];
    }, 3200);
  }

  /* === TAKEOVER — full screen cycle during horn === */
  var takeoverHeadlines = [
    "IT'S 212\u00B0!",
    "LET'S GO!",
    "WOOOOO!",
    "BOILING\nPOINT!",
    "SEATS\nNOW!",
    "THE EXTRA\nDEGREE!",
    "HEATWAVE\nIS LIVE!",
    "TIME TO\nNETWORK!"
  ];
  var takeoverSubs = [
    "TAKE YOUR SEATS \u2014 WE'RE ABOUT TO BOIL OVER",
    "THE EXTRA DEGREE CHANGES EVERYTHING",
    "STYLIN', PROFILIN', AND NETWORKING!",
    "THIS IS WHERE CHAMPIONS CONNECT",
    "TURN UP THE HEAT AND TAKE YOUR SEAT",
    "NO MORE SMALL TALK \u2014 IT'S SHOWTIME!",
    "RDU HEATWAVE IS ABOUT TO GO OFF",
    "BUCKLE UP \u2014 212\u00B0 STARTS NOW"
  ];
  var takeoverCycleTimer = null;
  var takeoverCountdownTimer = null;
  var takeoverIndex = 0;

  function startTakeoverCycle() {
    var headlineEl = document.getElementById('takeover-headline');
    var subEl = document.getElementById('takeover-sub');
    var timerEl = document.getElementById('takeover-timer');
    if (!headlineEl) return;

    takeoverIndex = 0;
    headlineEl.textContent = takeoverHeadlines[0];
    subEl.textContent = takeoverSubs[0];

    /* Cycle headlines every 2.5s */
    takeoverCycleTimer = setInterval(function() {
      takeoverIndex = (takeoverIndex + 1) % takeoverHeadlines.length;
      headlineEl.textContent = takeoverHeadlines[takeoverIndex];
      subEl.textContent = takeoverSubs[takeoverIndex % takeoverSubs.length];
    }, 2500);

    /* Countdown from 30 */
    var secondsLeft = Math.round(HORN_DURATION / 1000);
    timerEl.textContent = secondsLeft;
    takeoverCountdownTimer = setInterval(function() {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearInterval(takeoverCountdownTimer);
        takeoverCountdownTimer = null;
        timerEl.textContent = '';
      } else {
        timerEl.textContent = secondsLeft;
      }
    }, 1000);
  }

  function stopTakeoverCycle() {
    if (takeoverCycleTimer) { clearInterval(takeoverCycleTimer); takeoverCycleTimer = null; }
    if (takeoverCountdownTimer) { clearInterval(takeoverCountdownTimer); takeoverCountdownTimer = null; }
  }

  function stopAllAudio() {
    currentSoundMode = null;
    warmupIntensity = 0;
    if (soundLoopTimer) {
      clearInterval(soundLoopTimer);
      soundLoopTimer = null;
    }
    if (warmupAccelTimer) {
      clearTimeout(warmupAccelTimer);
      warmupAccelTimer = null;
    }
    if (hornTimeout) {
      clearTimeout(hornTimeout);
      hornTimeout = null;
    }
    clearScheduledSounds();
    stopHornJokes();
    if (masterGain) masterGain.gain.value = 1.0;
  }

  // Enable audio on any user interaction (browser autoplay policy)
  document.addEventListener('click', function() { ensureAudioReady(); }, { once: true });
  document.addEventListener('keydown', function() { ensureAudioReady(); }, { once: true });

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
    if (refinedOffset !== offset) timestamp = utcGuess - refinedOffset;
    return timestamp;
  }

  function getNextMeeting() {
    var eastNow = getMeetingParts(new Date());
    var todayUtc = new Date(Date.UTC(eastNow.year, eastNow.month - 1, eastNow.day));
    var dow = todayUtc.getUTCDay();
    var daysUntil = (MEETING_DAY - dow + 7) % 7;
    var meetingEndMinutes = (MEETING_HOUR * 60) + MEETING_MIN + (MEETING_DURATION / 60000);
    var currentMinutes = (eastNow.hour * 60) + eastNow.minute + (eastNow.second / 60);
    if (daysUntil === 0 && currentMinutes >= meetingEndMinutes) daysUntil = 7;

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
  datetimeEl.textContent = meeting.dateStr + ' • ' + MEETING_TIME_LABEL;

  function updateClock() {
    var opts = { timeZone: MEETING_TIME_ZONE };
    var now = new Date();
    topDate.textContent = now.toLocaleDateString('en-US', Object.assign({ weekday: 'long', month: 'short', day: 'numeric' }, opts));
    topTime.textContent = now.toLocaleTimeString('en-US', Object.assign({ hour: 'numeric', minute: '2-digit', hour12: true }, opts));
  }

  var cards = document.querySelectorAll('.carousel-card');
  var dotsContainer = document.getElementById('carousel-dots');
  var cardCount = cards.length;
  var currentCard = -1;
  var cardRotationTimer = null;

  for (var i = 0; i < cardCount; i++) {
    var dot = document.createElement('div');
    dot.className = 'carousel-dot';
    dotsContainer.appendChild(dot);
  }
  var dots = dotsContainer.querySelectorAll('.carousel-dot');

  function showCard(index) {
    if (currentCard >= 0 && currentCard < cardCount) {
      cards[currentCard].classList.remove('active', 'settled');
      cards[currentCard].classList.add('exiting');
      dots[currentCard].classList.remove('active');
      (function(c) {
        setTimeout(function() { cards[c].classList.remove('exiting'); }, 600);
      })(currentCard);
    }
    currentCard = index;
    cards[currentCard].classList.remove('exiting');
    cards[currentCard].classList.add('active');
    dots[currentCard].classList.add('active');
    setTimeout(function() {
      if (cards[currentCard] && cards[currentCard].classList.contains('active')) {
        cards[currentCard].classList.add('settled');
      }
    }, CARD_SETTLE_DELAY);
  }

  function nextCard() { showCard((currentCard + 1) % cardCount); }

  function startCardRotation() {
    if (cardRotationTimer) return;
    cardRotationTimer = setInterval(nextCard, CARD_INTERVAL);
  }

  function stopCardRotation(focusIndex) {
    if (cardRotationTimer) {
      clearInterval(cardRotationTimer);
      cardRotationTimer = null;
    }
    if (typeof focusIndex === 'number' && focusIndex >= 0 && focusIndex < cardCount) {
      showCard(focusIndex);
    }
  }

  nextCard();
  startCardRotation();

  function resetPhaseUI() {
    countdownGrid.style.display = 'none';
    countdownHeader.style.display = 'block';
    statusBanner.className = 'status-banner';
    warmupDisplay.classList.remove('visible');
    progressWrap.classList.remove('visible');
    hornDisplay.classList.remove('visible');
    anchorDisplay.classList.remove('visible');
    screenFlash.style.display = 'none';
    screenFlash.className = 'screen-flash';
    edgeGlow.style.display = 'none';
    edgeGlow.className = 'edge-glow';
    document.body.classList.remove('warmup-urgent', 'warmup-shake');
    document.body.style.backgroundColor = '';
    if (warmupTime) warmupTime.style.transform = '';
    /* Reset heat distortion to default */
    var filterEl = document.querySelector('#heat-distort feDisplacementMap');
    if (filterEl) filterEl.setAttribute('scale', '18');
    stopHornJokes();
    stopTakeoverCycle();
  }

  var scheduleItems = document.querySelectorAll('#meeting-schedule .schedule-item');
  function highlightSchedule(phase) {
    var idx = (phase === PHASE.COUNTDOWN) ? 0 :
              (phase === PHASE.OVER) ? 2 : 1;
    scheduleItems.forEach(function(el, i) {
      el.classList.toggle('schedule-item--active', i === idx);
    });
  }

  function setPhase(phase) {
    if (phase === currentPhase) return;
    currentPhase = phase;
    document.body.classList.remove('phase-countdown', 'phase-arrival', 'phase-warmup', 'phase-horn', 'phase-live', 'phase-over', 'preheat-mode', 'anchor-mode');
    document.body.classList.add(
      phase === PHASE.COUNTDOWN ? 'phase-countdown' :
      phase === PHASE.WARMUP ? 'phase-warmup' :
      phase === PHASE.HORN ? 'phase-horn' :
      phase === PHASE.LIVE ? 'phase-live' : 'phase-over'
    );
    if (phase === PHASE.LIVE) document.body.classList.add('anchor-mode');

    highlightSchedule(phase);
    resetPhaseUI();

    switch (phase) {
      case PHASE.COUNTDOWN:
        stopAllAudio();
        startCardRotation();
        countdownGrid.style.display = 'grid';
        countdownHeader.textContent = 'WE START IN';
        break;
      case PHASE.WARMUP:
        stopAllAudio();
        startCardRotation();
        startLoopedSound('warmup');
        updateEmbers(120);
        countdownHeader.textContent = 'FIVE-MINUTE COUNTDOWN';
        warmupDisplay.classList.add('visible');
        progressWrap.classList.add('visible');
        statusBanner.textContent = '🔥 LAST CALL — WRAP IT UP 🔥';
        statusBanner.className = 'status-banner visible warmup';
        screenFlash.style.display = 'block';
        edgeGlow.style.display = 'block';
        edgeGlow.className = 'edge-glow';
        break;
      case PHASE.HORN:
        stopAllAudio();
        stopCardRotation(0);
        updateEmbers(25);
        countdownHeader.style.display = 'none';
        screenFlash.style.display = 'block';
        screenFlash.className = 'screen-flash horn-mode';
        edgeGlow.style.display = 'block';
        edgeGlow.className = 'edge-glow horn-mode';
        /* Crank heat distortion to max */
        var hornFilter = document.querySelector('#heat-distort feDisplacementMap');
        if (hornFilter) hornFilter.setAttribute('scale', '60');
        /* Start takeover headline cycling */
        startTakeoverCycle();
        if (!hornPlayed) { playHorn(); hornPlayed = true; }
        break;
      case PHASE.LIVE:
        stopAllAudio();
        startCardRotation();
        updateEmbers(0);
        countdownHeader.textContent = 'MEETING IN PROGRESS';
        countdownGrid.style.display = 'none';
        statusBanner.textContent = 'RDU HEATWAVE \u2022 NETWORKING MEETING IN SESSION';
        statusBanner.className = 'status-banner visible live';
        break;
      case PHASE.OVER:
        stopAllAudio();
        stopCardRotation(0);
        updateEmbers(2000);
        meeting = getNextMeeting();
        datetimeEl.textContent = meeting.dateStr + ' • ' + MEETING_TIME_LABEL;
        hornPlayed = false;
        /* Populate afterglow next-date */
        var afterglowDate = document.getElementById('afterglow-next-date');
        if (afterglowDate) afterglowDate.textContent = meeting.dateStr + ' \u2022 ' + MEETING_PUBLIC_TIME_SHORT;
        break;
    }
  }

  function playHorn() {
    if (currentSoundMode === 'horn') return;

    stopAllAudio();
    ensureAudioReady().then(function(ready) {
      if (!ready) return;
      currentSoundMode = 'horn';
      if (masterGain) masterGain.gain.value = 1.0;

      var ctx = getAudioContext();
      if (!ctx || !masterGain) return;
      var now = ctx.currentTime;
      var dur = HORN_DURATION / 1000;

      function makeOsc(type, freq, gainVal, startDelay, length) {
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(gainVal, now + (startDelay || 0) + 0.1);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now + (startDelay || 0));
        osc.stop(now + (startDelay || 0) + (length || dur));
        rememberSoundCleanup(function() {
          try { osc.stop(); } catch(e) {}
          try { osc.disconnect(); } catch(e) {}
          try { g.disconnect(); } catch(e) {}
        });
        return { osc: osc, gain: g };
      }

      /* === LAYER 1: FOG HORN — two detuned sawtooth oscillators === */
      var foghorn1 = makeOsc('sawtooth', 130, 0.5, 0, dur);
      var foghorn2 = makeOsc('sawtooth', 135, 0.45, 0, dur);
      /* Slow attack swell for fog horn feel */
      foghorn1.gain.gain.setValueAtTime(0.0001, now);
      foghorn1.gain.gain.exponentialRampToValueAtTime(0.5, now + 0.3);
      foghorn2.gain.gain.setValueAtTime(0.0001, now);
      foghorn2.gain.gain.exponentialRampToValueAtTime(0.45, now + 0.35);

      /* === LAYER 2: WIDE SIREN SWEEP === */
      var siren1 = makeOsc('sawtooth', 400, 0.5, 0, dur);
      var siren2 = makeOsc('sawtooth', 405, 0.3, 0, dur);
      /* Sweep 400-1400Hz every 0.8s */
      var sweepDur = 0.8;
      for (var s = 0; s < Math.ceil(dur / sweepDur); s++) {
        var t = now + s * sweepDur;
        siren1.osc.frequency.setValueAtTime(400, t);
        siren1.osc.frequency.linearRampToValueAtTime(1400, t + sweepDur * 0.5);
        siren1.osc.frequency.linearRampToValueAtTime(400, t + sweepDur);
        siren2.osc.frequency.setValueAtTime(405, t);
        siren2.osc.frequency.linearRampToValueAtTime(1405, t + sweepDur * 0.5);
        siren2.osc.frequency.linearRampToValueAtTime(405, t + sweepDur);
      }

      /* === LAYER 3: SUB BASS === */
      makeOsc('sine', 55, 0.4, 0, dur);

      /* === LAYER 4: IMPACT BURSTS at start === */
      rememberSoundCleanup(playTone({ frequency: 100, type: 'square', volume: 0.5, duration: 0.3, attack: 0.01, release: 0.25, delay: 0 }));
      rememberSoundCleanup(playTone({ frequency: 100, type: 'square', volume: 0.45, duration: 0.25, attack: 0.01, release: 0.2, delay: 0.5 }));
      rememberSoundCleanup(playTone({ frequency: 100, type: 'square', volume: 0.4, duration: 0.2, attack: 0.01, release: 0.15, delay: 1.0 }));

      /* === LAYER 5: HIGH ALARM — alternating tone === */
      var alarm = makeOsc('square', 1000, 0.15, 0, dur);
      for (var a = 0; a < Math.ceil(dur / 1.0); a++) {
        var at = now + a * 1.0;
        alarm.osc.frequency.setValueAtTime(1000, at);
        alarm.osc.frequency.setValueAtTime(800, at + 0.5);
      }

      /* === LAYER 6: SYNTH "WOOO!" — frequency sweep bursts === */
      function synthWoo(delay) {
        var wooOsc = ctx.createOscillator();
        var wooGain = ctx.createGain();
        var vibrato = ctx.createOscillator();
        var vibratoGain = ctx.createGain();
        wooOsc.type = 'sine';
        vibrato.type = 'sine';
        vibrato.frequency.setValueAtTime(6, now);
        vibratoGain.gain.setValueAtTime(50, now);
        vibrato.connect(vibratoGain);
        vibratoGain.connect(wooOsc.frequency);
        wooOsc.frequency.setValueAtTime(300, now + delay);
        wooOsc.frequency.exponentialRampToValueAtTime(1200, now + delay + 0.3);
        wooOsc.frequency.exponentialRampToValueAtTime(800, now + delay + 0.8);
        wooGain.gain.setValueAtTime(0.0001, now + delay);
        wooGain.gain.exponentialRampToValueAtTime(0.4, now + delay + 0.08);
        wooGain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.0);
        wooOsc.connect(wooGain);
        wooGain.connect(masterGain);
        wooOsc.start(now + delay);
        wooOsc.stop(now + delay + 1.1);
        vibrato.start(now + delay);
        vibrato.stop(now + delay + 1.1);
        rememberSoundCleanup(function() {
          try { wooOsc.stop(); } catch(e) {}
          try { vibrato.stop(); } catch(e) {}
          try { wooOsc.disconnect(); } catch(e) {}
          try { wooGain.disconnect(); } catch(e) {}
          try { vibrato.disconnect(); } catch(e) {}
          try { vibratoGain.disconnect(); } catch(e) {}
        });
      }
      synthWoo(3);
      synthWoo(12);
      synthWoo(22);

      hornTimeout = setTimeout(function() {
        if (masterGain) masterGain.gain.value = 1.0;
        stopAllAudio();
      }, HORN_DURATION);
    });
  }

  function updateCountdown() {
    updateClock();
    var now = Date.now();
    var diff = meeting.timestamp - now;
    var warmupEnd = meeting.timestamp + WARMUP_SECS * 1000;
    var hornEnd = warmupEnd + HORN_DURATION;
    var meetingEnd = meeting.timestamp + MEETING_DURATION;

    if (diff > 0) {
      setPhase(PHASE.COUNTDOWN);
      var days = Math.floor(diff / 86400000);
      var hours = Math.floor((diff % 86400000) / 3600000);
      var mins = Math.floor((diff % 3600000) / 60000);
      var secs = Math.floor((diff % 60000) / 1000);
      var preheatMode = diff <= (PREHEAT_WINDOW_SECS * 1000);

      var daysUnit = document.getElementById('cd-days-unit');
      if (days === 0) {
        daysUnit.style.display = 'none';
      } else {
        daysUnit.style.display = '';
        document.getElementById('cd-days').textContent = String(days).padStart(2, '0');
      }
      document.getElementById('cd-hours').textContent = String(hours).padStart(2, '0');
      document.getElementById('cd-mins').textContent = String(mins).padStart(2, '0');
      document.getElementById('cd-secs').textContent = String(secs).padStart(2, '0');

      document.querySelectorAll('.countdown-value').forEach(function(valueEl) {
        valueEl.classList.remove('tier-warm', 'tier-hot', 'tier-fire');
        if (mins < 10) valueEl.classList.add('tier-fire');
        else if (mins < 30) valueEl.classList.add('tier-hot');
        else if (mins < 60) valueEl.classList.add('tier-warm');
      });

      if (preheatMode) {
        document.body.classList.add('preheat-mode');
        countdownHeader.textContent = 'DOORS OPEN';
        statusBanner.textContent = 'NETWORKING MODE \u2022 TODAY: ' + SPEAKER_NAME_UPPER;
        statusBanner.className = 'status-banner visible preheat';
        /* Gradually ramp embers from 400ms (15min out) → 220ms (0min) */
        var preheatProgress = 1 - (diff / (PREHEAT_WINDOW_SECS * 1000));
        var preheatEmberRate = Math.round(400 - preheatProgress * 180);
        updateEmbers(preheatEmberRate);
      } else if (mins < 10) {
        updateEmbers(300);
      } else if (mins < 30) {
        updateEmbers(600);
      } else {
        updateEmbers(900);
      }
    } else if (now < warmupEnd) {
      setPhase(PHASE.WARMUP);
      var remaining = Math.max(0, Math.ceil((warmupEnd - now) / 1000));
      var warmupMinutes = Math.floor(remaining / 60);
      var warmupSeconds = remaining % 60;
      warmupTime.textContent = String(warmupMinutes).padStart(2, '0') + ':' + String(warmupSeconds).padStart(2, '0');
      progressFill.style.width = Math.min(100, ((WARMUP_SECS - remaining) / WARMUP_SECS) * 100) + '%';
      /* Escalate embers: 120ms → 10ms as countdown progresses */
      var warmupProgress = 1 - (remaining / WARMUP_SECS);
      var emberRate = Math.round(120 - warmupProgress * 110);
      updateEmbers(emberRate);
      /* Escalate SVG distortion during warmup */
      var distortScale = Math.round(18 + warmupProgress * 42);
      var filterEl = document.querySelector('#heat-distort feDisplacementMap');
      if (filterEl) filterEl.setAttribute('scale', distortScale);
      /* Scale warmup timer as it progresses */
      var timerScale = 1 + warmupProgress * 0.4;
      warmupTime.style.transform = 'scale(' + timerScale + ')';
      /* Shift background toward deep red */
      var redShift = Math.min(1, warmupProgress * 1.5);
      var bgR = Math.round(26 + redShift * 40);
      var bgG = Math.round(20 - redShift * 12);
      var bgB = Math.round(24 - redShift * 18);
      document.body.style.backgroundColor = 'rgb(' + bgR + ',' + bgG + ',' + bgB + ')';
      /* Last 60 seconds: add urgent class */
      if (remaining <= 60) {
        document.body.classList.add('warmup-urgent');
        statusBanner.textContent = '⚡ ' + remaining + 's — FIND YOUR SEAT NOW ⚡';
      } else {
        document.body.classList.remove('warmup-urgent');
      }
      /* Last 30 seconds: add shake class */
      if (remaining <= 30) {
        document.body.classList.add('warmup-shake');
      } else {
        document.body.classList.remove('warmup-shake');
      }
    } else if (now < hornEnd) {
      setPhase(PHASE.HORN);
    } else if (now < meetingEnd) {
      setPhase(PHASE.LIVE);
    } else {
      setPhase(PHASE.OVER);
    }
  }

  initSpeakerElements();

  /* ── Live stats ticker ──────────────────────────────────────────── */
  function formatRevenue(n) {
    return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /* SVG icon markup for ticker stats */
  var TICKER_ICONS = {
    bizchats: '<span class="hw-icon hw-icon--inline hw-icon--chat" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#E8580C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="rgba(232,88,12,0.2)"/></svg></span>',
    guests: '<span class="hw-icon hw-icon--inline hw-icon--handshake" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#E8580C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17l-3.5-3.5M6.5 12L2 17"/><path d="M2 7l4.5 4.5"/><path d="M22 7l-4.5 4.5"/><path d="M10.5 12.5l-2 2a1.4 1.4 0 0 0 2 2l3.5-3.5"/><path d="M13.5 9.5l2-2a1.4 1.4 0 0 0-2-2L10 9"/><path d="M7 4l3 3"/><path d="M14 4l3 3"/></svg></span>',
    revenue: '<span class="hw-icon hw-icon--inline hw-icon--money" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#E8580C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" fill="none"/></svg></span>',
    referrals: '<span class="hw-icon hw-icon--inline hw-icon--envelope" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#E8580C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" fill="rgba(232,88,12,0.2)"/><polyline points="22,6 12,13 2,6"/></svg></span>',
    incentives: '<span class="hw-icon hw-icon--inline hw-icon--star" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#E8580C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="rgba(232,88,12,0.2)"/></svg></span>'
  };

  function updateTickerPair(key, text) {
    var el1 = document.getElementById('ticker-' + key + '-1');
    var el2 = document.getElementById('ticker-' + key + '-2');
    var icon = TICKER_ICONS[key] || '';
    var html = icon + ' ' + text;
    if (el1) el1.innerHTML = html;
    if (el2) el2.innerHTML = html;
  }

  function fetchLiveStats() {
    fetchStatsOnce()
      .then(function(data) {
        if (!data || data.status !== 'ok') return;
        var s = (data && data.stats) ? data.stats : null;
        if (!s) return;
        if (s.bizChats       != null) updateTickerPair('bizchats',   s.bizChats + ' BIZCHATS');
        if (s.guestsHosted   != null) updateTickerPair('guests',     s.guestsHosted + ' GUESTS HOSTED');
        if (s.revenue        != null) updateTickerPair('revenue',    formatRevenue(s.revenue) + ' REVENUE GENERATED');
        if (s.referrals      != null) updateTickerPair('referrals',  s.referrals + ' REFERRALS PASSED');
        if (s.guestIncentives != null) updateTickerPair('incentives', s.guestIncentives + ' GRATITUDE INCENTIVES RECEIVED');
      })
      .catch(function() { /* keep hardcoded fallback values */ });
  }

  fetchLiveStats();
  /* ─────────────────────────────────────────────────────────────────── */

  /* ── Random member spotlight (when no configured speaker) ──────── */
  var _hasConfiguredSpeaker = !!SPEAKER_NAME;

  function applyMemberSpotlight(member) {
    var name    = member.name    || 'Team Member';
    var company = member.company || '';
    renderSpeakerCard(name, company, member.photo || '', member.photoObjectPosition || '');
  }

  function findMemberByName(list, targetName) {
    var target = normalizeMemberName(targetName);
    if (!target) return null;

    for (var i = 0; i < list.length; i++) {
      if (normalizeMemberName(list[i] && list[i].name) === target) {
        return list[i];
      }
    }

    return null;
  }

  function hydrateConfiguredSpeaker() {
    if (!_hasConfiguredSpeaker || _hasSpeakerPhotoQuery) return;

    fetch('/api/members')
      .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function(data) {
        var list = (data && Array.isArray(data.members) && data.members.length) ? data.members : null;
        if (!list) return;

        var match = findMemberByName(list, SPEAKER_NAME);
        if (!match || !match.photo) return;

        SPEAKER_PHOTO = match.photo;
        SPEAKER_PHOTO_OBJECT_POSITION = match.photoObjectPosition || '';
        if (!_hasSpeakerCompanyQuery && !SPEAKER_COMPANY && match.company) {
          SPEAKER_COMPANY = match.company;
        }

        renderSpeakerCard(SPEAKER_NAME, SPEAKER_COMPANY, SPEAKER_PHOTO, SPEAKER_PHOTO_OBJECT_POSITION);
      })
      .catch(function() { /* keep configured speaker fallback values */ });
  }

  function fetchMembersAndRotate() {
    if (_hasConfiguredSpeaker) return; /* configured speaker takes priority */
    fetch('/api/members')
      .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function(data) {
        var list = (data && Array.isArray(data.members) && data.members.length) ? data.members : null;
        if (!list) return;
        // Seed by ISO week number so the same member shows all day on meeting day
        var now = new Date();
        var startOfYear = new Date(now.getFullYear(), 0, 1);
        var weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
        var pick = list[weekNum % list.length];
        applyMemberSpotlight(pick);
      })
      .catch(function() { /* keep Rusty as fallback */ });
  }

  hydrateConfiguredSpeaker();
  fetchMembersAndRotate();
  /* ─────────────────────────────────────────────────────────────────── */

  /* ── Upcoming events card ───────────────────────────────────────── */
  function setEventsSyncLabel(text) {
    var pill = document.getElementById('events-sync-pill');
    if (pill) pill.textContent = text;
  }

  function eventDateLabel(date) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: MEETING_TIME_ZONE,
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  function eventTimeLabel(start, end, allDay) {
    if (allDay) return 'All day';
    var formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: MEETING_TIME_ZONE,
      hour: 'numeric',
      minute: '2-digit'
    });
    var startText = formatter.format(start);
    if (!end || isNaN(end.getTime())) return startText;
    return startText + ' – ' + formatter.format(end);
  }

  function buildEventRow(event) {
    var item = document.createElement('li');
    item.className = 'card-event-item';

    var title = document.createElement('strong');
    title.className = 'card-event-title';
    title.textContent = event.title || 'Upcoming event';
    item.appendChild(title);

    var when = document.createElement('span');
    when.className = 'card-event-when';
    var start = new Date(event.start);
    var end = event.end ? new Date(event.end) : null;
    when.textContent = eventDateLabel(start) + ' • ' + eventTimeLabel(start, end, !!event.allDay);
    item.appendChild(when);

    if (event.location) {
      var where = document.createElement('span');
      where.className = 'card-event-where';
      where.textContent = event.location;
      item.appendChild(where);
    }

    return item;
  }

  function renderUpcomingEvents(payload) {
    var list = document.getElementById('upcoming-events-list');
    if (!list) return;
    list.innerHTML = '';

    var events = payload && Array.isArray(payload.events) ? payload.events : [];
    if (!events.length) {
      var empty = document.createElement('li');
      empty.className = 'card-event-empty';
      empty.textContent = 'No upcoming events on the team calendar yet.';
      list.appendChild(empty);
      setEventsSyncLabel('Calendar Idle');
      return;
    }

    events.slice(0, 4).forEach(function(event) {
      list.appendChild(buildEventRow(event));
    });

    if (payload && payload.source === 'apps-script') {
      setEventsSyncLabel('Live Calendar');
    } else if (payload && payload.source === 'fallback') {
      setEventsSyncLabel('Weekly Schedule');
    } else {
      setEventsSyncLabel('Calendar Sync');
    }
  }

  fetch('/api/upcoming-events')
    .then(function(response) {
      if (!response.ok) throw new Error('upcoming events unavailable');
      return response.json();
    })
    .then(function(payload) {
      renderUpcomingEvents(payload);
    })
    .catch(function() {
      renderUpcomingEvents({
        source: 'fallback',
        events: []
      });
    });
  /* ─────────────────────────────────────────────────────────────────── */

  var debugPhase = new URLSearchParams(window.location.search).get('phase');
  if (debugPhase) {
    if (debugPhase === 'preheat') {
      setPhase(PHASE.COUNTDOWN);
      document.body.classList.add('preheat-mode');
      countdownGrid.style.display = 'grid';
      document.getElementById('cd-days-unit').style.display = 'none';
      document.getElementById('cd-hours').textContent = '00';
      document.getElementById('cd-mins').textContent = '08';
      document.getElementById('cd-secs').textContent = '24';
      countdownHeader.textContent = 'DOORS OPEN';
      statusBanner.textContent = 'NETWORKING MODE \u2022 TODAY: ' + SPEAKER_NAME_UPPER;
      statusBanner.className = 'status-banner visible preheat';
      updateEmbers(220);
    } else if (debugPhase === 'warmup') {
      setPhase(PHASE.WARMUP);
      warmupTime.textContent = '03:42';
      progressFill.style.width = '26%';
    } else if (debugPhase === 'horn') {
      setPhase(PHASE.HORN);
    } else if (debugPhase === 'live') {
      setPhase(PHASE.LIVE);
    } else if (debugPhase === 'over') {
      setPhase(PHASE.OVER);
      /* Debug: simulate post-meeting — next meeting is the Thursday AFTER the upcoming one */
      var afterglowDateEl = document.getElementById('afterglow-next-date');
      if (afterglowDateEl) {
        var debugNext = new Date(meeting.timestamp + 7 * 86400000);
        afterglowDateEl.textContent = meetingDateFormatter.format(debugNext) + ' \u2022 ' + MEETING_PUBLIC_TIME_SHORT;
      }
    } else {
      setPhase(PHASE.COUNTDOWN);
    }
    updateClock();
    setInterval(updateClock, 1000);
  } else {
    updateCountdown();
    setInterval(updateCountdown, 1000);
  }

  document.addEventListener('click', function() {
    if (currentPhase === PHASE.WARMUP) startLoopedSound('warmup');
    else if (currentPhase === PHASE.HORN) playHorn();
  }, { once: false });
})();
