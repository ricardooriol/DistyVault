/**
 * Client-side Database service for DistyVault
 * Uses sql.js + IndexedDB for local storage
 */
class Database {
    constructor() {
        this.dbName = 'DistyVaultDB';
        this.dbVersion = 1;
        this.db = null;
        this.sqlDb = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;

        try {
            // Initialize sql.js
            const SQL = await window.initSqlJs({
                locateFile: file => `https://sql.js.org/dist/${file}`
            });

            // Open IndexedDB
            this.db = await this.openIndexedDB();
            
            // Load existing database from IndexedDB or create new one
            const existingData = await this.loadFromIndexedDB();
            if (existingData) {
                this.sqlDb = new SQL.Database(existingData);
            } else {
                this.sqlDb = new SQL.Database();
                await this.createTables();
            }

            this.isInitialized = true;
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Database initialization failed:', error);
            throw error;
        }
    }

    async openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('database')) {
                    db.createObjectStore('database');
                }
            };
        });
    }

    async loadFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['database'], 'readonly');
            const store = transaction.objectStore('database');
            const request = store.get('sqliteData');
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                resolve(request.result ? new Uint8Array(request.result) : null);
            };
        });
    }

    async saveToIndexedDB() {
        const data = this.sqlDb.export();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['database'], 'readwrite');
            const store = transaction.objectStore('database');
            const request = store.put(data, 'sqliteData');
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async createTables() {
        const createTableSQL = `
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
                logs TEXT,
                queuePosition INTEGER
            )
        `;
        
        this.sqlDb.run(createTableSQL);
        await this.saveToIndexedDB();
    }

    async saveDistillation(distillation) {
        await this.init();
        
        const stmt = this.sqlDb.prepare(`
            INSERT OR REPLACE INTO summaries 
            (id, title, content, sourceUrl, sourceType, sourceFile, status, processingStep, rawContent,
            createdAt, completedAt, processingTime, elapsedTime, startTime, distillingStartTime, wordCount, error, logs, queuePosition)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run([
            distillation.id,
            distillation.title,
            distillation.content,
            distillation.sourceUrl,
            distillation.sourceType,
            distillation.sourceFile ? JSON.stringify(distillation.sourceFile) : null,
            distillation.status,
            distillation.processingStep || '',
            distillation.rawContent || '',
            distillation.createdAt instanceof Date ? distillation.createdAt.toISOString() : distillation.createdAt,
            distillation.completedAt ? (distillation.completedAt instanceof Date ? distillation.completedAt.toISOString() : distillation.completedAt) : null,
            distillation.processingTime,
            distillation.elapsedTime || 0,
            distillation.startTime ? (distillation.startTime instanceof Date ? distillation.startTime.toISOString() : distillation.startTime) : null,
            distillation.distillingStartTime ? (distillation.distillingStartTime instanceof Date ? distillation.distillingStartTime.toISOString() : distillation.distillingStartTime) : null,
            distillation.wordCount,
            distillation.error,
            JSON.stringify(distillation.logs || []),
            distillation.queuePosition || null
        ]);

        stmt.free();
        await this.saveToIndexedDB();
        return distillation;
    }

    async getDistillation(id) {
        await this.init();
        
        const stmt = this.sqlDb.prepare('SELECT * FROM summaries WHERE id = ?');
        const result = stmt.getAsObject([id]);
        stmt.free();
        
        return result.id ? this.rowToDistillation(result) : null;
    }

    async getAllSummaries() {
        await this.init();
        
        const stmt = this.sqlDb.prepare('SELECT * FROM summaries ORDER BY createdAt ASC');
        const results = [];
        
        while (stmt.step()) {
            const row = stmt.getAsObject();
            results.push(this.rowToDistillation(row));
        }
        
        stmt.free();
        return results;
    }

    async deleteDistillation(id) {
        await this.init();
        
        const stmt = this.sqlDb.prepare('DELETE FROM summaries WHERE id = ?');
        stmt.run([id]);
        const changes = this.sqlDb.getRowsModified();
        stmt.free();
        
        await this.saveToIndexedDB();
        return changes > 0;
    }

    async updateDistillationStatus(id, status, processingStep = null, error = null) {
        await this.init();
        
        const updates = { status };
        const values = [status];
        let setClauses = ['status = ?'];

        if (status === 'completed') {
            updates.completedAt = new Date().toISOString();
            setClauses.push('completedAt = ?');
            values.push(updates.completedAt);
        }

        if (processingStep) {
            updates.processingStep = processingStep;
            setClauses.push('processingStep = ?');
            values.push(processingStep);
        }

        if (error) {
            updates.error = error;
            setClauses.push('error = ?');
            values.push(error);
        }

        // Handle elapsed time calculation
        const distillation = await this.getDistillation(id);
        if (status === 'distilling' && distillation && !distillation.distillingStartTime) {
            const distillingStartTime = new Date().toISOString();
            setClauses.push('distillingStartTime = ?', 'elapsedTime = ?');
            values.push(distillingStartTime, 0);
        } else if (distillation && distillation.distillingStartTime) {
            const elapsedTime = (new Date() - new Date(distillation.distillingStartTime)) / 1000;
            setClauses.push('elapsedTime = ?');
            values.push(elapsedTime);
        } else if (distillation && distillation.startTime && status !== 'distilling') {
            const elapsedTime = (new Date() - new Date(distillation.startTime)) / 1000;
            setClauses.push('elapsedTime = ?');
            values.push(elapsedTime);
        }

        values.push(id);
        const sql = `UPDATE summaries SET ${setClauses.join(', ')} WHERE id = ?`;
        
        const stmt = this.sqlDb.prepare(sql);
        stmt.run(values);
        const changes = this.sqlDb.getRowsModified();
        stmt.free();
        
        await this.saveToIndexedDB();
        return changes > 0;
    }

    async updateDistillationContent(id, content, rawContent, processingTime, wordCount) {
        await this.init();
        
        const distillation = await this.getDistillation(id);
        const now = new Date();
        const elapsedTime = distillation && distillation.distillingStartTime ?
            (now - new Date(distillation.distillingStartTime)) / 1000 :
            (distillation && distillation.startTime ? (now - new Date(distillation.startTime)) / 1000 : 0);

        const stmt = this.sqlDb.prepare(`
            UPDATE summaries SET 
            content = ?, rawContent = ?, processingTime = ?, elapsedTime = ?, 
            wordCount = ?, status = ?, processingStep = ?, completedAt = ? 
            WHERE id = ?
        `);

        stmt.run([
            content, rawContent, processingTime, elapsedTime, wordCount, 
            'completed', 'Distillation completed', now.toISOString(), id
        ]);
        
        const changes = this.sqlDb.getRowsModified();
        stmt.free();
        
        await this.saveToIndexedDB();
        return changes > 0;
    }

    async searchSummaries(query) {
        await this.init();
        
        const searchTerm = `%${query}%`;
        const stmt = this.sqlDb.prepare(`
            SELECT * FROM summaries 
            WHERE title LIKE ? OR content LIKE ? 
            ORDER BY createdAt ASC
        `);
        
        const results = [];
        stmt.bind([searchTerm, searchTerm]);
        
        while (stmt.step()) {
            const row = stmt.getAsObject();
            results.push(this.rowToDistillation(row));
        }
        
        stmt.free();
        return results;
    }

    rowToDistillation(row) {
        let sourceFile = null;
        if (row.sourceFile) {
            try {
                sourceFile = JSON.parse(row.sourceFile);
            } catch (e) {
                sourceFile = null;
            }
        }

        return {
            id: row.id,
            title: row.title,
            content: row.content,
            sourceUrl: row.sourceUrl,
            sourceType: row.sourceType,
            sourceFile: sourceFile,
            status: row.status,
            processingStep: row.processingStep,
            rawContent: row.rawContent,
            createdAt: row.createdAt ? new Date(row.createdAt) : null,
            completedAt: row.completedAt ? new Date(row.completedAt) : null,
            processingTime: row.processingTime,
            elapsedTime: row.elapsedTime,
            startTime: row.startTime ? new Date(row.startTime) : null,
            distillingStartTime: row.distillingStartTime ? new Date(row.distillingStartTime) : null,
            wordCount: row.wordCount,
            error: row.error,
            logs: row.logs ? JSON.parse(row.logs) : [],
            queuePosition: row.queuePosition
        };
    }

    async close() {
        if (this.sqlDb) {
            this.sqlDb.close();
        }
        if (this.db) {
            this.db.close();
        }
    }
}

// Export for use in other modules
window.Database = Database;