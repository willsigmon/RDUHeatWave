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
var HEADER_COUNT = 10;
var GUEST_INCENTIVE_SHEET_NAME = 'Guest Incentive Report';
var GUEST_INCENTIVE_HEADER_ROW = 3;
var GUEST_INCENTIVE_SUBHEADER_ROW = 4;
var GUEST_INCENTIVE_DATA_START_ROW = 5;
var LIVE_HEADERS = [
  'Meeting',
  'First Name',
  'Last Name',
  'Profession',
  'Company',
  'Email',
  'Phone',
  'Guest Of',
  'First Visit?',
  'Ideal Intro'
];
var MEMBER_OVERRIDES = {
  'carter helms': { leader: true },
  'craig morrill': { leader: true },
  'will sigmon': { leader: true },
  'rusty sutton': { leader: false, specialTitle: true }
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
var GUEST_INCENTIVE_HOST_ALIASES = {
  carter: ['carter helms'],
  craig: ['craig morrill'],
  dana: ['dana walsh'],
  david: ['david mercado'],
  nate: ['nathan senn', 'nate senn'],
  rusty: ['rusty sutton'],
  robert: ['robert courts'],
  roni: ['roni payne'],
  shannida: ['shannida ramsey'],
  sue: ['sue kerata'],
  will: ['will sigmon']
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Heatwave Tools')
    .addItem('Sync Guest Incentive Report', 'syncGuestIncentiveReport')
    .addItem('Install Guest Sync Trigger', 'installGuestSyncTrigger')
    .addToUi();
}

function onEdit(e) {
  if (!e || !e.range) return;

  var sheet = e.range.getSheet();
  var sheetName = sheet.getName();
  var row = e.range.getRow();

  if (sheetName === SHEET_NAME && row > HEADER_ROW) {
    syncGuestIncentiveReport();
    return;
  }

  if (sheetName === GUEST_INCENTIVE_SHEET_NAME && row >= GUEST_INCENTIVE_DATA_START_ROW) {
    syncGuestIncentiveReport();
  }
}

function onChange(e) {
  if (!e || !e.changeType) return;

  var supportedChangeTypes = {
    EDIT: true,
    INSERT_ROW: true,
    REMOVE_ROW: true,
    INSERT_COLUMN: true,
    REMOVE_COLUMN: true
  };

  if (supportedChangeTypes[e.changeType]) {
    syncGuestIncentiveReport();
  }
}

function syncGuestIncentiveReport() {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  syncGuestIncentiveReport_(spreadsheet);
}

function installGuestSyncTrigger() {
  var hasTrigger = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === 'onChange';
  });

  if (!hasTrigger) {
    ScriptApp.newTrigger('onChange')
      .forSpreadsheet(SHEET_ID)
      .onChange()
      .create();
  }

  SpreadsheetApp.getUi().alert('Guest sync trigger is ready.');
}

var SURVEY_SHEET_NAME = 'Survey Responses';
var SURVEY_HEADERS = [
  'Timestamp',
  'Q1 - Overall Satisfaction',
  'Q2 - Understanding 212',
  'Q3 - Invite Likelihood',
  'Q4 - Valuable Meeting Parts',
  'Q5 - Meeting Effectiveness',
  'Q6 - BizChats (60 days)',
  'Q7 - Referral Quality',
  'Q8 - Main Focus',
  'Q9 - Leadership Satisfaction',
  'Q10 - Open Feedback'
];

function doPost(e) {
  var params = (e && e.parameter) || {};

  if (cleanValue_(params.source) === 'survey') {
    return doPostSurvey_(params);
  }

  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.getSheets()[0] || spreadsheet.insertSheet(SHEET_NAME);
  var now = new Date();
  var timezone = spreadsheet.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'America/New_York';
  var headerRow = getLiveHeaders_(sheet);

  var row = headerRow.map(function(headerCell) {
    switch (normalizeHeader_(headerCell)) {
      case 'meeting':
        return Utilities.formatDate(now, timezone, 'M/d/yyyy');
      case 'firstname':
        return cleanValue_(params.firstName);
      case 'lastname':
        return cleanValue_(params.lastName);
      case 'profession':
        return cleanValue_(params.profession);
      case 'company':
        return cleanValue_(params.companyName);
      case 'email':
        return cleanValue_(params.email);
      case 'phone':
        return cleanValue_(params.phone);
      case 'guestof':
        return cleanValue_(params.guestOf);
      case 'firstvisit':
        return '';
      case 'idealintro':
        return cleanValue_(params.idealReferral);
      default:
        return '';
    }
  });

  var targetRow = Math.max(sheet.getLastRow() + 1, HEADER_ROW + 1);
  sheet.getRange(targetRow, 1, 1, HEADER_COUNT).setValues([row]);

  try {
    syncGuestIncentiveReport_(spreadsheet);
  } catch (error) {
    Logger.log('Guest incentive sync failed after form submit: ' + error);
  }

  return jsonOutput_({ status: 'ok' });
}

function doPostSurvey_(params) {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = spreadsheet.getSheetByName(SURVEY_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SURVEY_SHEET_NAME);
    sheet.getRange(1, 1, 1, SURVEY_HEADERS.length).setValues([SURVEY_HEADERS]);
    sheet.getRange(1, 1, 1, SURVEY_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  var now = new Date();
  var row = [
    now,
    cleanValue_(params.q1),
    cleanValue_(params.q2),
    cleanValue_(params.q3),
    cleanValue_(params.q4),
    cleanValue_(params.q5),
    cleanValue_(params.q6),
    cleanValue_(params.q7),
    cleanValue_(params.q8),
    cleanValue_(params.q9),
    cleanValue_(params.q10)
  ];

  sheet.appendRow(row);
  return jsonOutput_({ status: 'ok' });
}

function doGet(e) {
  var requestType = normalizeHeader_(((e && e.parameter && (e.parameter.resource || e.parameter.action || e.parameter.type)) || ''));
  if (requestType === 'members' || requestType === 'memberdirectory' || requestType === 'directory') {
    return jsonOutput_(buildMembersResponse_());
  }
  if (requestType === 'syncguestincentive' || requestType === 'guestincentive') {
    syncGuestIncentiveReport();
    return jsonOutput_({ status: 'ok', report: GUEST_INCENTIVE_SHEET_NAME, mode: 'points-only' });
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
    { name: 'Rusty Sutton', title: 'Team Marketing Specialist', company: 'MonkeyFans Creative', website: 'https://monkeyfansraleigh.com/about', leader: false, specialTitle: true },
    { name: 'Robert Courts', title: 'Mortgage Lending', company: 'Advantage Lending', website: 'https://advantagelending.com/mortgage-loan-services', leader: false, specialTitle: false },
    { name: 'Dana Walsh', title: 'Magazine Publisher', company: 'Stroll Magazine', website: 'https://strollmag.com/locations/hayes-barton-nc', leader: false, specialTitle: false },
    { name: 'Nathan Senn', title: 'Property Restoration', company: 'Franco Restorations', website: 'https://francorestorations.com', leader: false, specialTitle: false },
    { name: 'Roni Payne', title: 'Accounting / Tax', company: 'R. Payne LLC', website: 'https://rpayne.org/about', leader: false, specialTitle: false },
    { name: 'Shannida Ramsey', title: 'Property Maintenance', company: 'Ram-Z Services LLC', website: 'https://ramzservices.com', leader: false, specialTitle: false },
    { name: 'David Mercado', title: 'HOA Management', company: 'William Douglas Management', website: 'https://wmdouglas.com/raleigh-hoa-management', leader: false, specialTitle: false },
    { name: 'Sue Kerata', title: 'Realtor', company: 'Century 21 Triangle Group', website: 'https://suekhomes.com', leader: false, specialTitle: false }
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

function syncGuestIncentiveReport_(spreadsheet) {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) return;

  try {
    var guestSheet = spreadsheet.getSheetByName(SHEET_NAME);
    var reportSheet = spreadsheet.getSheetByName(GUEST_INCENTIVE_SHEET_NAME);
    if (!guestSheet || !reportSheet) return;

    var reportLastRow = reportSheet.getLastRow();
    var reportLastColumn = reportSheet.getLastColumn();
    if (reportLastRow < GUEST_INCENTIVE_DATA_START_ROW) return;

    var timezone = spreadsheet.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'America/New_York';
    var hostColumns = getGuestIncentiveHostColumns_(reportSheet);
    if (!hostColumns.length) return;

    var counts = buildGuestCountsByWeek_(guestSheet, timezone);
    var members = buildMembersResponse_().members || [];
    var rowCount = reportLastRow - GUEST_INCENTIVE_DATA_START_ROW + 1;
    var reportValues = reportSheet.getRange(GUEST_INCENTIVE_DATA_START_ROW, 1, rowCount, 1).getValues();

    hostColumns.forEach(function(config) {
      config.aliases = resolveGuestIncentiveAliases_(config.label, members);
    });

    // Only write to Points columns for rows that have a valid date.
    // NEVER touch Bonus columns (Carter's manual entries).
    // NEVER touch Weekly Total columns (have spreadsheet formulas).
    // NEVER touch totals rows at the bottom (have SUM formulas).
    hostColumns.forEach(function(config) {
      var output = [];
      var hasDateRows = 0;

      reportValues.forEach(function(row) {
        var weekKey = toDateKey_(row[0], timezone);
        if (!weekKey) {
          // No date = totals row or spacer — skip by not including in output
          return;
        }
        hasDateRows += 1;
        var count = getGuestCountForAliases_(counts, weekKey, config.aliases);
        output.push([count]);
      });

      if (hasDateRows > 0) {
        reportSheet.getRange(GUEST_INCENTIVE_DATA_START_ROW, config.col, hasDateRows, 1).setValues(output);
      }
    });
  } finally {
    lock.releaseLock();
  }
}

function buildGuestCountsByWeek_(guestSheet, timezone) {
  var rowCount = Math.max(guestSheet.getLastRow() - HEADER_ROW, 0);
  var counts = {};
  if (!rowCount) return counts;

  var rows = guestSheet.getRange(HEADER_ROW + 1, 1, rowCount, HEADER_COUNT).getValues();
  rows.forEach(function(row) {
    var weekKey = toDateKey_(row[0], timezone);
    var guestOf = normalizePerson_(row[7]);
    if (!weekKey || !guestOf) return;

    if (!counts[weekKey]) counts[weekKey] = {};
    counts[weekKey][guestOf] = (counts[weekKey][guestOf] || 0) + 1;
  });

  return counts;
}

function getGuestIncentiveHostColumns_(reportSheet) {
  var lastColumn = reportSheet.getLastColumn();
  var headerLabels = getMergedHeaderLabels_(reportSheet, GUEST_INCENTIVE_HEADER_ROW, lastColumn);
  var subheaders = reportSheet.getRange(GUEST_INCENTIVE_SUBHEADER_ROW, 1, 1, lastColumn).getDisplayValues()[0];
  var hostColumns = [];

  for (var col = 1; col <= lastColumn; col += 1) {
    var label = cleanValue_(headerLabels[col]);
    var subheader = normalizeHeader_(subheaders[col - 1]);

    if (!label || normalizeHeader_(label) === 'weeklytotal') continue;
    if (subheader !== 'points') continue;

    var bonusCol = col + 1 <= lastColumn && normalizeHeader_(subheaders[col]) === 'bonus' ? col + 1 : null;
    hostColumns.push({
      label: label,
      col: col,
      bonusCol: bonusCol
    });
  }

  return hostColumns;
}

// getGuestIncentiveWeeklyTotalColumns_ removed — Weekly Total columns
// have spreadsheet formulas maintained by Carter. Never overwrite them.

function getMergedHeaderLabels_(sheet, rowNumber, lastColumn) {
  var labels = {};
  var rowRange = sheet.getRange(rowNumber, 1, 1, lastColumn);
  var values = rowRange.getDisplayValues()[0];

  values.forEach(function(value, index) {
    if (cleanValue_(value)) labels[index + 1] = cleanValue_(value);
  });

  rowRange.getMergedRanges().forEach(function(range) {
    var label = cleanValue_(range.getDisplayValue());
    if (!label || range.getRow() !== rowNumber) return;

    for (var col = range.getColumn(); col < range.getColumn() + range.getNumColumns(); col += 1) {
      labels[col] = label;
    }
  });

  return labels;
}

function resolveGuestIncentiveAliases_(label, members) {
  var aliases = {};
  var normalizedLabel = normalizePerson_(label);
  if (!normalizedLabel) return [];

  aliases[normalizedLabel] = true;

  var overrideAliases = GUEST_INCENTIVE_HOST_ALIASES[normalizedLabel] || [];
  overrideAliases.forEach(function(alias) {
    aliases[normalizePerson_(alias)] = true;
  });

  members.forEach(function(member) {
    if (!member || !member.name) return;

    var fullName = cleanValue_(member.name);
    var firstName = cleanValue_(fullName.split(/\s+/)[0]);
    if (normalizePerson_(fullName) === normalizedLabel || normalizePerson_(firstName) === normalizedLabel) {
      aliases[normalizePerson_(fullName)] = true;
      aliases[normalizePerson_(firstName)] = true;
    }
  });

  return Object.keys(aliases).filter(function(alias) {
    return !!alias;
  });
}

function getGuestCountForAliases_(counts, weekKey, aliases) {
  var weekCounts = counts[weekKey] || {};
  return aliases.reduce(function(sum, alias) {
    return sum + (weekCounts[alias] || 0);
  }, 0);
}

function toDateKey_(value, timezone) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, timezone, 'M/d/yyyy');
  }

  var cleaned = cleanValue_(value);
  if (!cleaned) return '';

  var normalized = cleaned.replace(/-/g, '/');
  var parsed = new Date(normalized);
  if (!isNaN(parsed)) {
    return Utilities.formatDate(parsed, timezone, 'M/d/yyyy');
  }

  return cleaned;
}

function normalizePerson_(value) {
  return cleanValue_(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function asNumber_(value) {
  if (typeof value === 'number' && !isNaN(value)) return value;
  var cleaned = cleanValue_(value);
  if (!cleaned) return 0;
  var numeric = Number(cleaned);
  return isNaN(numeric) ? 0 : numeric;
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
