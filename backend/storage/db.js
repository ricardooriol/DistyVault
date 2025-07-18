// Local SQLite storage for summaries
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/storage/sawron.db');

db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS summaries (id INTEGER PRIMARY KEY, summary TEXT)');
});

function saveSummary(summary) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO summaries (summary) VALUES (?)', [summary], function (err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
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

module.exports = { saveSummary, getSummaries };
