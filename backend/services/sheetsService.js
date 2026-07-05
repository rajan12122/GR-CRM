const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const metadataPath = path.join(__dirname, '../config/metadata.json');
const dbPath = path.join(__dirname, '../config/db.json');

// Helper to load metadata config
function getSheetsConfig() {
  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    return metadata.sheetsConfig || {};
  } catch (err) {
    console.error('Error reading sheets config:', err);
    return {};
  }
}

// Get Authenticated Google Sheets client
function getSheetsClient(config) {
  if (!config.syncActive || !config.spreadsheetId || !config.clientEmail || !config.privateKey) {
    return null;
  }
  try {
    const auth = new google.auth.JWT(
      config.clientEmail,
      null,
      config.privateKey.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    return google.sheets({ version: 'v4', auth });
  } catch (err) {
    console.error('Google Auth Init Failed:', err);
    return null;
  }
}

/**
 * Synchronize local db.json data WITH Google Sheets.
 * If sheet doesn't exist for a module, it creates the sheet and writes the header and data.
 * If the sheet exists, it updates it.
 */
async function syncToSheets(moduleName) {
  const config = getSheetsConfig();
  const sheets = getSheetsClient(config);
  if (!sheets) return false;

  try {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    
    const records = db[moduleName] || [];
    const fields = (metadata.modules[moduleName] && metadata.modules[moduleName].fields) || [];
    
    if (fields.length === 0 && records.length === 0) return false;

    // Headers are defined by the fields in metadata
    const headers = fields.map(f => f.name);
    if (!headers.includes('id')) {
      headers.unshift('id');
    }

    // Convert records to a 2D array
    const rows = [headers];
    records.forEach(rec => {
      const row = headers.map(h => {
        const val = rec[h];
        if (val === undefined || val === null) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      });
      rows.push(row);
    });

    const sheetName = `data_${moduleName}`;
    const spreadsheetId = config.spreadsheetId;

    // Check if sheet exists, if not, create it
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = meta.data.sheets.some(s => s.properties.title === sheetName);

    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: sheetName }
              }
            }
          ]
        }
      });
      console.log(`Created sheet: ${sheetName}`);
    }

    // Clear existing data in the sheet
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A1:Z10000`
    });

    // Write new values
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: rows
      }
    });

    console.log(`Successfully synced ${moduleName} to Google Sheets (${records.length} records).`);
    return true;
  } catch (error) {
    console.error(`Syncing ${moduleName} to Google Sheets failed:`, error.message);
    return false;
  }
}

/**
 * Sync from Google Sheets into the local JSON file.
 * Pulls all sheets matching data_* and merges them into db.json.
 */
async function syncFromSheets() {
  const config = getSheetsConfig();
  const sheets = getSheetsClient(config);
  if (!sheets) {
    console.log('Google Sheets Sync is inactive. Serving local cache data.');
    return false;
  }

  try {
    const spreadsheetId = config.spreadsheetId;
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const localDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

    let dbUpdated = false;

    for (const sheet of meta.data.sheets) {
      const title = sheet.properties.title;
      if (!title.startsWith('data_')) continue;

      const moduleName = title.replace('data_', '');
      
      // Fetch sheet values
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${title}!A1:Z10000`
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) continue;

      const headers = rows[0];
      const records = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const record = {};
        headers.forEach((header, index) => {
          let val = row[index] !== undefined ? row[index] : '';
          
          // Parse JSON if it looks like an array or object
          if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
            try {
              val = JSON.parse(val);
            } catch (e) {
              // keep as string
            }
          }
          // Convert to number if numeric
          if (val !== '' && !isNaN(val) && val.trim && val.trim() !== '') {
            val = Number(val);
          }
          record[header] = val;
        });
        
        if (record.id) {
          records.push(record);
        }
      }

      localDb[moduleName] = records;
      dbUpdated = true;
      console.log(`Synced ${records.length} records for ${moduleName} from Google Sheets.`);
    }

    if (dbUpdated) {
      fs.writeFileSync(dbPath, JSON.stringify(localDb, null, 2), 'utf8');
      console.log('Local db.json database updated from Google Sheets.');
    }
    return true;
  } catch (error) {
    console.error('Syncing from Google Sheets failed:', error.message);
    return false;
  }
}

module.exports = {
  syncToSheets,
  syncFromSheets,
  getSheetsConfig
};
