const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use a local SQLite database file
const dbPath = path.join(__dirname, '../../data/sawron.db');

// Create/connect to SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to SQLite database');
    
    // Create tables if they don't exist
    db.run(`
        CREATE TABLE IF NOT EXISTS summaries (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            url TEXT,
            name TEXT,
            date TEXT NOT NULL,
            status TEXT NOT NULL,
            summary TEXT,
            sourceContent TEXT,
            elapsedTime INTEGER,
            metadata TEXT
        )
    `);
});

module.exports = db;
