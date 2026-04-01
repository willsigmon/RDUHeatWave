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
var ACCESS_CONTROL_SHEET = 'Access Control';
var CRM_ACCESS_PROPERTY_KEY = 'CRM_ACCESS_USERS_JSON';
var CRM_ACCESS_PEPPER_KEY = 'CRM_ACCESS_PEPPER';
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
var CALENDAR_KEYWORDS = ['heatwave', 'rdu', '212'];
var UPCOMING_EVENTS_LOOKAHEAD_DAYS = 120;
var UPCOMING_EVENTS_DEFAULT_LIMIT = 4;
var UPCOMING_EVENTS_MAX_LIMIT = 6;

function acquireLock_(timeoutMs) {
  var lock = LockService.getDocumentLock() || LockService.getScriptLock();
  if (!lock) return null;
  return lock.tryLock(timeoutMs) ? lock : null;
}

function releaseLock_(lock) {
  if (lock) lock.releaseLock();
}

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

var BIZCHAT_REPORT_SHEET_NAME = 'BizChats Report';
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
  if (cleanValue_(params.source) === 'bizchat') {
    return doPostBizChat_(params);
  }
  if (cleanValue_(params.source) === 'crm-update') {
    return doPostCrmUpdate_(params);
  }
  if (cleanValue_(params.source) === 'crm-scrub-access-control') {
    return doPostCrmScrubAccessControl_(params);
  }
  if (cleanValue_(params.source) === 'crm-login') {
    return doPostCrmLogin_(params);
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

function doPostBizChat_(params) {
  var member = cleanValue_(params.member);
  var metWith = cleanValue_(params.metWith);
  var dateStr = cleanValue_(params.date);

  if (!member || !metWith || !dateStr) {
    return jsonOutput_({ status: 'error', message: 'Missing required fields' });
  }

  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = spreadsheet.getSheetByName(BIZCHAT_REPORT_SHEET_NAME);
  if (!sheet) {
    return jsonOutput_({ status: 'error', message: 'BizChats Report sheet not found' });
  }

  var lock = acquireLock_(10000);
  if (!lock) {
    return jsonOutput_({ status: 'error', message: 'Sheet is busy, try again' });
  }

  try {
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];

    // Find the column for each member (first-name match)
    var memberFirstName = normalizePerson_(member.split(/\s+/)[0]);
    var metWithFirstName = normalizePerson_(metWith.split(/\s+/)[0]);

    var memberCol = -1;
    var metWithCol = -1;
    for (var col = 1; col < headers.length; col++) {
      var headerName = normalizePerson_(headers[col]);
      if (headerName === 'weeklytotal' || !headerName) continue;
      if (headerName === memberFirstName) memberCol = col + 1;
      if (headerName === metWithFirstName) metWithCol = col + 1;
    }

    if (memberCol === -1 || metWithCol === -1) {
      return jsonOutput_({ status: 'error', message: 'Member not found in BizChats Report columns' });
    }

    // Find the row for the meeting week containing this date
    var targetDate = new Date(dateStr);
    var timezone = spreadsheet.getSpreadsheetTimeZone() || 'America/New_York';
    var targetKey = Utilities.formatDate(targetDate, timezone, 'M/d/yyyy');

    var dateCol = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();
    var targetRow = -1;

    // Find exact date match or closest preceding date
    for (var row = lastRow - 1; row >= 1; row--) {
      var cellDate = cleanValue_(dateCol[row][0]);
      if (!cellDate) continue;
      if (cellDate === targetKey) {
        targetRow = row + 1;
        break;
      }
      // Check if the cell date is <= target date
      var cellParsed = new Date(cellDate);
      if (!isNaN(cellParsed) && cellParsed <= targetDate) {
        targetRow = row + 1;
        break;
      }
    }

    if (targetRow === -1) {
      return jsonOutput_({ status: 'error', message: 'No matching week found for date ' + dateStr });
    }

    // Increment both members' counts
    var memberCell = sheet.getRange(targetRow, memberCol);
    var metWithCell = sheet.getRange(targetRow, metWithCol);

    var memberVal = asNumber_(memberCell.getValue());
    var metWithVal = asNumber_(metWithCell.getValue());

    memberCell.setValue(memberVal + 1);
    metWithCell.setValue(metWithVal + 1);

    return jsonOutput_({ status: 'ok', message: member + ' + ' + metWith + ' BizChat logged' });
  } finally {
    releaseLock_(lock);
  }
}

// ── Access Control ──────────────────────────────────────────────────
// CRM auth now reads from Script Properties, not the public workbook.
// The "Access Control" tab is only a one-time migration source until the
// current users are copied into Script Properties and their PINs rotated.
// Migration source columns: Name | Email | PIN | Role | Teams | Active
// Roles: regional, area, team, member
//
// Role permissions:
//   regional — All tabs, all teams, R/W
//   area     — All tabs for assigned teams, R/W
//   team     — All tabs for own team, R/W (governance committee)
//   member   — Limited tabs, read-only

var ROLE_HIERARCHY = { regional: 4, area: 3, team: 2, member: 1 };

// Tabs visible per role (member sees a subset; team+ sees all)
var MEMBER_VISIBLE_TABS = [
  'Membership Directory', 'BizChats Report', 'Referral Pipeline',
  'Guest Incentive Report', 'Revenue Report'
];

// Tabs that are always read-only regardless of role
var ALWAYS_READONLY_TABS = [
  'Survey Responses', 'Team Stats', 'Team Stats 2026',
  'BKP Member Directory', 'Guest Check In', 'Access Control'
];

function getScriptProps_() {
  return PropertiesService.getScriptProperties();
}

function getCrmAccessUsers_() {
  var raw = getScriptProps_().getProperty(CRM_ACCESS_PROPERTY_KEY);
  if (!raw) return bootstrapCrmAccessUsersFromSheet_();

  try {
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    Logger.log('Invalid CRM access JSON: ' + error);
    return bootstrapCrmAccessUsersFromSheet_();
  }
}

function saveCrmAccessUsers_(users) {
  getScriptProps_().setProperty(CRM_ACCESS_PROPERTY_KEY, JSON.stringify(users || []));
}

function normalizeTeams_(teams) {
  if (Array.isArray(teams)) {
    return teams.map(function(team) {
      return cleanValue_(team);
    }).filter(Boolean);
  }

  var text = cleanValue_(teams);
  if (!text) return [];

  return text.split(',').map(function(team) {
    return cleanValue_(team);
  }).filter(Boolean);
}

function bytesToHex_(bytes) {
  return bytes.map(function(value) {
    var normalized = value < 0 ? value + 256 : value;
    var hex = normalized.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function getOrCreateCrmPepper_() {
  var props = getScriptProps_();
  var pepper = props.getProperty(CRM_ACCESS_PEPPER_KEY);

  if (!pepper) {
    pepper = Utilities.getUuid() + ':' + new Date().getTime();
    props.setProperty(CRM_ACCESS_PEPPER_KEY, pepper);
  }

  return pepper;
}

function buildPinHash_(pin, salt) {
  var cleanPin = cleanValue_(pin);
  var cleanSalt = cleanValue_(salt);
  var pepper = getOrCreateCrmPepper_();
  var material = cleanSalt + ':' + cleanPin + ':' + pepper;
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    material,
    Utilities.Charset.UTF_8
  );

  return bytesToHex_(digest);
}

function makeSalt_() {
  return Utilities.getUuid().replace(/-/g, '') + String(new Date().getTime());
}

function verifyPin_(suppliedPin, userRecord) {
  if (!userRecord) return false;

  var salt = cleanValue_(userRecord.pinSalt);
  var storedHash = cleanValue_(userRecord.pinHash);
  if (!salt || !storedHash) return false;

  return buildPinHash_(suppliedPin, salt) === storedHash;
}

function bootstrapCrmAccessUsersFromSheet_() {
  var users = buildCrmAccessUsersFromSheet_();
  if (users.length) {
    saveCrmAccessUsers_(users);
    Logger.log('Bootstrapped ' + users.length + ' CRM users from Access Control sheet');
  }
  return users;
}

function buildCrmAccessUsersFromSheet_() {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = spreadsheet.getSheetByName(ACCESS_CONTROL_SHEET);
  if (!sheet) return [];

  var data = sheet.getDataRange().getDisplayValues();
  if (!data.length) return [];

  var firstRow = data[0].map(function(header) {
    return cleanValue_(header).toLowerCase();
  });
  var hasHeaderRow = firstRow.indexOf('pin') !== -1 ||
    (firstRow.indexOf('name') !== -1 && firstRow.indexOf('email') !== -1);
  var headers = hasHeaderRow ? firstRow : ['name', 'email', 'pin', 'role', 'teams', 'active'];
  var nameIdx = headers.indexOf('name');
  var emailIdx = headers.indexOf('email');
  var pinIdx = headers.indexOf('pin');
  var roleIdx = headers.indexOf('role');
  var teamsIdx = headers.indexOf('teams');
  var activeIdx = headers.indexOf('active');

  if (pinIdx < 0) return [];

  getOrCreateCrmPepper_();

  var users = [];
  for (var i = hasHeaderRow ? 1 : 0; i < data.length; i++) {
    var row = data[i];
    var rawPin = cleanValue_(row[pinIdx]);
    if (!rawPin) continue;

    var salt = makeSalt_();
    users.push({
      name: nameIdx >= 0 ? cleanValue_(row[nameIdx]) : '',
      email: emailIdx >= 0 ? cleanValue_(row[emailIdx]).toLowerCase() : '',
      pinHash: buildPinHash_(rawPin, salt),
      pinSalt: salt,
      role: roleIdx >= 0 ? cleanValue_(row[roleIdx]).toLowerCase() : 'member',
      teams: teamsIdx >= 0 ? normalizeTeams_(row[teamsIdx]) : [],
      active: activeIdx >= 0 ? cleanValue_(row[activeIdx]) : 'true'
    });
  }

  return users;
}

function lookupUser_(pin) {
  var suppliedPin = cleanValue_(pin);
  if (!suppliedPin) return null;

  var users = getCrmAccessUsers_();
  for (var i = 0; i < users.length; i++) {
    var record = users[i] || {};
    if (!verifyPin_(suppliedPin, record)) continue;

    var active = cleanValue_(record.active).toLowerCase();
    if (active === 'false' || active === 'no' || active === '0') continue;

    var role = cleanValue_(record.role).toLowerCase();
    var normalizedRole = ROLE_HIERARCHY[role] ? role : 'member';
    var teams = normalizeTeams_(record.teams);

    return {
      name: cleanValue_(record.name),
      email: cleanValue_(record.email),
      role: normalizedRole,
      teams: teams,
      canWrite: ROLE_HIERARCHY[normalizedRole] >= ROLE_HIERARCHY['team']
    };
  }

  return null;
}

function migrateCrmAccessToHashedScriptProperties_() {
  var users = buildCrmAccessUsersFromSheet_();
  if (!users.length) throw new Error('No access control rows found');
  saveCrmAccessUsers_(users);
  Logger.log('Migrated ' + users.length + ' CRM users to hashed Script Properties');
}

function setCrmUserPin_(email, newPin) {
  var targetEmail = cleanValue_(email).toLowerCase();
  var cleanPin = cleanValue_(newPin);
  if (!targetEmail) throw new Error('Email is required');
  if (!cleanPin) throw new Error('PIN is required');

  var users = getCrmAccessUsers_();
  var updated = false;

  for (var i = 0; i < users.length; i++) {
    var record = users[i] || {};
    if (cleanValue_(record.email).toLowerCase() !== targetEmail) continue;

    var salt = makeSalt_();
    record.pinSalt = salt;
    record.pinHash = buildPinHash_(cleanPin, salt);
    users[i] = record;
    updated = true;
    break;
  }

  if (!updated) {
    throw new Error('User not found for email: ' + email);
  }

  saveCrmAccessUsers_(users);
}

function upsertCrmUser_(config) {
  config = config || {};

  var email = cleanValue_(config.email).toLowerCase();
  if (!email) throw new Error('email is required');

  var users = getCrmAccessUsers_();
  var foundIndex = -1;

  for (var i = 0; i < users.length; i++) {
    if (cleanValue_(users[i].email).toLowerCase() === email) {
      foundIndex = i;
      break;
    }
  }

  var existing = foundIndex >= 0 ? users[foundIndex] : {};
  var next = {
    name: cleanValue_(config.name || existing.name),
    email: email,
    role: cleanValue_(config.role || existing.role || 'member').toLowerCase(),
    teams: normalizeTeams_(config.teams != null ? config.teams : existing.teams),
    active: cleanValue_(config.active != null ? config.active : (existing.active || 'true'))
  };

  if (config.pin != null) {
    var salt = makeSalt_();
    next.pinSalt = salt;
    next.pinHash = buildPinHash_(config.pin, salt);
  } else {
    next.pinSalt = existing.pinSalt || '';
    next.pinHash = existing.pinHash || '';
  }

  if (foundIndex >= 0) {
    users[foundIndex] = next;
  } else {
    users.push(next);
  }

  saveCrmAccessUsers_(users);
}

function debugCrmAccessUsers_() {
  var safeUsers = getCrmAccessUsers_().map(function(user) {
    return {
      name: cleanValue_(user.name),
      email: cleanValue_(user.email),
      role: cleanValue_(user.role),
      teams: normalizeTeams_(user.teams),
      active: cleanValue_(user.active),
      hasPinHash: !!cleanValue_(user.pinHash),
      hasPinSalt: !!cleanValue_(user.pinSalt)
    };
  });

  Logger.log(JSON.stringify(safeUsers, null, 2));
}

function doPostCrmLogin_(params) {
  var pin = cleanValue_(params.pin);
  if (!pin) {
    return jsonOutput_({ status: 'error', message: 'PIN is required' });
  }

  var user = lookupUser_(pin);
  if (!user) {
    return jsonOutput_({ status: 'error', message: 'Invalid PIN' });
  }

  // Build the list of tabs this user can see
  var visibleTabs = [];
  var allTabs = [
    'Membership Directory', 'Applications', 'Guest Check In',
    'Guest Incentive Report', 'BizChats Report', 'Referral Pipeline',
    'Revenue Report', 'Attendance Report', 'Survey Responses',
    'Team Stats', 'Team Stats 2026', 'BKP Member Directory'
  ];

  if (user.role === 'member') {
    visibleTabs = MEMBER_VISIBLE_TABS.slice();
  } else {
    visibleTabs = allTabs.slice();
  }

  // Determine which tabs are writable
  var writableTabs = [];
  if (user.canWrite) {
    writableTabs = visibleTabs.filter(function(tab) {
      for (var j = 0; j < ALWAYS_READONLY_TABS.length; j++) {
        if (tab.toLowerCase() === ALWAYS_READONLY_TABS[j].toLowerCase()) return false;
      }
      return true;
    });
  }

  return jsonOutput_({
    status: 'ok',
    user: {
      name: user.name,
      role: user.role,
      teams: user.teams,
      visibleTabs: visibleTabs,
      writableTabs: writableTabs
    }
  });
}

// ── CRM cell updates ──────────────────────────────────────────────
// Writes a single cell value. Validates user PIN and role permissions.
// params: source=crm-update, pin, sheet (tab name), cell (e.g. "B5"), value
function doPostCrmUpdate_(params) {
  var pin = cleanValue_(params.pin);
  var user = lookupUser_(pin);
  if (!user) {
    return jsonOutput_({ status: 'error', message: 'Invalid credentials' });
  }

  if (!user.canWrite) {
    return jsonOutput_({ status: 'error', message: 'Your role does not allow editing' });
  }

  var sheetName = cleanValue_(params.sheet);
  var cellRef = cleanValue_(params.cell);
  var value = params.value != null ? String(params.value) : '';

  if (!sheetName || !cellRef) {
    return jsonOutput_({ status: 'error', message: 'Missing sheet or cell reference' });
  }

  if (!/^[A-Z]{1,3}\d{1,6}$/.test(cellRef)) {
    return jsonOutput_({ status: 'error', message: 'Invalid cell reference: ' + cellRef });
  }

  // Check tab-level write permission
  for (var i = 0; i < ALWAYS_READONLY_TABS.length; i++) {
    if (sheetName.toLowerCase() === ALWAYS_READONLY_TABS[i].toLowerCase()) {
      return jsonOutput_({ status: 'error', message: 'This tab is read-only' });
    }
  }

  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    return jsonOutput_({ status: 'error', message: 'Tab not found: ' + sheetName });
  }

  var lock = acquireLock_(10000);
  if (!lock) {
    return jsonOutput_({ status: 'error', message: 'Sheet is busy, try again' });
  }

  try {
    var range = sheet.getRange(cellRef);

    // Check if cell has a formula (protected)
    var formula = range.getFormula();
    if (formula) {
      return jsonOutput_({ status: 'error', message: 'Cannot edit formula cell' });
    }

    // Coerce numeric values
    var numericValue = Number(value);
    if (value !== '' && !isNaN(numericValue) && String(numericValue) === value) {
      range.setValue(numericValue);
    } else {
      range.setValue(value);
    }

    return jsonOutput_({ status: 'ok', message: 'Cell ' + cellRef + ' updated' });
  } finally {
    releaseLock_(lock);
  }
}

function doPostCrmScrubAccessControl_(params) {
  var pin = cleanValue_(params.pin);
  var user = lookupUser_(pin);
  if (!user) {
    return jsonOutput_({ status: 'error', message: 'Invalid credentials' });
  }

  if (user.role !== 'regional') {
    return jsonOutput_({ status: 'error', message: 'Only regional admins can scrub access control' });
  }

  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = spreadsheet.getSheetByName(ACCESS_CONTROL_SHEET);
  if (!sheet) {
    return jsonOutput_({ status: 'error', message: 'Access Control sheet not found' });
  }

  var lock = acquireLock_(10000);
  if (!lock) {
    return jsonOutput_({ status: 'error', message: 'Sheet is busy, try again' });
  }

  try {
    var values = sheet.getDataRange().getDisplayValues();
    if (!values.length) {
      return jsonOutput_({ status: 'ok', message: 'Access Control sheet already empty', cleared: 0 });
    }

    var firstRow = values[0].map(function(header) {
      return cleanValue_(header).toLowerCase();
    });
    var hasHeaderRow = firstRow.indexOf('pin') !== -1 ||
      (firstRow.indexOf('name') !== -1 && firstRow.indexOf('email') !== -1);
    var pinColumn = hasHeaderRow ? firstRow.indexOf('pin') + 1 : 3;
    if (pinColumn < 1) {
      return jsonOutput_({ status: 'error', message: 'PIN column not found' });
    }

    var startRow = hasHeaderRow ? 2 : 1;
    var rowCount = Math.max(sheet.getLastRow() - startRow + 1, 0);
    if (!rowCount) {
      return jsonOutput_({ status: 'ok', message: 'No public PIN values found', cleared: 0 });
    }

    var range = sheet.getRange(startRow, pinColumn, rowCount, 1);
    var pinValues = range.getDisplayValues();
    var cleared = 0;

    for (var i = 0; i < pinValues.length; i++) {
      if (!cleanValue_(pinValues[i][0])) continue;
      pinValues[i][0] = '';
      cleared += 1;
    }

    if (cleared) {
      range.setValues(pinValues);
    }

    return jsonOutput_({
      status: 'ok',
      message: cleared ? ('Cleared ' + cleared + ' public PIN value' + (cleared === 1 ? '' : 's')) : 'No public PIN values found',
      cleared: cleared
    });
  } finally {
    releaseLock_(lock);
  }
}

function doGet(e) {
  var requestType = normalizeHeader_(((e && e.parameter && (e.parameter.resource || e.parameter.action || e.parameter.type)) || ''));
  if (requestType === 'members' || requestType === 'memberdirectory' || requestType === 'directory') {
    return jsonOutput_(buildMembersResponse_());
  }
  if (requestType === 'upcomingevents' || requestType === 'events' || requestType === 'calendar') {
    return jsonOutput_(buildUpcomingEventsResponse_((e && e.parameter) || {}));
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

function buildUpcomingEventsResponse_(params) {
  var limit = Math.max(1, Math.min(UPCOMING_EVENTS_MAX_LIMIT, asNumber_(params.limit) || UPCOMING_EVENTS_DEFAULT_LIMIT));
  var now = new Date();
  var end = new Date(now.getTime() + (UPCOMING_EVENTS_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000));
  var events = findUpcomingEvents_(now, end).slice(0, limit);

  return {
    status: 'ok',
    source: 'calendar',
    events: events,
    generatedAt: now.toISOString()
  };
}

function findUpcomingEvents_(start, end) {
  var calendars = getCandidateCalendars_();
  var seenCalendars = {};
  var collected = [];
  var seenEvents = {};

  calendars.forEach(function(calendar) {
    if (!calendar) return;

    var calendarKey = '';
    try {
      calendarKey = cleanValue_(calendar.getId());
    } catch (_error) {
      calendarKey = cleanValue_(calendar.getName());
    }
    if (calendarKey && seenCalendars[calendarKey]) return;
    if (calendarKey) seenCalendars[calendarKey] = true;

    var calendarName = cleanValue_(calendar.getName());
    var calendarMatches = matchesCalendarKeyword_(calendarName);
    var events = [];

    try {
      events = calendar.getEvents(start, end) || [];
    } catch (_eventError) {
      events = [];
    }

    events.forEach(function(event) {
      var title = cleanValue_(event.getTitle());
      var description = cleanValue_(event.getDescription());
      var location = cleanValue_(event.getLocation());
      var combined = [title, description, location, calendarName].join(' ');

      if (!(calendarMatches || matchesCalendarKeyword_(combined))) return;

      var startTime = event.getStartTime();
      var endTime = event.getEndTime();
      var key = [
        cleanValue_(event.getId()),
        startTime ? startTime.getTime() : '',
        title
      ].join('|');

      if (seenEvents[key]) return;
      seenEvents[key] = true;

      collected.push({
        title: title || 'Upcoming Event',
        start: startTime ? startTime.toISOString() : '',
        end: endTime ? endTime.toISOString() : '',
        location: location,
        description: description,
        calendarName: calendarName,
        allDay: !!event.isAllDayEvent()
      });
    });
  });

  return collected.filter(function(event) {
    return !!event.start;
  }).sort(function(a, b) {
    return new Date(a.start).getTime() - new Date(b.start).getTime();
  });
}

function getCandidateCalendars_() {
  var calendars = [];

  try {
    calendars.push(CalendarApp.getDefaultCalendar());
  } catch (_defaultError) {}

  try {
    (CalendarApp.getAllCalendars() || []).forEach(function(calendar) {
      if (!calendar) return;
      var name = cleanValue_(calendar.getName());
      if (matchesCalendarKeyword_(name)) {
        calendars.push(calendar);
      }
    });
  } catch (_allError) {}

  if (calendars.length) return calendars;

  try {
    return CalendarApp.getAllCalendars() || [];
  } catch (_fallbackError) {
    return [];
  }
}

function matchesCalendarKeyword_(value) {
  var normalized = cleanValue_(value).toLowerCase();
  if (!normalized) return false;
  return CALENDAR_KEYWORDS.some(function(keyword) {
    return normalized.indexOf(keyword) !== -1;
  });
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
  var lock = acquireLock_(5000);
  if (!lock) return;

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
    releaseLock_(lock);
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
