(function(global) {
  'use strict';

  // Speaker rotation roster — alphabetical by first name.
  // Rotation begins Apr 9 2026 with Carter at index 0.
  var SPEAKER_ROSTER = [
    { name: 'Carter Helms', company: 'Highstreet Ins & Financial Svcs', photo: '/member-photos/carter-helms.jpg', photoObjectPosition: 'center 18%' },
    { name: 'Craig Morrill', company: 'Summit Global Investments', photo: '/member-photos/craig-morrill.jpg', photoObjectPosition: 'center 18%' },
    { name: 'Dana Walsh', company: 'Stroll Magazine' },
    { name: 'David Mercado', company: 'William Douglas Management' },
    { name: 'Nathan Senn', company: 'Franco Restorations' },
    { name: 'Robert Courts', company: 'Advantage Lending', photo: '/member-photos/robert-courts.png', photoObjectPosition: 'center 20%' },
    { name: 'Roni Payne', company: 'R. Payne LLC' },
    { name: 'Rusty Sutton', company: 'MonkeyFans Creative' },
    { name: 'Shannida Ramsey', company: 'Ram-Z Services LLC' },
    { name: 'Sue Kerata', company: 'Century 21 Triangle Group' },
    { name: 'Will Sigmon', company: 'Will Sigmon Media', photo: '/member-photos/will-sigmon.jpg', photoObjectPosition: 'center 18%' }
  ];
  var ROTATION_START = new Date('2026-04-09T00:00:00');
  var MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

  function getSpeakerForMeeting(meetingDate) {
    var offset = Math.round((meetingDate - ROTATION_START) / MS_PER_WEEK);
    var len = SPEAKER_ROSTER.length;
    return SPEAKER_ROSTER[((offset % len) + len) % len];
  }

  // Compute next Thursday in ET so currentSpeaker is always correct
  function nextThursdayET() {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    var p = {};
    parts.forEach(function(x) { p[x.type] = x.value; });
    var today = new Date(p.year + '-' + p.month + '-' + p.day + 'T00:00:00');
    var dow = today.getDay();
    var diff = dow === 4 ? 0 : (4 - dow + 7) % 7;
    today.setDate(today.getDate() + diff);
    return today;
  }

  var currentMeeting = nextThursdayET();
  var speaker = getSpeakerForMeeting(currentMeeting);

  var siteConfig = {
    meeting: {
      day: 4, // Thursday
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
    currentSpeaker: {
      name: speaker.name,
      company: speaker.company,
      photo: speaker.photo || '',
      photoObjectPosition: speaker.photoObjectPosition || ''
    },
    speakerRotation: {
      roster: SPEAKER_ROSTER,
      startDate: ROTATION_START,
      getSpeakerForMeeting: getSpeakerForMeeting
    }
  };

  global.HEATWAVE_SITE_CONFIG = siteConfig;
})(window);
