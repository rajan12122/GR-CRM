const crypto = require('crypto');
const { readDb, writeDb } = require('../config/db');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function decryptLegacyXOR(hash) {
  if (!hash) return "";
  const LEGACY_KEY = "GAGAN_REALTECH_SECURE_LOCATION_KEY_2026";
  try {
    let str = hash;
    try {
      str = Buffer.from(hash, 'base64').toString('binary');
    } catch (e) {}
    let result = "";
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      const keyChar = LEGACY_KEY.charCodeAt(i % LEGACY_KEY.length);
      result += String.fromCharCode(charCode ^ keyChar);
    }
    return result;
  } catch (e) {
    return "";
  }
}

function encryptLocation(latitude, longitude) {
  const keyHex = process.env.DB_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    return `${latitude}:${longitude}`;
  }
  try {
    const key = Buffer.from(keyHex, 'hex');
    const iv = crypto.randomBytes(IV_LENGTH);
    const data = JSON.stringify({ lat: Number(latitude), lng: Number(longitude) });
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (e) {
    return `${latitude}:${longitude}`;
  }
}

function decryptLocation(encryptedString) {
  const keyHex = process.env.DB_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    const parts = String(encryptedString).split(':');
    return { lat: parseFloat(parts[0]) || 0, lng: parseFloat(parts[1]) || 0 };
  }
  try {
    const parts = String(encryptedString).split(':');
    if (parts.length < 3) {
      return { lat: parseFloat(parts[0]) || 0, lng: parseFloat(parts[1]) || 0 };
    }
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const payload = parts[2];
    const key = Buffer.from(keyHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(payload, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (e) {
    const parts = String(encryptedString).split(':');
    return { lat: parseFloat(parts[0]) || 0, lng: parseFloat(parts[1]) || 0 };
  }
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function logLocation(req, res) {
  const { employeeId, employeeName, latitude, longitude, status } = req.body;
  const db = readDb();
  
  if (!db.location_logs) db.location_logs = [];
  if (!db.active_paths) db.active_paths = {};

  let decLat = parseFloat(latitude);
  let decLng = parseFloat(longitude);

  if (isNaN(decLat) || isNaN(decLng)) {
    decLat = parseFloat(decryptLegacyXOR(latitude)) || 0;
    decLng = parseFloat(decryptLegacyXOR(longitude)) || 0;
  }

  const encryptedCoords = encryptLocation(decLat, decLng);

  const logEntry = {
    id: `LOC-${Date.now()}`,
    employeeId,
    employeeName,
    latitude: encryptedCoords,
    longitude: "",
    status,
    timestamp: new Date().toISOString()
  };
  
  db.location_logs.push(logEntry);

  if (status === 'sharing' && decLat !== 0 && decLng !== 0) {
    db.active_paths[employeeId] = db.active_paths[employeeId] || [];
    const currentPath = db.active_paths[employeeId];
    if (currentPath.length === 0) {
      currentPath.push({
        lat: decLat,
        lng: decLng,
        timestamp: logEntry.timestamp
      });
    } else {
      const lastPoint = currentPath[currentPath.length - 1];
      const dist = calculateDistanceKm(lastPoint.lat, lastPoint.lng, decLat, decLng);
      if (dist >= 0.01) {
        currentPath.push({
          lat: decLat,
          lng: decLng,
          timestamp: logEntry.timestamp
        });
      }
    }
  } else if (status === 'ended') {
    const path = db.active_paths[employeeId] || [];
    let distance = 0;
    for (let i = 0; i < path.length - 1; i++) {
      distance += calculateDistanceKm(path[i].lat, path[i].lng, path[i+1].lat, path[i+1].lng);
    }
    
    if (db.employees) {
      const emp = db.employees.find(e => String(e.id) === String(employeeId));
      if (emp) {
        emp.locationHistory = emp.locationHistory || [];
        emp.locationHistory.push({
          date: new Date().toLocaleDateString('en-IN'),
          totalKilometers: parseFloat(distance.toFixed(2)),
          path
        });
      }
    }
    delete db.active_paths[employeeId];
  }
  
  writeDb(db);
  res.json({ success: true, log: logEntry });
}

function getEmployeePath(req, res) {
  if (req.user.role !== 'Admin' && req.user.role !== 'Manager') {
    return res.status(403).json({ message: 'Access denied: Location query restricted.' });
  }

  const { employeeId } = req.params;
  const db = readDb();
  const path = db.active_paths?.[employeeId] || [];
  
  let distance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    distance += calculateDistanceKm(path[i].lat, path[i].lng, path[i+1].lat, path[i+1].lng);
  }
  res.json({ path, distance: parseFloat(distance.toFixed(2)) });
}

function getActiveLocations(req, res) {
  if (req.user.role !== 'Admin' && req.user.role !== 'Manager') {
    return res.status(403).json({ message: 'Access denied: Location query restricted.' });
  }

  const db = readDb();
  const logs = db.location_logs || [];
  
  const activeLocs = {};
  logs.forEach(log => {
    const empId = log.employeeId;
    if (!activeLocs[empId] || new Date(log.timestamp) > new Date(activeLocs[empId].timestamp)) {
      activeLocs[empId] = log;
    }
  });
  
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const result = Object.values(activeLocs).filter(loc => 
    loc.status === 'sharing' && new Date(loc.timestamp) > fiveMinutesAgo
  );

  const decryptedResult = result.map(loc => {
    const coords = decryptLocation(loc.latitude);
    return {
      ...loc,
      latitude: coords.lat,
      longitude: coords.lng
    };
  });

  res.json(decryptedResult);
}

module.exports = {
  logLocation,
  getEmployeePath,
  getActiveLocations
};
