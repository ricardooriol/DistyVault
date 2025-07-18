// Local SQLite storage for summaries
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/storage/sawron.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS summaries (
    id INTEGER PRIMARY KEY,
    summary TEXT,
    type TEXT,
    date TEXT,
    status TEXT,
    name TEXT,
    url TEXT
  )`);
});

function saveSummary({ summary, type, date, status, name, url }) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO summaries (summary, type, date, status, name, url) VALUES (?, ?, ?, ?, ?, ?)',
      [summary, type, date, status, name, url],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

function getSummaries() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM summaries ORDER BY id DESC', (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function deleteSummary(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM summaries WHERE id = ?', [id], function (err) {
      if (err) return reject(err);
      resolve();
    });
  });
}

module.exports = { saveSummary, getSummaries, deleteSummary };
