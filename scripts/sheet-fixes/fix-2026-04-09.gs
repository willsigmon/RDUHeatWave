/**
 * RDU Heatwave — Apply verified 4/9/2026 card data + fill blanks with 0.
 *
 * HOW TO USE:
 *   1. Open the Team Stats 2026 sheet:
 *      https://docs.google.com/spreadsheets/d/1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA/
 *   2. Extensions → Apps Script
 *   3. Paste this whole file into Code.gs (replace any existing code)
 *   4. FIRST run `dryRun()` — it only logs what it *would* change. View logs.
 *   5. If the log looks right, run `apply()` — it writes the changes.
 *   6. Run `fillAllBlanksWithZero()` separately to zero out every other blank
 *      cell in the past rows across the three weekly tabs.
 *
 * SAFETY:
 *   - Only touches the 4/9/2026 row for `apply()`.
 *   - Never overwrites existing non-empty cells except where the card value
 *     differs from what's there (Chad's "-" placeholder is preserved).
 *   - `fillAllBlanksWithZero()` only fills *blank* cells, never overwrites.
 *   - Suspicious values (Carter=23, Will=24 in BizChats) are logged, not changed.
 */

var MEETING_DATE = '2026-04-09'; // target row date — used for lookup in col A
var SHEET_ID = '1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA'; // Team Stats 2026

function getSheet_() {
  // Works whether run as standalone or container-bound
  try {
    var active = SpreadsheetApp.getActive();
    if (active && active.getId() === SHEET_ID) return active;
  } catch (e) {}
  return SpreadsheetApp.openById(SHEET_ID);
}

// Verified from physical Two Twelve cards (4/9/26 meeting).
// Shape: tab name → { columnHeaderRowIndex, dataStartRowIndex, cardData }
// cardData is keyed by member name; values are numbers we know for certain.
var TAB_FIXES = {
  'BizChats Report': {
    // single Given column per member
    mode: 'single',
    cardData: {
      'Rusty': 3,
      'Robert': 5,
      'Dana': 3
    },
    // columns to NEVER touch (Chad is inactive → keep "-")
    skipMembers: ['Chad'],
    suspiciousCheck: function(rowValues, headers, colIdx) {
      // flag any weekly value > 15 — bigger than any prior weekly for that member
      var alerts = [];
      for (var i = 1; i < headers.length - 1; i++) { // skip date col and Weekly Total
        var v = rowValues[i];
        if (typeof v === 'number' && v > 15) {
          alerts.push(headers[i] + '=' + v + ' (col ' + columnLetter(i + 1) + ')');
        }
      }
      return alerts;
    }
  },
  'GIs Report': {
    mode: 'given-rcvd',     // each member has two columns: Given + Rcvd
    cardData: {
      'Rusty':  { given: 2, rcvd: 0 },
      'Robert': { given: 0, rcvd: 0 },
      'Dana':   { given: 0, rcvd: 0 }
    },
    skipMembers: ['Chad'],
    headerRowOffset: 1   // Given/Rcvd sub-header sits one row below member header
  },
  'Passed Referrals Report': {
    mode: 'given-rcvd',
    // from corrected 4/9 markdown; member-to-member only
    cardData: {
      'Carter': { given: 2, rcvd: 1 },
      'Dana':   { given: 2, rcvd: 1 },
      'Rusty':  { given: 1, rcvd: 1 },
      'Will':   { given: 1, rcvd: 1 }
      // NOTE: Shannida (gave 1 to Rusty), Sue (rcvd 1 from Dana), and any
      // David activity cannot be written — this tab has no columns for them.
    },
    skipMembers: ['Chad'],
    headerRowOffset: 1,
    structuralWarning: 'This tab is missing columns for Shannida, Sue, and David — ' +
      'Shannida gave 1 referral to Rusty (unrecorded here). Add those columns manually.'
  }
};

// ─── ENTRY POINTS ────────────────────────────────────────────────────────────

function dryRun() {
  run_(/* write */ false);
}

function apply() {
  run_(/* write */ true);
}

/**
 * Fills every blank cell in the member columns of the three weekly tabs with 0.
 * Preserves any cell that already has a value (including "-" for Chad).
 * Only fills blanks in rows whose date ≤ today (doesn't pre-fill future rows).
 */
function fillAllBlanksWithZero() {
  var ss = getSheet_();
  var today = new Date();
  today.setHours(23, 59, 59, 999);

  Object.keys(TAB_FIXES).forEach(function(tabName) {
    var cfg = TAB_FIXES[tabName];
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) { Logger.log('Skipping missing tab: ' + tabName); return; }

    var range = sheet.getDataRange();
    var values = range.getValues();
    var headerRow = findHeaderRow_(values);
    if (headerRow < 0) { Logger.log('Could not find header row for ' + tabName); return; }

    var filled = 0;
    for (var r = headerRow + 1 + (cfg.headerRowOffset || 0); r < values.length; r++) {
      var rowDate = parseRowDate_(values[r][0]);
      if (!rowDate || rowDate > today) continue; // skip non-dates and future weeks

      for (var c = 1; c < values[r].length - (cfg.mode === 'given-rcvd' ? 2 : 1); c++) {
        var cell = values[r][c];
        if (cell === '' || cell === null) {
          sheet.getRange(r + 1, c + 1).setValue(0);
          filled++;
        }
      }
    }
    Logger.log(tabName + ': filled ' + filled + ' blank cell(s) with 0');
  });
  SpreadsheetApp.flush();
}

// ─── CORE LOGIC ──────────────────────────────────────────────────────────────

function run_(write) {
  var ss = getSheet_();
  var summary = [];

  Object.keys(TAB_FIXES).forEach(function(tabName) {
    var cfg = TAB_FIXES[tabName];
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) { summary.push('⚠ Tab "' + tabName + '" not found'); return; }

    summary.push('\n=== ' + tabName + ' ===');
    if (cfg.structuralWarning) summary.push('  STRUCTURE NOTE: ' + cfg.structuralWarning);

    var values = sheet.getDataRange().getValues();
    var headerRow = findHeaderRow_(values);
    if (headerRow < 0) { summary.push('  ✗ No header row'); return; }

    var headers = values[headerRow];
    var targetRow = findDateRow_(values, MEETING_DATE);
    if (targetRow < 0) { summary.push('  ✗ No row for ' + MEETING_DATE); return; }

    // Apply card data
    var skip = new Set(cfg.skipMembers || []);
    Object.keys(cfg.cardData).forEach(function(member) {
      if (skip.has(member)) return;
      var colIdx = findMemberColumn_(headers, member, cfg.mode);
      if (colIdx < 0) { summary.push('  ? No column for ' + member); return; }

      var cardVal = cfg.cardData[member];
      if (cfg.mode === 'single') {
        var cur = values[targetRow][colIdx];
        summary.push('  ' + member + ' (' + columnLetter(colIdx + 1) + (targetRow + 1) + '): ' +
          JSON.stringify(cur) + ' → ' + cardVal);
        if (write) sheet.getRange(targetRow + 1, colIdx + 1).setValue(cardVal);
      } else {
        // given-rcvd: colIdx = Given col, colIdx+1 = Rcvd col
        var curG = values[targetRow][colIdx];
        var curR = values[targetRow][colIdx + 1];
        summary.push('  ' + member + ' Given (' + columnLetter(colIdx + 1) + (targetRow + 1) + '): ' +
          JSON.stringify(curG) + ' → ' + cardVal.given);
        summary.push('  ' + member + ' Rcvd  (' + columnLetter(colIdx + 2) + (targetRow + 1) + '): ' +
          JSON.stringify(curR) + ' → ' + cardVal.rcvd);
        if (write) {
          sheet.getRange(targetRow + 1, colIdx + 1).setValue(cardVal.given);
          sheet.getRange(targetRow + 1, colIdx + 2).setValue(cardVal.rcvd);
        }
      }
    });

    // Fill remaining blanks in this row with 0 (skipping Chad's dash cells)
    var chadCol = findMemberColumn_(headers, 'Chad', cfg.mode);
    var rowLen = values[targetRow].length;
    var blanksFilled = 0;
    for (var c = 1; c < rowLen - (cfg.mode === 'given-rcvd' ? 2 : 1); c++) {
      if (chadCol >= 0 && (c === chadCol || (cfg.mode === 'given-rcvd' && c === chadCol + 1))) continue;
      var v = values[targetRow][c];
      if (v === '' || v === null) {
        if (write) sheet.getRange(targetRow + 1, c + 1).setValue(0);
        blanksFilled++;
      }
    }
    summary.push('  → ' + blanksFilled + ' remaining blank cells in 4/9 row filled with 0');

    // Suspicious-value check
    if (cfg.suspiciousCheck) {
      var alerts = cfg.suspiciousCheck(values[targetRow], headers, 0);
      if (alerts.length) {
        summary.push('  ⚠ SUSPICIOUS (please verify manually): ' + alerts.join(', '));
      }
    }
  });

  summary.push('\n' + (write ? '✓ APPLIED' : '✓ DRY RUN COMPLETE — no changes written'));
  Logger.log(summary.join('\n'));
  if (write) SpreadsheetApp.flush();
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function findHeaderRow_(values) {
  // The header row contains "Rolling 12 Mo" as cell A.
  for (var r = 0; r < Math.min(10, values.length); r++) {
    if (String(values[r][0]).trim().toLowerCase().indexOf('rolling') === 0) return r;
  }
  return -1;
}

function findMemberColumn_(headers, member, mode) {
  var wanted = member.trim().toLowerCase();
  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c]).trim().toLowerCase();
    if (h === wanted) return c;
    // "Nathan" / "Nate" alias
    if (wanted === 'nathan' && h === 'nate') return c;
    if (wanted === 'nate' && h === 'nathan') return c;
  }
  return -1;
}

function findDateRow_(values, iso) {
  var target = new Date(iso + 'T00:00:00').getTime();
  for (var r = 0; r < values.length; r++) {
    var d = parseRowDate_(values[r][0]);
    if (d && d.getTime() === target) return r;
  }
  return -1;
}

function parseRowDate_(cell) {
  if (cell instanceof Date) return cell;
  if (typeof cell !== 'string') return null;
  // accepts "4/9/2026", "4-9-26", "04/09/2026"
  var m = cell.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;
  var yr = parseInt(m[3], 10);
  if (yr < 100) yr += 2000;
  var d = new Date(yr, parseInt(m[1], 10) - 1, parseInt(m[2], 10));
  return isNaN(d.getTime()) ? null : d;
}

function columnLetter(n) {
  var s = '';
  while (n > 0) {
    var r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
