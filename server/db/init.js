const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Ensure data directory exists
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(config.dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    blueprint_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, blueprint_name)
  );

  CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(user_id);
`);

// Check if admin user exists, if not create default admin
function initializeDefaultAdmin() {
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get(config.defaultAdmin.username);
  
  if (!adminExists) {
    const passwordHash = bcrypt.hashSync(config.defaultAdmin.password, 10);
    db.prepare('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)')
      .run(config.defaultAdmin.username, passwordHash);
    
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    ⚠️  SECURITY WARNING ⚠️                     ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║  Default admin account created:                              ║');
    console.log('║                                                              ║');
    console.log('║    Username: admin                                           ║');
    console.log('║    Password: changeme                                        ║');
    console.log('║                                                              ║');
    console.log('║  ⚡ CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN! ⚡   ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('\n');
  }
}

initializeDefaultAdmin();

module.exports = db;
