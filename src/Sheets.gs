/**
 * Sheets.gs
 * Manages Google Sheets interactions.
 */

const SHEET_NAMES = {
  GWS: {
    STAGING: 'GWS',
    SENT: 'GWS Sent News',
    YOUTUBE: 'GWS Youtube'
  },
  GCP: {
    STAGING: 'GCP',
    SENT: 'GCP Sent News',
    YOUTUBE: 'GCP Youtube'
  }
};

/**
 * Gets the working Spreadsheet.
 * Checks ScriptProperties for a saved ID.
 * If not found, tries ActiveSpreadsheet.
 * If neither, creates a new Spreadsheet and saves the ID.
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet} The spreadsheet object.
 */
function getSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty('SPREADSHEET_ID');
  
  let ss;
  
  if (savedId) {
    try {
      ss = SpreadsheetApp.openById(savedId);
      console.log('Opened Spreadsheet from saved ID.');
      return ss;
    } catch (e) {
      console.warn('Saved Spreadsheet ID not valid or not accessible. Trying active or creating new.');
    }
  }
  
  // Try active (if bound)
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    // Standalone script, no active sheet
  }
  
  if (ss) {
    props.setProperty('SPREADSHEET_ID', ss.getId());
    console.log('Opened Active Spreadsheet.');
    return ss;
  }

  // Use hardcoded ID provided by user
  const HARDCODED_ID = '13r8Cyq7zIjJWDQKMqe0IuBn8WxpAu2IV-_v2M69MEp8';
  try {
    ss = SpreadsheetApp.openById(HARDCODED_ID);
    props.setProperty('SPREADSHEET_ID', HARDCODED_ID);
    console.log('Opened Hardcoded Spreadsheet.');
    return ss;
  } catch (e) {
    console.warn('Could not open hardcoded spreadsheet. Creating new.');
  }
  
  // Create new
  ss = SpreadsheetApp.create('Google News Tracker');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  console.log('Created new Spreadsheet: ' + ss.getUrl());
  return ss;
}

/**
 * Ensures all required sheets exist.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss The spreadsheet.
 */
function ensureSheetStructure(ss) {
  const allNames = [
    ...Object.values(SHEET_NAMES.GWS),
    ...Object.values(SHEET_NAMES.GCP)
  ];
  
  allNames.forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      console.log(`Creating missing sheet: ${name}`);
      sheet = ss.insertSheet(name);
      // Set headers based on sheet type
      if (name.includes('Youtube')) {
        sheet.appendRow(['Date', 'Topic', 'Doc URL', 'Status']);
      } else {
        sheet.appendRow(['Date', 'Title', 'Link', 'Section', 'Sub-section', 'Summary', 'Status']);
      }
      sheet.setFrozenRows(1);
    }
  });
}

/**
 * Gets existing links from a sheet to avoid duplicates.
 * @param {string} sheetName The name of the sheet.
 * @return {Array<string>} List of URLs.
 */
function getExistingLinks(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  
  // Assuming Link is column C (index 3)
  const values = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
  return values.map(row => row[0]).filter(url => url);
}

/**
 * Saves news items to the staging sheet.
 * @param {string} sheetName Target sheet name.
 * @param {Array<Object>} newsItems List of processed news items.
 */
function saveNewsToStaging(sheetName, newsItems) {
  if (!newsItems || newsItems.length === 0) return;
  
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  const rows = newsItems.map(item => [
    item.date,
    item.title,
    item.link,
    item.section,
    item.subSection,
    item.summary || '',
    'Pending'
  ]);
  
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

/**
 * Saves generated Doc links to the Youtube sheet.
 * @param {string} sheetName Target sheet name.
 * @param {Array<Object>} docData List of { topic, url }.
 */
function saveToYoutubeSheet(sheetName, docData) {
  if (!docData || docData.length === 0) return;
  
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  const rows = docData.map(data => [
    new Date(),
    data.topic,
    data.url,
    'Ready'
  ]);
  
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

/**
 * Moves processed rows from Staging to Sent News.
 * @param {string} sourceName Source sheet name.
 * @param {string} targetName Target sheet name.
 */
function moveRowsToArchive(sourceName, targetName) {
  const ss = getSpreadsheet();
  const source = ss.getSheetByName(sourceName);
  const target = ss.getSheetByName(targetName);
  
  const lastRow = source.getLastRow();
  if (lastRow < 2) return;
  
  const range = source.getRange(2, 1, lastRow - 1, source.getLastColumn());
  const values = range.getValues();
  
  // Append to target
  target.getRange(target.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);
  
  // Clear source (keep headers)
  source.deleteRows(2, lastRow - 1);
}
