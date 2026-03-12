// Google Apps Script — paste this into script.google.com
// Connects the RDU Heatwave registration form to the live Google Sheet
//
// Production sheet ID: 1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA
// Destination tab: Guest Check In
// Live header row: row 3, columns A:I
//
// Deploy as: Web App → Execute as: Me → Access: Anyone

var SHEET_ID = '1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA';
var SHEET_NAME = 'Guest Check In';
var MEMBERS_SHEET_NAMES = ['Membership Directory', 'BKP Member Directory'];
var HEADER_ROW = 3;
var HEADER_COUNT = 9;
var LIVE_HEADERS = [
  'Timestamp',
  'Meeting Date',
  'First name',
  'Last name',
  'Profession',
  'Email',
  'Phone',
  'Guest of',
  'First Visit?'
];
var MEMBER_OVERRIDES = {
  'carter helms': { leader: true },
  'craig morrill': { leader: true },
  'will sigmon': { leader: true },
  'rusty sutton': { leader: true, specialTitle: true }
};
var MEMBER_FIELD_ALIASES = {
  name: ['membername', 'name', 'fullname', 'member', 'memberfullname', 'contactname'],
  firstName: ['firstname', 'first'],
  lastName: ['lastname', 'last'],
  title: ['profession', 'title', 'professiontitle', 'professioncategory', 'industry', 'category', 'position'],
  company: ['companyname', 'company', 'businessname', 'business', 'organization'],
  website: ['website', 'homepage', 'companywebsite', 'businesswebsite', 'webaddress', 'site', 'url', 'link'],
  leader: ['leader', 'iscouncil', 'isteamadmin', 'admin', 'officer', 'councilmember'],
  specialTitle: ['specialtitle', 'highlighttitle']
};

function doPost(e) {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.getSheets()[0] || spreadsheet.insertSheet(SHEET_NAME);
  var now = new Date();
  var params = (e && e.parameter) || {};
  var timezone = spreadsheet.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'America/New_York';
  var headerRow = getLiveHeaders_(sheet);

  var row = headerRow.map(function(headerCell) {
    switch (normalizeHeader_(headerCell)) {
      case 'timestamp':
        return now;
      case 'meetingdate':
        return Utilities.formatDate(now, timezone, 'M/d/yyyy');
      case 'firstname':
        return cleanValue_(params.firstName);
      case 'lastname':
        return cleanValue_(params.lastName);
      case 'profession':
        return cleanValue_(params.profession);
      case 'email':
        return cleanValue_(params.email);
      case 'phone':
        return cleanValue_(params.phone);
      case 'guestof':
        return cleanValue_(params.guestOf);
      case 'firstvisit':
        return cleanValue_(params.firstVisit);
      default:
        return '';
    }
  });

  var targetRow = Math.max(sheet.getLastRow() + 1, HEADER_ROW + 1);
  sheet.getRange(targetRow, 1, 1, HEADER_COUNT).setValues([row]);

  return jsonOutput_({ status: 'ok' });
}

function doGet(e) {
  var requestType = normalizeHeader_(((e && e.parameter && (e.parameter.resource || e.parameter.action || e.parameter.type)) || ''));
  if (requestType === 'members' || requestType === 'memberdirectory' || requestType === 'directory') {
    return jsonOutput_(buildMembersResponse_());
  }

  return ContentService
    .createTextOutput('RDU Heatwave form endpoint is live.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function buildMembersResponse_() {
  try {
    var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    var sheet = getMembersSheet_(spreadsheet);
    if (!sheet) {
      return { status: 'ok', source: 'fallback', members: buildFallbackMembers_() };
    }

    var rows = sheet.getDataRange().getDisplayValues();
    var headerIndex = findHeaderRowIndex_(rows);
    if (headerIndex === -1) {
      return { status: 'ok', source: 'fallback', members: buildFallbackMembers_() };
    }

    var headers = rows[headerIndex].map(normalizeHeader_);
    var members = rows.slice(headerIndex + 1).map(function(row) {
      return buildMemberFromRow_(headers, row);
    }).filter(function(member) {
      return member && member.name;
    });

    return {
      status: 'ok',
      source: members.length ? 'membership-directory' : 'fallback',
      members: members.length ? members : buildFallbackMembers_()
    };
  } catch (error) {
    return { status: 'ok', source: 'fallback', members: buildFallbackMembers_() };
  }
}

function getMembersSheet_(spreadsheet) {
  for (var index = 0; index < MEMBERS_SHEET_NAMES.length; index += 1) {
    var namedSheet = spreadsheet.getSheetByName(MEMBERS_SHEET_NAMES[index]);
    if (namedSheet) return namedSheet;
  }
  return null;
}

function buildMemberFromRow_(headers, row) {
  var record = {};
  headers.forEach(function(header, index) {
    record[header] = cleanValue_(row[index]);
  });

  var name = readMemberField_(record, 'name');
  if (!name) {
    name = [readMemberField_(record, 'firstName'), readMemberField_(record, 'lastName')].filter(function(part) {
      return !!part;
    }).join(' ');
  }

  var member = {
    name: cleanValue_(name),
    title: readMemberField_(record, 'title') || 'Member',
    company: readMemberField_(record, 'company'),
    website: normalizeWebsite_(readMemberField_(record, 'website')),
    leader: normalizeBoolean_(readMemberField_(record, 'leader')),
    specialTitle: normalizeBoolean_(readMemberField_(record, 'specialTitle'))
  };

  if (!member.name) {
    return null;
  }

  var override = MEMBER_OVERRIDES[member.name.toLowerCase()];
  if (override) {
    member = {
      name: member.name,
      title: member.title,
      company: member.company,
      website: member.website,
      leader: override.leader === true ? true : member.leader,
      specialTitle: override.specialTitle === true ? true : member.specialTitle
    };
  }

  return member;
}

function readMemberField_(record, fieldName) {
  var aliases = MEMBER_FIELD_ALIASES[fieldName] || [];
  for (var index = 0; index < aliases.length; index += 1) {
    var alias = aliases[index];
    if (record[alias]) return record[alias];
  }
  return '';
}

function findHeaderRowIndex_(rows) {
  for (var rowIndex = 0; rowIndex < Math.min(rows.length, 8); rowIndex += 1) {
    var headers = rows[rowIndex].map(normalizeHeader_);
    var hasName = hasAnyHeader_(headers, MEMBER_FIELD_ALIASES.name);
    var hasSplitName = hasAnyHeader_(headers, MEMBER_FIELD_ALIASES.firstName) && hasAnyHeader_(headers, MEMBER_FIELD_ALIASES.lastName);
    var hasTitle = hasAnyHeader_(headers, MEMBER_FIELD_ALIASES.title);
    if ((hasName || hasSplitName) && hasTitle) {
      return rowIndex;
    }
  }
  return -1;
}

function hasAnyHeader_(headers, aliases) {
  return aliases.some(function(alias) {
    return headers.indexOf(alias) !== -1;
  });
}

function buildFallbackMembers_() {
  return [
    { name: 'Carter Helms', title: 'Team Chair', company: 'Highstreet Ins & Financial Svcs', website: 'https://carterhelms.com', leader: true, specialTitle: false },
    { name: 'Craig Morrill', title: 'Vice Chair', company: 'Summit Global', website: '', leader: true, specialTitle: false },
    { name: 'Will Sigmon', title: 'Team Admin', company: 'Will Sigmon Media', website: 'https://willsigmon.media', leader: true, specialTitle: false },
    { name: 'Rusty Sutton', title: 'Team Marketing Specialist', company: 'Monkey Fans Creative', website: 'https://monkeyfansraleigh.com', leader: true, specialTitle: true },
    { name: 'Robert Courts', title: 'Mortgage Lending', company: 'Advantage Lending', website: 'https://advantagelending.com', leader: false, specialTitle: false },
    { name: 'Dana Walsh', title: 'Magazine Publisher', company: 'Stroll Magazine', website: 'https://strollmag.com/locations/hayes-barton-nc', leader: false, specialTitle: false },
    { name: 'Nathan Senn', title: 'Property Restoration', company: 'Franco Restorations', website: 'https://francorestorations.com', leader: false, specialTitle: false },
    { name: 'Roni Payne', title: 'Accounting / Tax', company: 'R. Payne LLC', website: '', leader: false, specialTitle: false }
  ];
}

function getLiveHeaders_(sheet) {
  var headerRow = sheet.getRange(HEADER_ROW, 1, 1, HEADER_COUNT).getValues()[0];
  var hasHeaderValues = headerRow.some(function(cell) {
    return String(cell || '').trim() !== '';
  });

  if (!hasHeaderValues) {
    sheet.getRange(HEADER_ROW, 1, 1, HEADER_COUNT).setValues([LIVE_HEADERS]);
    return LIVE_HEADERS.slice();
  }

  return headerRow.map(function(cell, index) {
    return String(cell || '').trim() || LIVE_HEADERS[index];
  });
}

function normalizeBoolean_(value) {
  var normalized = normalizeHeader_(value);
  return normalized === 'true' || normalized === 'yes' || normalized === '1';
}

function normalizeWebsite_(value) {
  var cleaned = cleanValue_(value);
  if (!cleaned) return '';
  if (/^(mailto:|tel:)/i.test(cleaned)) return cleaned;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned)) return cleaned;
  return 'https://' + cleaned.replace(/^\/+/, '');
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeHeader_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function cleanValue_(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}
