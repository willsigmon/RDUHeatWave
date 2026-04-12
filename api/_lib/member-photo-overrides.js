'use strict';

var shared = require('./shared');

// Checked-in speaker/member headshots sourced from public official profiles
// on 2026-03-31 so /meet does not depend on brittle third-party hotlinks.
var PHOTO_OVERRIDES = {
  'will sigmon': {
    photo: '/member-photos/will-sigmon.jpg',
    photoObjectPosition: 'center 18%',
    sourceUrl: 'https://lh3.googleusercontent.com/a/ACg8ocIYpRI36Bq0th_qn7spnte-zssR0tHrkxPSw-omHrB80EsLE-PLaw=s512-c'
  },
  'carter helms': {
    photo: '/member-photos/carter-helms.jpg',
    photoObjectPosition: 'center 18%',
    sourceUrl: 'https://carterhelms.com/carter.jpeg'
  },
  'craig morrill': {
    photo: '/member-photos/craig-morrill.jpg',
    photoObjectPosition: 'center 18%',
    sourceUrl: 'https://www.sgipw.com/wp-content/uploads/2025/12/CraigMorrill-1.jpg'
  },
  'robert courts': {
    photo: '/member-photos/robert-courts.png',
    photoObjectPosition: 'center 20%',
    sourceUrl: 'https://advantagelending.com/wp-content/uploads/2025/06/rcourts-square.png'
  },
  'dana walsh': {
    photo: '/member-photos/dana-walsh.jpg',
    photoObjectPosition: 'center 25%',
    sourceUrl: 'https://strollmag.com'
  },
  'nathan senn': {
    photo: '/member-photos/nathan-senn.jpg',
    photoObjectPosition: 'center 18%',
    sourceUrl: 'https://linkedin.com/in/nathan-senn-2b2332153'
  },
  'sue kerata': {
    photo: '/member-photos/sue-kerata.jpg',
    photoObjectPosition: 'center 20%',
    sourceUrl: 'https://suekhomes.com'
  }
};

function getMemberPhotoOverride(name) {
  var key = shared.normalizeText(name).toLowerCase();
  return PHOTO_OVERRIDES[key] || null;
}

function applyMemberPhotoOverride(member) {
  if (!member || !member.name) return member;

  var override = getMemberPhotoOverride(member.name);
  if (!override) return member;

  return Object.assign({}, member, {
    photo: override.photo,
    photoObjectPosition: override.photoObjectPosition || ''
  });
}

module.exports = {
  applyMemberPhotoOverride: applyMemberPhotoOverride,
  getMemberPhotoOverride: getMemberPhotoOverride,
  PHOTO_OVERRIDES: PHOTO_OVERRIDES
};
