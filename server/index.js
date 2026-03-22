const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const config = require('./config');
const db = require('./db/init');

// Import routes
const authRoutes = require('./routes/auth');
const blueprintRoutes = require('./routes/blueprints');
const inventoryRoutes = require('./routes/inventory');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/images', express.static(config.imagesPath));
app.use('/static', express.static(config.staticPath));
app.use(express.static(config.publicPath));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/blueprints', blueprintRoutes);
app.use('/api/inventory', inventoryRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Serve frontend routes
app.get('/app', (req, res) => {
  res.sendFile(path.join(config.publicPath, 'app.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(config.publicPath, 'admin.html'));
});

// Catch-all route for SPA (must be after API routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(config.publicPath, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(config.port, () => {
  console.log(`Blueprint Inventory Server`);
  console.log(`===========================`);
  console.log(`Server running on port ${config.port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${config.dbPath}`);
  console.log(`\nAccess the application at:`);
  console.log(`  http://localhost:${config.port}`);
  console.log(`\nPress Ctrl+C to stop\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
    db.close();
    console.log('Database connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
    db.close();
    console.log('Database connection closed');
    process.exit(0);
  });
});

module.exports = app;
