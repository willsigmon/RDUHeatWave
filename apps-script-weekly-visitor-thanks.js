// Google Apps Script helper for weekly visitor thank-you emails.
// Uses the same spreadsheet and Guest Check In tab as the website check-in flow.
//
// How to use:
// 1. Create this as a separate Apps Script file in the sheet-bound project.
// 2. Keep WEEKLY_THANKS_DRY_RUN = true and run sendWeeklyVisitorThanks() once.
// 3. Review Logs, then set WEEKLY_THANKS_DRY_RUN = false or add a weekly trigger.

var WEEKLY_THANKS_SHEET_ID = '1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA';
var WEEKLY_THANKS_SHEET_NAME = 'Guest Check In';
var WEEKLY_THANKS_HEADER_ROW = 3;
var WEEKLY_THANKS_LOOKBACK_DAYS = 7;
var WEEKLY_THANKS_DRY_RUN = true;
var WEEKLY_THANKS_REPLY_TO = 'will@willsigmon.media';

function sendWeeklyVisitorThanks() {
  var rows = getWeeklyThanksVisitors_();
  var props = PropertiesService.getScriptProperties();

  rows.forEach(function(row) {
    if (!row.email || !row.firstName) return;

    var sentKey = [
      'weekly-visitor-thanks',
      row.meetingKey,
      row.email.toLowerCase()
    ].join(':');
    if (props.getProperty(sentKey)) return;

    var message = buildWeeklyThanksMessage_(row);
    if (WEEKLY_THANKS_DRY_RUN) {
      Logger.log('---');
      Logger.log('TO: ' + row.email);
      Logger.log('SUBJECT: ' + message.subject);
      Logger.log(message.body);
      return;
    }

    GmailApp.sendEmail(row.email, message.subject, message.body, {
      name: 'RDU Heatwave',
      replyTo: WEEKLY_THANKS_REPLY_TO
    });
    props.setProperty(sentKey, new Date().toISOString());
    Utilities.sleep(250);
  });
}

function getWeeklyThanksVisitors_() {
  var sheet = SpreadsheetApp.openById(WEEKLY_THANKS_SHEET_ID).getSheetByName(WEEKLY_THANKS_SHEET_NAME);
  if (!sheet) throw new Error('Sheet not found: ' + WEEKLY_THANKS_SHEET_NAME);

  var lastRow = sheet.getLastRow();
  if (lastRow <= WEEKLY_THANKS_HEADER_ROW) return [];

  var values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  var headers = values[WEEKLY_THANKS_HEADER_ROW - 1].map(normalizeWeeklyThanksHeader_);
  var rows = values.slice(WEEKLY_THANKS_HEADER_ROW);
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - WEEKLY_THANKS_LOOKBACK_DAYS);

  return rows.map(function(row) {
    var record = buildWeeklyThanksRecord_(headers, row);
    record.meetingDate = normalizeWeeklyThanksDate_(record.meeting);
    record.meetingKey = record.meetingDate || 'unknown-date';
    return record;
  }).filter(function(record) {
    if (!record.email || !record.meetingDate) return false;
    return new Date(record.meetingDate + 'T00:00:00') >= cutoff;
  });
}

function buildWeeklyThanksRecord_(headers, row) {
  function valueFor(name) {
    var idx = headers.indexOf(name);
    return idx >= 0 ? String(row[idx] || '').trim() : '';
  }

  return {
    meeting: valueFor('meeting'),
    firstName: valueFor('firstname'),
    lastName: valueFor('lastname'),
    profession: valueFor('profession'),
    company: valueFor('company'),
    email: valueFor('email'),
    guestOf: valueFor('guestof'),
    firstVisit: valueFor('firstvisit'),
    idealIntro: valueFor('idealintro')
  };
}

function buildWeeklyThanksMessage_(row) {
  var subject = 'Thanks for visiting RDU Heatwave, ' + row.firstName + '!';
  var hostLine = row.guestOf
    ? 'It was great having you as ' + row.guestOf + '\'s guest.'
    : 'It was great having you in the room.';
  var introLine = row.idealIntro
    ? 'I also noted that a good intro for you would be: ' + row.idealIntro + '.'
    : 'If there is a specific introduction that would help you, reply and I will point you in the right direction.';

  return {
    subject: subject,
    body: [
      'Hi ' + row.firstName + ',',
      '',
      'Thanks for visiting Two Twelve / RDU Heatwave this week. ' + hostLine,
      '',
      introLine,
      '',
      'We meet Thursdays at 4:00 PM ET at Clouds Brewing, and you are welcome back anytime.',
      '',
      'Best,',
      'RDU Heatwave',
      'rduheatwave.team'
    ].join('\n')
  };
}

function normalizeWeeklyThanksHeader_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeWeeklyThanksDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  var str = String(value || '').trim();
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

  var parsed = new Date(str.replace(/-/g, '/'));
  if (isNaN(parsed)) return '';
  return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
