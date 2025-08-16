/**
 * Database service for SAWRON
 * Handles persistence of distillations using SQLite
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const Distillation = require('../models/distillation');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, '../../data/sawron.db');
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
            // Create distillations table if it doesn't exist
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
                    distillingStartTime TEXT,
                    wordCount INTEGER,
                    error TEXT,
                    logs TEXT
                )
            `);

            // Add distillingStartTime column if it doesn't exist (for existing databases)
            this.db.run(`
                ALTER TABLE summaries ADD COLUMN distillingStartTime TEXT
            `, (err) => {
                // Ignore error if column already exists
                if (err && !err.message.includes('duplicate column name')) {
                    console.warn('Warning adding distillingStartTime column:', err.message);
                }
            });

            // Add queuePosition column if it doesn't exist (for existing databases)
            this.db.run(`
                ALTER TABLE summaries ADD COLUMN queuePosition INTEGER
            `, (err) => {
                // Ignore error if column already exists
                if (err && !err.message.includes('duplicate column name')) {
                    console.warn('Warning adding queuePosition column:', err.message);
                }
            });
        });
        // Database initialized successfully
    }

    async saveDistillation(distillation) {
        return new Promise((resolve, reject) => {
            console.log(`[DB] Saving distillation ${distillation.id} with status: ${distillation.status}`);
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO summaries 
                (id, title, content, sourceUrl, sourceType, sourceFile, status, processingStep, rawContent,
                createdAt, completedAt, processingTime, elapsedTime, startTime, distillingStartTime, wordCount, error, logs, queuePosition)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                distillation.id,
                distillation.title,
                distillation.content,
                distillation.sourceUrl,
                distillation.sourceType,
                distillation.sourceFile ? JSON.stringify(distillation.sourceFile) : null,
                distillation.status,
                distillation.processingStep || '',
                distillation.rawContent || '',
                distillation.createdAt.toISOString(),
                distillation.completedAt ? distillation.completedAt.toISOString() : null,
                distillation.processingTime,
                distillation.elapsedTime || 0,
                distillation.startTime ? distillation.startTime.toISOString() : null,
                distillation.distillingStartTime ? distillation.distillingStartTime.toISOString() : null,
                distillation.wordCount,
                distillation.error,
                JSON.stringify(distillation.logs || []),
                distillation.queuePosition || null,
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(distillation);
                    }
                }
            );

            stmt.finalize();
        });
    }

    async getDistillation(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM summaries WHERE id = ?', [id], (err, row) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    resolve(null);
                } else {
                    resolve(this.rowToDistillation(row));
                }
            });
        });
    }

    async getAllSummaries() {
        return new Promise((resolve, reject) => {
            // Always order by createdAt ASC to ensure consistent top-to-bottom processing order
            // This ensures that playlist videos process in the correct order (first video first)
            this.db.all('SELECT * FROM summaries ORDER BY createdAt ASC', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => this.rowToDistillation(row)));
                }
            });
        });
    }

    async deleteDistillation(id) {
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

    async updateDistillationStatus(id, status, processingStep = null, error = null) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log(`[DB] Updating status for ${id}: ${status}`);
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

                // Update elapsed time and start time for distilling status
                const distillation = await this.getDistillation(id);
                if (status === 'distilling' && distillation && !distillation.distillingStartTime) {
                    // Set the distilling start time when status first changes to distilling
                    updates.distillingStartTime = new Date().toISOString();
                    updates.elapsedTime = 0; // Reset elapsed time
                } else if (distillation && distillation.distillingStartTime) {
                    // Calculate elapsed time from when distilling started
                    updates.elapsedTime = (new Date() - new Date(distillation.distillingStartTime)) / 1000;
                } else if (distillation && distillation.startTime && status !== 'distilling') {
                    // For non-distilling statuses, use original logic
                    updates.elapsedTime = (new Date() - distillation.startTime) / 1000;
                }

                const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
                const values = [...Object.values(updates), id];

                this.db.run(`UPDATE summaries SET ${setClauses} WHERE id = ?`, values, function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes > 0);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    async updateDistillationContent(id, content, rawContent, processingTime, wordCount) {
        return new Promise(async (resolve, reject) => {
            try {
                // Get current distillation to calculate elapsed time
                const distillation = await this.getDistillation(id);
                const now = new Date();
                // Use distilling start time if available, otherwise fall back to start time
                const elapsedTime = distillation && distillation.distillingStartTime ?
                    (now - distillation.distillingStartTime) / 1000 :
                    (distillation && distillation.startTime ? (now - distillation.startTime) / 1000 : 0);

                this.db.run(
                    'UPDATE summaries SET content = ?, rawContent = ?, processingTime = ?, elapsedTime = ?, wordCount = ?, status = ?, processingStep = ?, completedAt = ? WHERE id = ?',
                    [content, rawContent, processingTime, elapsedTime, wordCount, 'completed', 'Distillation completed', now.toISOString(), id],
                    function (err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(this.changes > 0);
                        }
                    }
                );
            } catch (error) {
                reject(error);
            }
        });
    }

    async searchSummaries(query) {
        return new Promise((resolve, reject) => {
            const searchTerm = `%${query}%`;
            this.db.all(
                'SELECT * FROM summaries WHERE title LIKE ? OR content LIKE ? ORDER BY createdAt ASC',
                [searchTerm, searchTerm],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows.map(row => this.rowToDistillation(row)));
                    }
                }
            );
        });
    }

    rowToDistillation(row) {
        return new Distillation({
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
            distillingStartTime: row.distillingStartTime ? new Date(row.distillingStartTime) : null,
            wordCount: row.wordCount,
            error: row.error,
            logs: row.logs ? JSON.parse(row.logs) : [],
            queuePosition: row.queuePosition
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = new Database();