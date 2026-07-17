require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Initialize database config
const { selfCorrectDatabase } = require('./services/businessHooksService');
const { startLeadRotationScheduler } = require('./services/leadRotationService');
const { streamNotifications } = require('./utils/notificationHelper');

const app = express();
const PORT = process.env.PORT || 5000;


// CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5000',
  'https://gagan-realtech.onrender.com'
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads / media directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// Expose APK file public download
app.get('/public/app-debug.apk', (req, res) => {
  try {
    const apkPath = path.join(__dirname, '../app-debug.apk');
    if (fs.existsSync(apkPath)) {
      return res.sendFile(apkPath);
    }
    res.status(404).json({ error: "APK file not found on server." });
  } catch (err) {
    res.status(500).json({ error: "Failed to download APK file." });
  }
});

// SSE Notifications stream route
app.get('/api/notifications/stream', streamNotifications);

// Mount Modular API Routers
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/workflows', require('./routes/workflowRoutes'));
app.use('/api/location', require('./routes/locationRoutes'));
app.use('/api/sync', require('./routes/sheetsRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/public', require('./routes/publicRoutes'));
app.use('/api', require('./routes/dataRoutes'));

// Serve static client build files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Start API Server
app.listen(PORT, () => {
  console.log(`Gagan Realtech ERP+CRM API Server running on port ${PORT}`);
  
  // Trigger boot processes
  try {
    const { runMigration } = require('./scripts/migrateDatabase');
    runMigration();
  } catch (e) {
    console.error('Failed to run startup database migration:', e);
  }
  selfCorrectDatabase();
  startLeadRotationScheduler();
});
