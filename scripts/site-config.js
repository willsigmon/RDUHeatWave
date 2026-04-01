(function(global) {
  'use strict';

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
      name: 'Will Sigmon',
      company: 'Will Sigmon Media',
      photo: '/member-photos/will-sigmon.jpg',
      photoObjectPosition: 'center 18%'
    }
  };

  global.HEATWAVE_SITE_CONFIG = siteConfig;
})(window);
