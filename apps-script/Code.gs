// Code.gs -- ASM Roster Google Apps Script
// Deploy as Web App: Execute as Me, Anyone can access
// After changes: Deploy -> Manage Deployments -> edit the existing deployment
// to point at the NEW version (do NOT create a brand-new deployment URL).

// -- COLUMNS -----------------------------------------------------------------
// Columns are found by READING THE HEADER ROW, not by fixed position. The old
// version hard-coded positions, and because the two tabs didn't share an order,
// most values came back under the wrong name -- the site carried a translation
// layer to undo it. Moving or inserting a column is now harmless as long as the
// header text still matches one of the aliases below.
//
// Expected headers on both tabs (order doesn't matter, extras are ignored):
//   Student / Last connection date / Connected This Quarter? /
//   Connection Status / Grade / School / Birthday / Link to Photo / NOTES / ID
//
// Gone from the sheet, now in the site's database:
//   Goals, Primary Goal, and the hangout log (old columns J-N, P). Notes are
//   stored in Supabase keyed by the student's ID, so they survive a student
//   changing status or another student being deleted above them.

const FIELDS = {
  name:          ['student', 'studentname', 'name'],
  lastConnected: ['lastconnectiondate', 'lastconnection', 'lastconnected'],
  connected:     ['connectedthisquarter', 'connected'],
  status:        ['connectionstatus', 'status', 'section'],
  grade:         ['grade'],
  school:        ['school'],
  birthday:      ['birthday', 'birthdate', 'bday'],
  photoUrl:      ['linktophoto', 'photourl', 'photolink', 'photo'],
  notes:         ['notes', 'note'],
  id:            ['id', 'studentid', 'uid'],
};

// Sheet tabs must be named exactly "High School" and "Middle School".
const SHEETS = { hs: 'High School', ms: 'Middle School' };

// Column C's two allowed values, exactly as its data validation lists them.
// Writing anything else fails validation silently.
const CONNECTED_YES = 'Family Connected With';
const CONNECTED_NO  = 'Not Connected';

// Column D's three allowed values.
const STATUS_LABELS = { core: 'Core', loose: 'Loosely Connected', fringe: 'Fringe' };

// -- ENTRY POINTS -------------------------------------------------------------
function doGet(e) {
  try {
    // Reject requests that don't carry the site's shared secret.
    // Set WORKER_SECRET in Apps Script -> Project Settings -> Script Properties.
    // Leave it unset to disable the check during initial setup.
    const expected = PropertiesService.getScriptProperties().getProperty('WORKER_SECRET') || '';
    if (expected && (e.parameter._s || '') !== expected) {
      return json({ error: 'Unauthorized' });
    }

    const action  = e.parameter.action;
    const payload = e.parameter.payload ? JSON.parse(e.parameter.payload) : {};

    let result;
    if      (action === 'read')   result = readRoster();
    else if (action === 'add')    result = addRow(payload);
    else if (action === 'update') result = updateRow(payload);
    else if (action === 'delete') result = deleteRow(payload);

    // Hangout notes live in the site's database now, not in this sheet, so
    // there's nothing here to write them to. Accepted rather than errored
    // because the site sends these fire-and-forget and ignores the response.
    else if (action === 'addInteraction' ||
             action === 'updateInteraction' ||
             action === 'deleteInteraction') result = { success: true, stored: false };

    else result = { error: 'Unknown action: ' + action };

    return json(result);
  } catch (err) {
    return json({ error: err.message });
  }
}

function doPost(e) {
  try {
    const body     = JSON.parse(e.postData.contents);
    const expected = PropertiesService.getScriptProperties().getProperty('WORKER_SECRET') || '';
    if (expected && (body._s || '') !== expected) {
      return json({ error: 'Unauthorized' });
    }

    let result;
    if (body.action === 'uploadPhoto') result = uploadPhoto(body);
    else                               result = { error: 'Unknown action: ' + body.action };

    return json(result);
  } catch (err) {
    return json({ error: err.message });
  }
}

// -- READ ---------------------------------------------------------------------
function readRoster() {
  return {
    hs: { students: readSheet('hs') },
    ms: { students: readSheet('ms') },
  };
}

function readSheet(sk) {
  const sheet = getSheet(sk);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const cols   = headerMap(values[0]);
  const tz     = Session.getScriptTimeZone();

  if (cols.name === undefined) {
    throw new Error('The "' + sheet.getName() + '" tab has no Student column in row 1.');
  }

  ensureIds(sheet, values, cols);

  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row  = values[r];
    const name = String(row[cols.name] == null ? '' : row[cols.name]).trim();

    // Blank column A means a spacer row, or one of the old "CORE (down-arrow emoji)" divider
    // rows that column D replaced. Either way it isn't a student.
    if (!name || name.indexOf('\uD83D\uDC47') !== -1) continue;

    out.push({
      id:            cols.id === undefined ? 'r' + (r + 1) : String(row[cols.id] || 'r' + (r + 1)),
      rowIndex:      r + 1,
      name:          name,
      lastConnected: toDateString(cell(row, cols.lastConnected), tz),
      connected:     String(cell(row, cols.connected)).trim().toLowerCase() === CONNECTED_YES.toLowerCase(),
      status:        normalizeStatus(cell(row, cols.status)),
      grade:         String(cell(row, cols.grade)).trim(),
      school:        String(cell(row, cols.school)).trim(),
      birthday:      toDateString(cell(row, cols.birthday), tz),
      photoUrl:      String(cell(row, cols.photoUrl)).trim(),
      notes:         String(cell(row, cols.notes)).trim(),
    });
  }
  return out;
}

// -- ADD ROW -------------------------------------------------------------------
function addRow(payload) {
  const sheet = getSheet(payload.sheet);
  if (!sheet) return { error: 'Sheet not found: ' + payload.sheet };

  const cols     = headerMap(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  const person   = payload.person || {};
  const rowIndex = sheet.getLastRow() + 1;
  const id       = Utilities.getUuid().slice(0, 8);
  const tz       = Session.getScriptTimeZone();

  Object.keys(cols).forEach(function(field) {
    const value = field === 'id' ? id : person[field];
    if (value === undefined) return;
    sheet.getRange(rowIndex, cols[field] + 1).setValue(toCell(field, value));
  });

  // A student added as already-connected gets today stamped as their date.
  let lastConnected = '';
  if (truthy(person.connected) && cols.lastConnected !== undefined) {
    lastConnected = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    sheet.getRange(rowIndex, cols.lastConnected + 1).setValue(lastConnected);
  }

  return { success: true, newRowIndex: rowIndex, id: id, lastConnected: lastConnected };
}

// -- UPDATE ROW ----------------------------------------------------------------
function updateRow(payload) {
  const sheet = getSheet(payload.sheet);
  if (!sheet) return { error: 'Sheet not found: ' + payload.sheet };

  const cols     = headerMap(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  const rowIndex = resolveRow(sheet, cols, payload.rowIndex, payload.id);
  if (!rowIndex) return { error: 'Could not find that student in the sheet.' };

  const fields = payload.fields || {};
  const tz     = Session.getScriptTimeZone();

  // Column B is stamped only when Connected flips OFF -> ON. It records the
  // last time this family was actually connected with, so switching the toggle
  // back off deliberately leaves the date alone.
  if (fields.connected !== undefined &&
      cols.connected !== undefined &&
      cols.lastConnected !== undefined) {
    const wasConnected = String(sheet.getRange(rowIndex, cols.connected + 1).getValue())
      .trim().toLowerCase() === CONNECTED_YES.toLowerCase();
    if (!wasConnected && truthy(fields.connected)) {
      sheet.getRange(rowIndex, cols.lastConnected + 1)
        .setValue(Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'));
    }
  }

  Object.keys(fields).forEach(function(field) {
    if (field === 'id') return;                 // IDs are assigned here, never by the site
    if (cols[field] === undefined) return;      // no column for it -- skip rather than guess
    sheet.getRange(rowIndex, cols[field] + 1).setValue(toCell(field, fields[field]));
  });

  return {
    success: true,
    rowIndex: rowIndex,
    lastConnected: cols.lastConnected === undefined ? ''
      : toDateString(sheet.getRange(rowIndex, cols.lastConnected + 1).getValue(), tz),
  };
}

// -- DELETE ROW ----------------------------------------------------------------
function deleteRow(payload) {
  const sheet = getSheet(payload.sheet);
  if (!sheet) return { error: 'Sheet not found: ' + payload.sheet };

  const cols     = headerMap(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  const rowIndex = resolveRow(sheet, cols, payload.rowIndex, payload.id);
  if (!rowIndex) return { error: 'Could not find that student in the sheet.' };

  sheet.deleteRow(rowIndex);
  return { success: true };
}

// -- UPLOAD PHOTO --------------------------------------------------------------
function uploadPhoto(body) {
  const { fileName, mimeType, base64, folderId } = body;
  try {
    const folder = DriveApp.getFolderById(folderId);
    const blob   = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, fileName);
    const file   = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { url: 'https://drive.google.com/file/d/' + file.getId() + '/view' };
  } catch (err) {
    return { error: err.message };
  }
}

// -- HELPERS -------------------------------------------------------------------
function getSheet(sk) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const name = SHEETS[(sk || '').toLowerCase()];
  const tab  = name ? ss.getSheetByName(name) : null;
  if (tab) return tab;

  // Fallback so a renamed tab doesn't take the whole roster down.
  const needle = (sk || '').toLowerCase() === 'hs' ? 'high' : 'middle';
  return ss.getSheets().filter(function(s) {
    return s.getName().toLowerCase().indexOf(needle) !== -1;
  })[0] || null;
}

// Builds { field: zeroBasedColumnIndex } by matching the header row against
// FIELDS. Columns whose header matches nothing are simply absent from the map,
// which is how the blank spacer column between Birthday and Link to Photo is
// handled -- no special case needed.
function headerMap(headerRow) {
  const cols = {};
  headerRow.forEach(function(header, c) {
    const key = String(header == null ? '' : header).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!key) return;
    Object.keys(FIELDS).forEach(function(field) {
      if (cols[field] !== undefined) return;              // first match wins
      if (FIELDS[field].indexOf(key) !== -1) cols[field] = c;
    });
  });
  return cols;
}

function cell(row, index) {
  return index === undefined || row[index] == null ? '' : row[index];
}

function truthy(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === CONNECTED_YES.toLowerCase();
}

function normalizeStatus(value) {
  const s = String(value || '').trim().toLowerCase();
  if (s.indexOf('loose') !== -1)  return 'loose';
  if (s.indexOf('fringe') !== -1) return 'fringe';
  return 'core';
}

// Cells arrive as real Dates, ISO strings, or free text someone typed by hand
// ("July 2", "aug 23rd", "05/18"). Real dates are formatted to YYYY-MM-DD for
// the site's date inputs; anything unparseable is passed through untouched
// rather than destroyed.
function toDateString(value, tz) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  }
  const s = String(value == null ? '' : value).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Require a 4-digit year before trusting Date's parser -- without one it
  // guesses the current year, turning "05/18" into a wrong but confident date.
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime()) && /\d{4}/.test(s)) {
    return Utilities.formatDate(parsed, tz, 'yyyy-MM-dd');
  }
  return s;
}

function toCell(field, value) {
  if (field === 'connected') return truthy(value) ? CONNECTED_YES : CONNECTED_NO;
  if (field === 'status')    return STATUS_LABELS[normalizeStatus(value)];
  return value == null ? '' : value;
}

// Prefers the student's ID over the row number. Deleting a row shifts every row
// below it, so a rowIndex the site is still holding from before that delete
// points at the wrong student. The ID doesn't move.
function resolveRow(sheet, cols, rowIndex, id) {
  if (id && cols.id !== undefined) {
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const ids = sheet.getRange(2, cols.id + 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(id)) return i + 2;
      }
    }
  }
  const n = parseInt(rowIndex, 10);
  return n >= 2 ? n : 0;
}

// Fills blank cells in the ID column so goals and hangout notes have something
// stable to attach to. Written in one batch; a no-op once every row has one.
function ensureIds(sheet, values, cols) {
  if (cols.id === undefined || values.length < 2) return;

  const ids = [];
  let changed = false;
  for (let r = 1; r < values.length; r++) {
    let current = String(values[r][cols.id] || '').trim();
    const name  = String(values[r][cols.name] || '').trim();
    if (!current && name) {
      current = Utilities.getUuid().slice(0, 8);
      values[r][cols.id] = current;
      changed = true;
    }
    ids.push([current]);
  }

  if (changed) sheet.getRange(2, cols.id + 1, ids.length, 1).setValues(ids);
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// -- ONE-OFF SETUP (optional) --------------------------------------------------
// Installs the dropdown validation on columns C and D for both tabs, so the
// values the site writes always match what the sheet accepts. Safe to re-run;
// it only touches data validation, never any student's data.
function setupValidation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.values(SHEETS).forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;

    const cols    = headerMap(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
    const lastRow = Math.max(sheet.getMaxRows(), 2);

    if (cols.connected !== undefined) {
      sheet.getRange(2, cols.connected + 1, lastRow - 1, 1).setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList([CONNECTED_YES, CONNECTED_NO], true)
          .setAllowInvalid(false).build()
      );
    }
    if (cols.status !== undefined) {
      sheet.getRange(2, cols.status + 1, lastRow - 1, 1).setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(Object.values(STATUS_LABELS), true)
          .setAllowInvalid(false).build()
      );
    }
  });

  SpreadsheetApp.getUi().alert('Dropdown validation installed on both tabs.');
}
