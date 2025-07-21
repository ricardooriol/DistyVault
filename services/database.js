/**
 * Database service for SAWRON
 * Handles persistence of summaries using SQLite
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const Summary = require('../models/summary');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, '../data/sawron.db');
        this.ensureDbDirectory();
        this.db = new sqlite3.Database(this.dbPath);
        this.init();
    }

    ensureDbDirectory() {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    init() {
        this.db.serialize(() => {
            // Create summaries table if it doesn't exist
            this.db.run(`
                CREATE TABLE IF NOT EXISTS summaries (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    content TEXT,
                    sourceUrl TEXT,
                    sourceType TEXT,
                    sourceFile TEXT,
                    status TEXT,
                    processingStep TEXT,
                    rawContent TEXT,
                    createdAt TEXT,
                    completedAt TEXT,
                    processingTime REAL,
                    elapsedTime REAL,
                    startTime TEXT,
                    wordCount INTEGER,
                    error TEXT,
                    logs TEXT
                )
            `);
        });
        console.log('Database initialized with enhanced debugging fields');
    }

    async saveSummary(summary) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO summaries 
                (id, title, content, sourceUrl, sourceType, sourceFile, status, processingStep, rawContent,
                createdAt, completedAt, processingTime, elapsedTime, startTime, wordCount, error, logs)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                summary.id,
                summary.title,
                summary.content,
                summary.sourceUrl,
                summary.sourceType,
                summary.sourceFile ? JSON.stringify(summary.sourceFile) : null,
                summary.status,
                summary.processingStep || '',
                summary.rawContent || '',
                summary.createdAt.toISOString(),
                summary.completedAt ? summary.completedAt.toISOString() : null,
                summary.processingTime,
                summary.elapsedTime || 0,
                summary.startTime ? summary.startTime.toISOString() : null,
                summary.wordCount,
                summary.error,
                JSON.stringify(summary.logs || []),
                function (err) {
                    if (err) {
                        console.error(`Database error saving summary ${summary.id}:`, err);
                        reject(err);
                    } else {
                        console.log(`Summary ${summary.id} saved successfully. Status: ${summary.status}, Step: ${summary.processingStep || 'N/A'}`);
                        resolve(summary);
                    }
                }
            );

            stmt.finalize();
        });
    }

    async getSummary(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM summaries WHERE id = ?', [id], (err, row) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    resolve(null);
                } else {
                    resolve(this.rowToSummary(row));
                }
            });
        });
    }

    async getAllSummaries() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM summaries ORDER BY createdAt DESC', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => this.rowToSummary(row)));
                }
            });
        });
    }

    async deleteSummary(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM summaries WHERE id = ?', [id], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    async updateSummaryStatus(id, status, processingStep = null, error = null) {
        return new Promise(async (resolve, reject) => {
            try {
                const updates = { status };

                if (status === 'completed') {
                    updates.completedAt = new Date().toISOString();
                }

                if (processingStep) {
                    updates.processingStep = processingStep;
                }

                if (error) {
                    updates.error = error;
                }

                // Update elapsed time
                const summary = await this.getSummary(id);
                if (summary && summary.startTime) {
                    updates.elapsedTime = (new Date() - summary.startTime) / 1000;
                }

                const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
                const values = [...Object.values(updates), id];

                console.log(`Updating summary ${id} status to ${status}${processingStep ? `, step: ${processingStep}` : ''}`);

                this.db.run(`UPDATE summaries SET ${setClauses} WHERE id = ?`, values, function (err) {
                    if (err) {
                        console.error(`Error updating summary status ${id}:`, err);
                        reject(err);
                    } else {
                        console.log(`Summary ${id} status updated successfully. Changes: ${this.changes}`);
                        resolve(this.changes > 0);
                    }
                });
            } catch (error) {
                console.error(`Error in updateSummaryStatus for ${id}:`, error);
                reject(error);
            }
        });
    }

    async updateSummaryContent(id, content, rawContent, processingTime, wordCount) {
        return new Promise(async (resolve, reject) => {
            try {
                // Get current summary to calculate elapsed time
                const summary = await this.getSummary(id);
                const now = new Date();
                const elapsedTime = summary && summary.startTime ? (now - summary.startTime) / 1000 : 0;

                console.log(`Updating summary ${id} content. Processing time: ${processingTime}s, Elapsed time: ${elapsedTime}s, Word count: ${wordCount}`);

                this.db.run(
                    'UPDATE summaries SET content = ?, rawContent = ?, processingTime = ?, elapsedTime = ?, wordCount = ?, status = ?, processingStep = ?, completedAt = ? WHERE id = ?',
                    [content, rawContent, processingTime, elapsedTime, wordCount, 'completed', 'Summary completed', now.toISOString(), id],
                    function (err) {
                        if (err) {
                            console.error(`Error updating summary content ${id}:`, err);
                            reject(err);
                        } else {
                            console.log(`Summary ${id} content updated successfully. Changes: ${this.changes}`);
                            resolve(this.changes > 0);
                        }
                    }
                );
            } catch (error) {
                console.error(`Error in updateSummaryContent for ${id}:`, error);
                reject(error);
            }
        });
    }

    async searchSummaries(query) {
        return new Promise((resolve, reject) => {
            const searchTerm = `%${query}%`;
            this.db.all(
                'SELECT * FROM summaries WHERE title LIKE ? OR content LIKE ? ORDER BY createdAt DESC',
                [searchTerm, searchTerm],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows.map(row => this.rowToSummary(row)));
                    }
                }
            );
        });
    }

    rowToSummary(row) {
        return new Summary({
            id: row.id,
            title: row.title,
            content: row.content,
            sourceUrl: row.sourceUrl,
            sourceType: row.sourceType,
            sourceFile: row.sourceFile ? JSON.parse(row.sourceFile) : null,
            status: row.status,
            processingStep: row.processingStep,
            rawContent: row.rawContent,
            createdAt: new Date(row.createdAt),
            completedAt: row.completedAt ? new Date(row.completedAt) : null,
            processingTime: row.processingTime,
            elapsedTime: row.elapsedTime,
            startTime: row.startTime ? new Date(row.startTime) : null,
            wordCount: row.wordCount,
            error: row.error,
            logs: row.logs ? JSON.parse(row.logs) : []
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = new Database();