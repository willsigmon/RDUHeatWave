(function(global) {
  'use strict';

  // Speaker rotation roster — alphabetical by first name.
  // Rotation begins Apr 9 2026 with Carter at index 0.
  var SPEAKER_ROSTER = [
    { name: 'Carter Helms', company: 'Highstreet Ins & Financial Svcs', photo: '/member-photos/carter-helms.jpg', photoObjectPosition: 'center 28%' },
    { name: 'Craig Morrill', company: 'Summit Global Investments', photo: '/member-photos/craig-morrill.jpg', photoObjectPosition: 'center 22%' },
    { name: 'Dana Walsh', company: 'Stroll Magazine', photo: '/member-photos/dana-walsh.jpg', photoObjectPosition: 'center 28%' },
    { name: 'David Mercado', company: 'William Douglas Management' },
    { name: 'Nathan Senn', company: 'Franco Restorations' },
    { name: 'Robert Courts', company: 'Advantage Lending', photo: '/member-photos/robert-courts.png', photoObjectPosition: 'center 25%' },
    { name: 'Roni Payne', company: 'R. Payne Financial & Tax Solutions' },
    { name: 'Rusty Sutton', company: 'MonkeyFans Creative' },
    { name: 'Shannida Ramsey', company: 'Ram-Z Services LLC' },
    { name: 'Sue Kerata', company: 'Century 21 Triangle Group', photo: '/member-photos/sue-kerata.jpg', photoObjectPosition: 'center 30%' },
    { name: 'Will Sigmon', company: 'Will Sigmon Media Co.', photo: '/member-photos/will-sigmon.jpg', photoObjectPosition: 'center 35%' }
  ];
  var SPEAKER_OVERRIDES = {
    '2026-04-23': 'Roni Payne',
    '2026-04-30': 'Shannida Ramsey'
  };
  var ROTATION_START = new Date('2026-04-09T00:00:00');
  var MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

  function toIsoDate(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function findSpeakerByName(name) {
    for (var i = 0; i < SPEAKER_ROSTER.length; i++) {
      if (SPEAKER_ROSTER[i].name === name) return SPEAKER_ROSTER[i];
    }
    return null;
  }

  function getSpeakerForMeeting(meetingDate) {
    var override = SPEAKER_OVERRIDES[toIsoDate(meetingDate)];
    if (override) {
      var speakerOverride = findSpeakerByName(override);
      if (speakerOverride) return speakerOverride;
    }

    var offset = Math.round((meetingDate - ROTATION_START) / MS_PER_WEEK);
    var len = SPEAKER_ROSTER.length;
    return SPEAKER_ROSTER[((offset % len) + len) % len];
  }

  // Compute next Thursday in ET so currentSpeaker is always correct.
  function nextThursdayET() {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    var p = {};

    parts.forEach(function(part) {
      p[part.type] = part.value;
    });

    var today = new Date(p.year + '-' + p.month + '-' + p.day + 'T00:00:00');
    var dayOfWeek = today.getDay();
    var diff = dayOfWeek === 4 ? 0 : (4 - dayOfWeek + 7) % 7;
    today.setDate(today.getDate() + diff);
    return today;
  }

  // ── Mentor Moment rotation ──────────────────────────────────────
  // Round 1: original members only (before Shannida & Sue joined),
  //          starting with Rusty on Apr 16 2026, then alphabetical.
  // Round 2+: full roster alphabetical (including Shannida & Sue).
  var MENTOR_ROUND_1 = [
    'Rusty Sutton',
    'Carter Helms',
    'Craig Morrill',
    'Dana Walsh',
    'David Mercado',
    'Nathan Senn',
    'Robert Courts',
    'Roni Payne',
    'Will Sigmon'
  ];
  var MENTOR_ROUND_2 = [
    'Carter Helms',
    'Craig Morrill',
    'Dana Walsh',
    'David Mercado',
    'Nathan Senn',
    'Robert Courts',
    'Roni Payne',
    'Rusty Sutton',
    'Shannida Ramsey',
    'Sue Kerata',
    'Will Sigmon'
  ];
  var MENTOR_OVERRIDES = {
    // Apr 30, 2026: Will is covering Mentor Moment; keep the normal rotation after this week.
    '2026-04-30': 'Will Sigmon'
  };
  var MENTOR_START = new Date('2026-04-16T00:00:00');

  function getMentorForMeeting(meetingDate) {
    var override = MENTOR_OVERRIDES[toIsoDate(meetingDate)];
    if (override) return override;

    var offset = Math.round((meetingDate - MENTOR_START) / MS_PER_WEEK);
    if (offset < 0) return MENTOR_ROUND_1[0];
    if (offset < MENTOR_ROUND_1.length) return MENTOR_ROUND_1[offset];
    var r2Offset = offset - MENTOR_ROUND_1.length;
    return MENTOR_ROUND_2[((r2Offset % MENTOR_ROUND_2.length) + MENTOR_ROUND_2.length) % MENTOR_ROUND_2.length];
  }

  var currentMeeting = nextThursdayET();
  var speaker = getSpeakerForMeeting(currentMeeting);
  var mentor = getMentorForMeeting(currentMeeting);

  var siteConfig = {
    meeting: {
      day: 4,
      dayName: 'Thursday',
      dayNamePlural: 'Thursdays',
      hour: 16,
      minute: 0,
      timezone: 'America/New_York',
      networkingTimeShort: '3:45 PM',
      publicTimeShort: '4:00 PM',
      publicTimeLabel: '4:00 PM ET',
      connectTimeShort: '5:00 PM',
      venueName: 'Clouds Brewing',
      venueCityLabel: 'Clouds Brewing • Raleigh, NC',
      venueLineShort: 'Clouds Brewing • 1233 Front St, Raleigh NC',
      venueAddress: '1233 Front St, Raleigh, NC 27609',
      venueAddressShort: '1233 Front St, Raleigh NC',
      supportMessage: 'Please stay for a drink after the meeting to support the brewery — they provide our space at no cost.'
    },
    countdownTarget: {
      time: '16:00',
      timezone: 'America/New_York',
      isoDate: null,
      allowRepeat: false
    },
    spotify: {
      enabled: true,
      embedHeight: 112,
      defaultPresetId: 'ambient',
      openInSpotifyBaseUrl: 'https://open.spotify.com',
      presets: [
        {
          id: 'ambient',
          label: 'Ambient',
          helperText: 'Low-key and easy during arrivals or before kickoff.',
          uri: 'spotify:playlist:2m4ynKHY1H9L0TmOJTdD7r'
        },
        {
          id: 'oldies',
          label: 'Oldies',
          helperText: 'Friendly classics for the room.',
          uri: 'spotify:playlist:2LH2vppK9VMuJS30gY2tCF'
        },
        {
          id: 'feel-good',
          label: 'Feel good',
          helperText: 'Upbeat without getting chaotic.',
          uri: 'spotify:playlist:3SSU7LNoB2FzEVMTK5ARzG'
        },
        {
          id: 'popular',
          label: 'Popular',
          helperText: 'Current high-energy songs for post-meeting hangs.',
          uri: 'spotify:playlist:6KUQeeIt8LHEoJAhDTiWhM'
        }
      ]
    },
    currentSpeaker: {
      name: speaker.name,
      company: speaker.company,
      photo: speaker.photo || '',
      photoObjectPosition: speaker.photoObjectPosition || ''
    },
    publicStats: {
      asOf: 'April 23, 2026',
      members: 11,
      guestVisits: 178,
      uniqueGuestEmails: 121,
      firstTimeVisitors: 107,
      bizChats: 344,
      referralsPassed: 66,
      totalGis: 40,
      closedRevenue: 249278
    },
    speakerRotation: {
      roster: SPEAKER_ROSTER,
      startDate: ROTATION_START,
      getSpeakerForMeeting: getSpeakerForMeeting
    },
    currentMentor: mentor,
    mentorRotation: {
      round1: MENTOR_ROUND_1,
      round2: MENTOR_ROUND_2,
      startDate: MENTOR_START,
      getMentorForMeeting: getMentorForMeeting
    }
  };

  global.HEATWAVE_SITE_CONFIG = siteConfig;
})(window);
