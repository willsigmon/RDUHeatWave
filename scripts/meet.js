(function() {
  'use strict';

  var SITE_CONFIG = window.HEATWAVE_SITE_CONFIG || {};
  var MEETING_CONFIG = SITE_CONFIG.meeting || {};
  var COUNTDOWN_CONFIG = SITE_CONFIG.countdownTarget || {};
  var SPOTIFY_CONFIG = SITE_CONFIG.spotify || {};
  var CURRENT_SPEAKER_CONFIG = SITE_CONFIG.currentSpeaker || {};

  var urlParams = new URLSearchParams(window.location.search);
  var DEMO_SHOWTIME = urlParams.get('demoShowtime') === 'true';
  var STORAGE_KEY = 'rduheatwave:showtime-target';
  var MEETING_DAY = Number.isFinite(MEETING_CONFIG.day) ? MEETING_CONFIG.day : 4;
  var MEETING_TIME_ZONE = COUNTDOWN_CONFIG.timezone || MEETING_CONFIG.timezone || 'America/New_York';
  var ALLOW_REPEAT = COUNTDOWN_CONFIG.allowRepeat === true;
  var CHECK_INTERVAL_MS = 250;
  var PAST_TARGET_GRACE_MS = 12 * 60 * 60 * 1000;

  var currentPhase = 'countdown';
  var hasShowtimeTriggered = false;
  var liveStatsPromise = null;
  var targetState = null;
  var emberTimer = null;
  var emberRate = 0;
  var countdownTimerId = null;
  var footerHeightObserver = null;

  var spotifyState = {
    currentPresetId: '',
    currentOpenUrl: 'https://open.spotify.com',
    isExpanded: false,
    embedReady: false
  };

  var meetingDatetimeEl = document.getElementById('meeting-datetime');
  var topDateEl = document.getElementById('top-date');
  var topTimeEl = document.getElementById('top-time');
  var footerStackEl = document.getElementById('footer-stack');
  var tickerContentEl = document.getElementById('ticker-content');
  var speakerHeadshotEl = document.getElementById('speaker-headshot');
  var speakerInitialsEl = document.getElementById('speaker-initials');
  var speakerNameEl = document.getElementById('speaker-name');
  var speakerCompanyEl = document.getElementById('speaker-company');
  var speakerCardBodyEl = document.getElementById('speaker-card-body');
  var showtimeSpeakerEl = document.getElementById('showtime-speaker');
  var eventsSyncPillEl = document.getElementById('events-sync-pill');
  var upcomingEventsListEl = document.getElementById('upcoming-events-list');
  var countdownHeaderEl = document.getElementById('countdown-header');
  var countdownTargetLabelEl = document.getElementById('countdown-target-label');
  var countdownContextEl = document.getElementById('countdown-context');
  var statusBannerEl = document.getElementById('status-banner');
  var countdownDaysEl = document.getElementById('cd-days');
  var countdownHoursEl = document.getElementById('cd-hours');
  var countdownMinutesEl = document.getElementById('cd-mins');
  var countdownSecondsEl = document.getElementById('cd-secs');
  var meetingStartLabelEl = document.getElementById('meeting-start-label');
  var meetingTargetTimeEl = document.getElementById('meeting-target-time');
  var showtimeScreenEl = document.getElementById('showtime-screen');
  var embersContainerEl = document.getElementById('embers-container');
  var spotifyDockEl = document.getElementById('spotify-dock');
  var spotifyPresetsEl = document.getElementById('spotify-presets');
  var spotifyTrackArtEl = document.getElementById('spotify-track-art');
  var spotifyTrackTitleEl = document.getElementById('spotify-track-title');
  var spotifyTrackMetaEl = document.getElementById('spotify-track-meta');
  var spotifyStatusEl = document.getElementById('spotify-status');
  var spotifyExpandButtonEl = document.getElementById('spotify-expand');
  var spotifyOpenLinkEl = document.getElementById('spotify-open-link');
  var spotifyEmbedFrameEl = document.getElementById('spotify-embed-frame');

  var stats = {
    bizChats: 207,
    guestsHosted: 113,
    revenue: 115331,
    referrals: 49,
    guestIncentives: 158
  };

  var speakerState = buildSpeakerState();

  function buildSpeakerState() {
    var defaultName = CURRENT_SPEAKER_CONFIG.name || 'RDU Heatwave';
    var defaultCompany = CURRENT_SPEAKER_CONFIG.company || 'Two Twelve Referral Network';
    var defaultPhoto = CURRENT_SPEAKER_CONFIG.photo || '';
    var defaultObjectPosition = CURRENT_SPEAKER_CONFIG.photoObjectPosition || 'center center';

    return {
      name: urlParams.get('speaker') || defaultName,
      company: urlParams.get('company') || defaultCompany,
      photo: urlParams.get('photo') || defaultPhoto,
      photoObjectPosition: defaultObjectPosition
    };
  }

  function getStoredShowtimeKey() {
    try {
      return window.sessionStorage.getItem(STORAGE_KEY) || '';
    } catch (error) {
      return '';
    }
  }

  function setStoredShowtimeKey(key) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, key);
    } catch (error) {
      // ignore storage issues in kiosk mode
    }
  }

  function clearStoredShowtimeKeyIfDifferent(activeKey) {
    var storedKey = getStoredShowtimeKey();
    if (!storedKey || storedKey === activeKey) return;

    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // ignore storage issues in kiosk mode
    }
  }

  function parseTimeString(value) {
    var match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      return { hour: 16, minute: 5 };
    }

    return {
      hour: Math.max(0, Math.min(23, Number(match[1]))),
      minute: Math.max(0, Math.min(59, Number(match[2])))
    };
  }

  function getPartsFormatter(timeZone) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  function getTimeZoneParts(date, timeZone) {
    var parts = {};
    getPartsFormatter(timeZone).formatToParts(date).forEach(function(part) {
      if (part.type !== 'literal') {
        parts[part.type] = part.value;
      }
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

  function getTimeZoneOffsetMs(date, timeZone) {
    var parts = getTimeZoneParts(date, timeZone);
    var zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return zonedAsUtc - date.getTime();
  }

  function getTimeZoneTimestamp(year, month, day, hour, minute, timeZone) {
    var utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
    var offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
    var timestamp = utcGuess - offset;
    var refinedOffset = getTimeZoneOffsetMs(new Date(timestamp), timeZone);

    if (refinedOffset !== offset) {
      timestamp = utcGuess - refinedOffset;
    }

    return timestamp;
  }

  function formatClockTime(date, timeZone) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone,
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  }

  function formatCalendarDate(date, timeZone) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  }

  function formatTargetLabel(timestamp, timeZone) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(timestamp));
  }

  function formatTargetTimeLabel(timestamp, timeZone) {
    return formatClockTime(new Date(timestamp), timeZone) + ' ET';
  }

  function getSpotifyPresets() {
    return Array.isArray(SPOTIFY_CONFIG.presets) ? SPOTIFY_CONFIG.presets.filter(function(preset) {
      return preset && preset.id && preset.uri;
    }) : [];
  }

  function getSpotifyPresetById(presetId) {
    return getSpotifyPresets().find(function(preset) {
      return preset.id === presetId;
    }) || null;
  }

  function getDefaultSpotifyPreset() {
    var presets = getSpotifyPresets();
    return getSpotifyPresetById(SPOTIFY_CONFIG.defaultPresetId) || presets[0] || null;
  }

  function spotifyUriToOpenUrl(uri) {
    var baseUrl = SPOTIFY_CONFIG.openInSpotifyBaseUrl || 'https://open.spotify.com';
    var match = String(uri || '').match(/^spotify:(album|artist|episode|playlist|show|track):([A-Za-z0-9]+)$/);

    if (match) {
      return baseUrl.replace(/\/$/, '') + '/' + match[1] + '/' + match[2];
    }

    if (/^https?:\/\//.test(String(uri || ''))) {
      return uri;
    }

    return baseUrl;
  }

  function spotifyUriToEmbedUrl(uri) {
    var openUrl = spotifyUriToOpenUrl(uri);
    var matchedPath = openUrl.match(/^https?:\/\/open\.spotify\.com\/(album|artist|episode|playlist|show|track)\/([A-Za-z0-9]+)(?:\?.*)?$/);

    if (!matchedPath) {
      return 'https://open.spotify.com/embed/playlist/2m4ynKHY1H9L0TmOJTdD7r?utm_source=generator&theme=0';
    }

    return 'https://open.spotify.com/embed/' + matchedPath[1] + '/' + matchedPath[2] + '?utm_source=generator&theme=0';
  }

  function updateSpotifyOpenLink(url) {
    var nextUrl = url || spotifyState.currentOpenUrl || 'https://open.spotify.com';
    spotifyState.currentOpenUrl = nextUrl;

    if (spotifyOpenLinkEl) {
      spotifyOpenLinkEl.href = nextUrl;
    }
  }

  function updateFooterStackHeight() {
    if (!footerStackEl) return;
    document.documentElement.style.setProperty('--footer-stack-height', Math.ceil(footerStackEl.getBoundingClientRect().height) + 'px');
  }

  function bindFooterStackHeight() {
    if (!footerStackEl) return;

    updateFooterStackHeight();
    window.addEventListener('resize', updateFooterStackHeight);

    if ('ResizeObserver' in window) {
      footerHeightObserver = new ResizeObserver(updateFooterStackHeight);
      footerHeightObserver.observe(footerStackEl);
    }
  }

  function setSpotifyStatus(text) {
    if (spotifyStatusEl) {
      spotifyStatusEl.textContent = text;
    }
  }

  function setSpotifyExpanded(isExpanded) {
    spotifyState.isExpanded = !!isExpanded;

    if (spotifyDockEl) {
      spotifyDockEl.classList.toggle('is-expanded', spotifyState.isExpanded);
    }

    if (spotifyExpandButtonEl) {
      spotifyExpandButtonEl.textContent = spotifyState.isExpanded ? 'Hide player' : 'Show player';
      spotifyExpandButtonEl.setAttribute('aria-pressed', spotifyState.isExpanded ? 'true' : 'false');
    }

    window.setTimeout(updateFooterStackHeight, 30);
  }

  function setSpotifyArtwork(src, alt) {
    if (!spotifyTrackArtEl) return;
    spotifyTrackArtEl.src = src || 'heatwave-logo.png';
    spotifyTrackArtEl.alt = alt || '';
  }

  function setSpotifyTitle(title, meta) {
    if (spotifyTrackTitleEl) {
      spotifyTrackTitleEl.textContent = title;
    }

    if (spotifyTrackMetaEl) {
      spotifyTrackMetaEl.textContent = meta;
    }
  }

  function renderSpotifyControls() {
    var preset = getSpotifyPresetById(spotifyState.currentPresetId) || getDefaultSpotifyPreset();
    var statusText = 'Pick a room vibe.';

    if (spotifyPresetsEl) {
      Array.prototype.forEach.call(spotifyPresetsEl.querySelectorAll('[data-spotify-preset]'), function(button) {
        var isActive = button.getAttribute('data-spotify-preset') === spotifyState.currentPresetId;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }

    if (spotifyState.isExpanded && spotifyState.embedReady) {
      statusText = 'Player open — use Spotify for play, pause, and volume.';
    } else if (spotifyState.isExpanded) {
      statusText = 'Opening the player…';
    } else if (preset) {
      statusText = 'Ready with ' + preset.label + '.';
    }

    setSpotifyStatus(statusText);
  }

  function loadSpotifyPreset(presetId) {
    var preset = getSpotifyPresetById(presetId) || getDefaultSpotifyPreset();
    if (!preset) return;

    spotifyState.currentPresetId = preset.id;
    spotifyState.embedReady = false;

    setSpotifyArtwork('heatwave-logo.png', '');
    setSpotifyTitle(preset.label + ' room mix', preset.helperText || 'Log into Spotify in this browser for ad-free playback with Premium.');
    updateSpotifyOpenLink(spotifyUriToOpenUrl(preset.uri));

    if (spotifyEmbedFrameEl) {
      var nextEmbedUrl = spotifyUriToEmbedUrl(preset.uri);
      if (spotifyEmbedFrameEl.src !== nextEmbedUrl) {
        spotifyEmbedFrameEl.src = nextEmbedUrl;
      }
    }

    setSpotifyStatus('Ready with ' + preset.label + '.');
    renderSpotifyControls();
  }

  function mountSpotifyPresets() {
    if (!spotifyPresetsEl) return;

    var presets = getSpotifyPresets();
    spotifyPresetsEl.innerHTML = '';

    presets.forEach(function(preset) {
      var button = document.createElement('button');
      button.className = 'spotify-preset';
      button.type = 'button';
      button.textContent = preset.label;
      button.setAttribute('data-spotify-preset', preset.id);
      button.addEventListener('click', function() {
        loadSpotifyPreset(preset.id);
      });
      spotifyPresetsEl.appendChild(button);
    });
  }

  function bindSpotifyButtons() {
    if (spotifyExpandButtonEl) {
      spotifyExpandButtonEl.addEventListener('click', function() {
        setSpotifyExpanded(!spotifyState.isExpanded);
      });
    }

    if (spotifyEmbedFrameEl) {
      spotifyEmbedFrameEl.addEventListener('load', function() {
        spotifyState.embedReady = true;
        renderSpotifyControls();
      });
    }
  }

  function initSpotifyDock() {
    if (!spotifyDockEl || SPOTIFY_CONFIG.enabled === false || !spotifyEmbedFrameEl) {
      return;
    }

    mountSpotifyPresets();
    bindSpotifyButtons();
    setSpotifyExpanded(false);

    var defaultPreset = getDefaultSpotifyPreset();
    if (defaultPreset) {
      spotifyState.currentPresetId = defaultPreset.id;
      loadSpotifyPreset(defaultPreset.id);
    }

    renderSpotifyControls();
  }

  function resolveTargetTimestamp() {
    if (COUNTDOWN_CONFIG.isoDate) {
      var parsedIso = Date.parse(COUNTDOWN_CONFIG.isoDate);
      if (Number.isFinite(parsedIso)) {
        return {
          timestamp: parsedIso,
          key: 'iso:' + COUNTDOWN_CONFIG.isoDate,
          label: formatTargetLabel(parsedIso, MEETING_TIME_ZONE)
        };
      }
    }

    var timeOfDay = parseTimeString(COUNTDOWN_CONFIG.time || '16:05');
    var now = Date.now();
    var currentParts = getTimeZoneParts(new Date(now), MEETING_TIME_ZONE);
    var currentDayUtc = new Date(Date.UTC(currentParts.year, currentParts.month - 1, currentParts.day));
    var todayWeekday = currentDayUtc.getUTCDay();
    var daysUntilMeeting = (MEETING_DAY - todayWeekday + 7) % 7;
    var candidateDate = new Date(currentDayUtc.getTime());

    candidateDate.setUTCDate(candidateDate.getUTCDate() + daysUntilMeeting);

    var candidateTimestamp = getTimeZoneTimestamp(
      candidateDate.getUTCFullYear(),
      candidateDate.getUTCMonth() + 1,
      candidateDate.getUTCDate(),
      timeOfDay.hour,
      timeOfDay.minute,
      MEETING_TIME_ZONE
    );

    if (daysUntilMeeting === 0 && now > candidateTimestamp) {
      if (ALLOW_REPEAT || now - candidateTimestamp > PAST_TARGET_GRACE_MS) {
        candidateDate.setUTCDate(candidateDate.getUTCDate() + 7);
        candidateTimestamp = getTimeZoneTimestamp(
          candidateDate.getUTCFullYear(),
          candidateDate.getUTCMonth() + 1,
          candidateDate.getUTCDate(),
          timeOfDay.hour,
          timeOfDay.minute,
          MEETING_TIME_ZONE
        );
      }
    }

    return {
      timestamp: candidateTimestamp,
      key: 'weekly:' + candidateTimestamp,
      label: formatTargetLabel(candidateTimestamp, MEETING_TIME_ZONE)
    };
  }

  function updateClock() {
    var now = new Date();

    if (topDateEl) {
      topDateEl.textContent = new Intl.DateTimeFormat('en-US', {
        timeZone: MEETING_TIME_ZONE,
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      }).format(now);
    }

    if (topTimeEl) {
      topTimeEl.textContent = new Intl.DateTimeFormat('en-US', {
        timeZone: MEETING_TIME_ZONE,
        hour: 'numeric',
        minute: '2-digit'
      }).format(now);
    }
  }

  function syncHeaderMeta() {
    if (!meetingDatetimeEl || !targetState) return;

    var meetingStart = MEETING_CONFIG.publicTimeLabel || '4:00 PM ET';
    var meetingDateLabel = formatCalendarDate(new Date(targetState.timestamp), MEETING_TIME_ZONE);
    meetingDatetimeEl.textContent = meetingDateLabel + ' • ' + meetingStart;
  }

  function syncTargetMeta() {
    targetState = resolveTargetTimestamp();
    clearStoredShowtimeKeyIfDifferent(targetState.key);
    syncHeaderMeta();

    if (countdownTargetLabelEl) {
      countdownTargetLabelEl.textContent = targetState.label;
    }

    if (meetingStartLabelEl) {
      meetingStartLabelEl.textContent = MEETING_CONFIG.publicTimeLabel || '4:00 PM ET';
    }

    if (meetingTargetTimeEl) {
      meetingTargetTimeEl.textContent = formatTargetTimeLabel(targetState.timestamp, MEETING_TIME_ZONE);
    }
  }

  function setPhase(phase) {
    if (currentPhase === phase) return;

    currentPhase = phase;
    document.body.classList.remove('phase-countdown', 'phase-showtime');
    document.body.classList.add('phase-' + phase);

    if (showtimeScreenEl) {
      showtimeScreenEl.setAttribute('aria-hidden', phase === 'showtime' ? 'false' : 'true');
    }
  }

  function renderCountdown(remainingMs) {
    var totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    var days = Math.floor(totalSeconds / 86400);
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;

    if (countdownDaysEl) {
      countdownDaysEl.textContent = String(days).padStart(2, '0');
      countdownDaysEl.classList.toggle('countdown-value--compact', String(days).length >= 3);
      countdownDaysEl.classList.toggle('countdown-value--ultra-compact', String(days).length >= 4);
    }

    if (countdownHoursEl) {
      countdownHoursEl.textContent = String(hours).padStart(2, '0');
    }

    if (countdownMinutesEl) {
      countdownMinutesEl.textContent = String(minutes).padStart(2, '0');
      countdownMinutesEl.classList.remove('countdown-value--compact', 'countdown-value--ultra-compact');
    }

    if (countdownSecondsEl) {
      countdownSecondsEl.textContent = String(seconds).padStart(2, '0');
    }

    if (countdownHeaderEl) {
      countdownHeaderEl.textContent = 'RDU Heat starts in';
    }

    if (countdownContextEl && targetState) {
      countdownContextEl.textContent = 'Counting down to this week\u2019s meeting.';
    }

    if (statusBannerEl) {
      var totalMinutes = Math.floor(totalSeconds / 60);
      if (DEMO_SHOWTIME) {
        statusBannerEl.textContent = 'Demo mode is on.';
      } else if (totalMinutes <= 5) {
        statusBannerEl.textContent = 'Almost time \u2014 grab your seat.';
      } else if (totalMinutes <= 15) {
        statusBannerEl.textContent = 'Meeting starts soon.';
      } else {
        statusBannerEl.textContent = 'See you Thursday.';
      }
    }
  }

  function triggerShowtime() {
    if (hasShowtimeTriggered) return;

    hasShowtimeTriggered = true;

    if (targetState && targetState.key) {
      setStoredShowtimeKey(targetState.key);
    }

    if (statusBannerEl) {
      statusBannerEl.textContent = 'We\u2019re live — let\u2019s go.';
    }

    setPhase('showtime');
    setEmberRate(700);

    if (countdownTimerId) {
      clearInterval(countdownTimerId);
      countdownTimerId = null;
    }
  }

  function restoreShowtimeIfNeeded() {
    var storedKey = getStoredShowtimeKey();

    if (DEMO_SHOWTIME) {
      triggerShowtime();
      return true;
    }

    if (targetState && storedKey && storedKey === targetState.key) {
      triggerShowtime();
      return true;
    }

    return false;
  }

  function tickCountdown() {
    updateClock();

    if (!targetState) {
      syncTargetMeta();
    }

    if (restoreShowtimeIfNeeded()) {
      return;
    }

    var remaining = targetState.timestamp - Date.now();

    if (remaining <= 0) {
      if (ALLOW_REPEAT) {
        syncTargetMeta();
        remaining = targetState.timestamp - Date.now();
      }

      if (remaining <= 0) {
        triggerShowtime();
        return;
      }
    }

    setPhase('countdown');
    setEmberRate(1600);
    renderCountdown(remaining);
  }

  function formatCurrency(value) {
    return '$' + Number(value).toLocaleString('en-US');
  }

  function buildTicker() {
    if (!tickerContentEl) return;

    var items = [
      stats.bizChats + ' BizChats',
      stats.guestsHosted + ' guests hosted',
      formatCurrency(stats.revenue) + ' revenue generated',
      stats.referrals + ' referrals passed',
      stats.guestIncentives + ' gratitude incentives received',
      'Rolling 12-month stats • RDU Heatwave'
    ];

    var html = items.map(function(item) {
      return '<span class="ticker-item">' + item + '</span><span class="ticker-sep">•</span>';
    }).join('');

    tickerContentEl.innerHTML = html + html;
  }

  function fetchStatsOnce() {
    if (!liveStatsPromise) {
      liveStatsPromise = fetch('/api/stats')
        .then(function(response) {
          if (!response.ok) throw new Error('stats unavailable');
          return response.json();
        })
        .catch(function() {
          return null;
        });
    }

    return liveStatsPromise;
  }

  function hydrateLiveStats() {
    buildTicker();

    fetchStatsOnce().then(function(data) {
      if (!data || data.status !== 'ok' || !data.stats) return;

      stats.bizChats = data.stats.bizChats || stats.bizChats;
      stats.guestsHosted = data.stats.guestsHosted || stats.guestsHosted;
      stats.revenue = data.stats.revenue || stats.revenue;
      stats.referrals = data.stats.referrals || stats.referrals;
      stats.guestIncentives = data.stats.guestIncentives || stats.guestIncentives;
      buildTicker();
    });
  }

  function normalizeName(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function getSpeakerInitials(name) {
    return String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .map(function(word) { return word.charAt(0); })
      .join('')
      .slice(0, 3)
      .toUpperCase();
  }

  function renderSpeakerCard() {
    if (speakerNameEl) speakerNameEl.textContent = speakerState.name;
    if (speakerCompanyEl) speakerCompanyEl.textContent = speakerState.company || 'Featured member';

    if (speakerCardBodyEl) {
      speakerCardBodyEl.textContent = 'Featured today.';
    }

    if (showtimeSpeakerEl) {
      showtimeSpeakerEl.textContent = 'Featured member: ' + speakerState.name + (speakerState.company ? ' • ' + speakerState.company : '');
    }

    if (speakerInitialsEl) {
      speakerInitialsEl.textContent = getSpeakerInitials(speakerState.name);
    }

    if (!speakerHeadshotEl) return;

    if (speakerState.photo) {
      speakerHeadshotEl.onerror = function() {
        speakerState.photo = '';
        renderSpeakerCard();
      };
      speakerHeadshotEl.src = speakerState.photo;
      speakerHeadshotEl.alt = speakerState.name;
      speakerHeadshotEl.style.display = 'block';
      speakerHeadshotEl.style.objectPosition = speakerState.photoObjectPosition || 'center center';
      if (speakerInitialsEl) {
        speakerInitialsEl.style.display = 'none';
      }
    } else {
      speakerHeadshotEl.removeAttribute('src');
      speakerHeadshotEl.style.display = 'none';
      if (speakerInitialsEl) {
        speakerInitialsEl.style.display = 'inline-flex';
      }
    }
  }

  function hydrateSpeakerPhoto() {
    if (!speakerState.name || speakerState.photo) {
      renderSpeakerCard();
      return;
    }

    renderSpeakerCard();

    fetch('/api/members')
      .then(function(response) {
        if (!response.ok) throw new Error('members unavailable');
        return response.json();
      })
      .then(function(data) {
        if (!data || !Array.isArray(data.members)) return;

        var targetName = normalizeName(speakerState.name);
        var match = data.members.find(function(member) {
          return normalizeName(member && member.name) === targetName;
        });

        if (!match) return;
        if (!speakerState.company && match.company) speakerState.company = match.company;
        if (match.photo) speakerState.photo = match.photo;
        if (match.photoObjectPosition) speakerState.photoObjectPosition = match.photoObjectPosition;
        renderSpeakerCard();
      })
      .catch(function() {
        renderSpeakerCard();
      });
  }

  function setEventsSyncLabel(text) {
    if (eventsSyncPillEl) {
      eventsSyncPillEl.textContent = text;
    }
  }

  function formatEventDate(date) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: MEETING_TIME_ZONE,
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  function formatEventTime(start, end, allDay) {
    if (allDay) return 'All day';

    var formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: MEETING_TIME_ZONE,
      hour: 'numeric',
      minute: '2-digit'
    });
    var startLabel = formatter.format(start);

    if (!end || isNaN(end.getTime())) {
      return startLabel;
    }

    return startLabel + '–' + formatter.format(end);
  }

  function renderUpcomingEvents(payload) {
    if (!upcomingEventsListEl) return;

    upcomingEventsListEl.innerHTML = '';
    var events = payload && Array.isArray(payload.events) ? payload.events : [];

    if (!events.length) {
      var empty = document.createElement('li');
      empty.className = 'meet-events__empty';
      empty.textContent = 'No extra events on deck right now.';
      upcomingEventsListEl.appendChild(empty);
      setEventsSyncLabel('Weekly schedule');
      return;
    }

    events.slice(0, 2).forEach(function(event) {
      var item = document.createElement('li');
      var title = document.createElement('strong');
      var start = new Date(event.start);
      var end = event.end ? new Date(event.end) : null;
      var meta = document.createElement('span');
      var locationShort = event.location ? event.location.split(',')[0] : '';

      title.textContent = event.title || 'Upcoming event';
      meta.textContent = ' — ' + formatEventDate(start) + ' • ' + formatEventTime(start, end, !!event.allDay) + (locationShort ? ' • ' + locationShort : '');
      item.appendChild(title);
      item.appendChild(meta);
      upcomingEventsListEl.appendChild(item);
    });

    setEventsSyncLabel(payload && payload.source === 'apps-script' ? 'Live calendar' : 'Upcoming');
  }

  function hydrateUpcomingEvents() {
    fetch('/api/upcoming-events')
      .then(function(response) {
        if (!response.ok) throw new Error('upcoming events unavailable');
        return response.json();
      })
      .then(function(payload) {
        renderUpcomingEvents(payload);
      })
      .catch(function() {
        renderUpcomingEvents({ events: [] });
      });
  }

  function setEmberRate(nextRate) {
    if (nextRate === emberRate) return;

    emberRate = nextRate;

    if (emberTimer) {
      clearInterval(emberTimer);
      emberTimer = null;
    }

    if (!embersContainerEl || emberRate <= 0) return;

    emberTimer = setInterval(createEmber, emberRate);
  }

  function createEmber() {
    if (!embersContainerEl) return;
    if (embersContainerEl.childElementCount > 20) return;

    var ember = document.createElement('div');
    ember.className = 'ember';
    ember.style.left = Math.round(Math.random() * 100) + 'vw';
    ember.style.setProperty('--ember-x', Math.round((Math.random() - 0.5) * 14) + 'vw');
    ember.style.setProperty('--ember-rise', (18 + Math.random() * 20).toFixed(1) + 'vh');
    ember.style.animationDuration = (5.5 + Math.random() * 3.5).toFixed(2) + 's';
    embersContainerEl.appendChild(ember);

    window.setTimeout(function() {
      if (ember.parentNode) ember.parentNode.removeChild(ember);
    }, 9500);
  }

  function init() {
    bindFooterStackHeight();
    syncTargetMeta();
    updateClock();
    hydrateLiveStats();
    hydrateSpeakerPhoto();
    hydrateUpcomingEvents();
    initSpotifyDock();

    if (restoreShowtimeIfNeeded()) {
      return;
    }

    tickCountdown();
    countdownTimerId = window.setInterval(tickCountdown, CHECK_INTERVAL_MS);
  }

  init();
})();
