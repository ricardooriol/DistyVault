/**
 * Database - Client-side persistence for DistyVault
 * Uses IndexedDB with a safe localStorage fallback.
 */
(function() {
    const DB_NAME = 'DistyVaultDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'distillations';

    class Database {
        constructor() {
            this.supportsIndexedDB = typeof indexedDB !== 'undefined';
            this.dbPromise = this.supportsIndexedDB ? this.initDB() : null;
        }

        // ===============
        // IndexedDB setup
        // ===============
        initDB() {
            return new Promise((resolve, reject) => {
                try {
                    const request = indexedDB.open(DB_NAME, DB_VERSION);

                    request.onupgradeneeded = (event) => {
                        const db = request.result;
                        if (!db.objectStoreNames.contains(STORE_NAME)) {
                            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                            store.createIndex('status', 'status', { unique: false });
                            store.createIndex('createdAt', 'createdAt', { unique: false });
                        }
                    };

                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
                } catch (err) {
                    console.warn('IndexedDB init failed, will use localStorage fallback:', err);
                    resolve(null);
                }
            });
        }

        async withStore(mode, fn) {
            if (!this.supportsIndexedDB) {
                return fn(null);
            }
            const db = await this.dbPromise;
            if (!db) return fn(null);
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, mode);
                const store = tx.objectStore(STORE_NAME);
                let result;
                try {
                    result = fn(store);
                } catch (e) {
                    reject(e);
                    return;
                }
                tx.oncomplete = () => resolve(result);
                tx.onerror = () => reject(tx.error || new Error('Transaction failed'));
                tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
            });
        }

        // ========
        // Helpers
        // ========
        static _ensureDates(item) {
            if (!item || typeof item !== 'object') return item;
            const dateFields = ['createdAt', 'completedAt', 'startTime', 'distillingStartTime'];
            for (const f of dateFields) {
                if (item[f] && typeof item[f] === 'string') {
                    const d = new Date(item[f]);
                    if (!isNaN(d)) item[f] = d;
                }
            }
            return item;
        }

        // ==================
        // LocalStorage paths
        // ==================
        _lsKey() { return 'distyvault:distillations'; }

        _lsReadAll() {
            const raw = localStorage.getItem(this._lsKey());
            if (!raw) return [];
            try {
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed.map(Database._ensureDates) : [];
            } catch {
                return [];
            }
        }

        _lsWriteAll(items) {
            localStorage.setItem(this._lsKey(), JSON.stringify(items));
        }

        // =========
        // CRUD API
        // =========
        async saveDistillation(distillation) {
            // Normalize item before save
            const item = { ...distillation };
            if (!item.createdAt) item.createdAt = new Date();
            // Store Date objects directly in IDB; for LS store ISO strings
            if (this.supportsIndexedDB) {
                return this.withStore('readwrite', (store) => store.put(item));
            } else {
                const all = this._lsReadAll();
                const idx = all.findIndex(i => i.id === item.id);
                const toSave = { ...item };
                // Convert Dates to ISO strings
                ['createdAt','completedAt','startTime','distillingStartTime'].forEach(k => {
                    if (toSave[k] instanceof Date) toSave[k] = toSave[k].toISOString();
                });
                if (idx >= 0) all[idx] = toSave; else all.push(toSave);
                this._lsWriteAll(all);
                return true;
            }
        }

        async updateDistillationStatus(id, status, processingStep = '', errorMessage = null) {
            const item = await this.getDistillation(id);
            if (!item) return false;
            item.status = status;
            item.processingStep = processingStep || item.processingStep;
            if (errorMessage) item.error = errorMessage;

            // Track key timestamps
            if (status === 'processing' && !item.startTime) item.startTime = new Date();
            if (status === 'distilling') item.distillingStartTime = new Date();
            if (status === 'failed' || status === 'cancelled') item.completedAt = new Date();

            // Update elapsedTime if possible
            if (item.startTime) {
                const end = item.completedAt || new Date();
                item.elapsedTime = Math.max(0, Math.floor((new Date(end) - new Date(item.startTime)) / 1000));
            }

            return this.saveDistillation(item);
        }

        async updateDistillationContent(id, content, rawContent, processingTime = 0, wordCount = 0) {
            const item = await this.getDistillation(id);
            if (!item) return false;
            item.content = content;
            item.rawContent = rawContent;
            item.processingTime = processingTime;
            item.wordCount = wordCount;
            item.status = 'completed';
            item.processingStep = 'Completed';
            item.completedAt = new Date();

            if (item.startTime) {
                item.elapsedTime = Math.max(0, Math.floor((new Date(item.completedAt) - new Date(item.startTime)) / 1000));
            }

            return this.saveDistillation(item);
        }

        async getDistillation(id) {
            if (this.supportsIndexedDB) {
                return this.withStore('readonly', (store) => {
                    return new Promise((resolve, reject) => {
                        const req = store.get(id);
                        req.onsuccess = () => resolve(Database._ensureDates(req.result));
                        req.onerror = () => reject(req.error || new Error('get failed'));
                    });
                });
            } else {
                return this._lsReadAll().find(i => i.id === id) || null;
            }
        }

        async getAllSummaries() {
            if (this.supportsIndexedDB) {
                return this.withStore('readonly', (store) => {
                    return new Promise((resolve, reject) => {
                        const req = store.getAll();
                        req.onsuccess = () => {
                            const items = (req.result || []).map(Database._ensureDates);
                            resolve(this._sortForUi(items));
                        };
                        req.onerror = () => reject(req.error || new Error('getAll failed'));
                    });
                });
            } else {
                const items = this._lsReadAll();
                return this._sortForUi(items);
            }
        }

        async deleteDistillation(id) {
            if (this.supportsIndexedDB) {
                return this.withStore('readwrite', (store) => {
                    return new Promise((resolve, reject) => {
                        const req = store.delete(id);
                        req.onsuccess = () => resolve(true);
                        req.onerror = () => reject(req.error || new Error('delete failed'));
                    });
                });
            } else {
                const all = this._lsReadAll();
                const next = all.filter(i => i.id !== id);
                const changed = next.length !== all.length;
                if (changed) this._lsWriteAll(next);
                return changed;
            }
        }

        // Basic sort: prioritize queued/processing/distilling at top, then by createdAt desc
        _sortForUi(items) {
            const statusRank = {
                processing: 0,
                distilling: 1,
                queued: 2,
                completed: 3,
                failed: 4,
                cancelled: 5
            };
            return [...items].sort((a, b) => {
                const ar = statusRank[a.status] ?? 99;
                const br = statusRank[b.status] ?? 99;
                if (ar !== br) return ar - br;
                const ad = new Date(a.createdAt || 0).getTime();
                const bd = new Date(b.createdAt || 0).getTime();
                return bd - ad;
            });
        }
    }

    // Expose globally for existing code
    window.Database = Database;
})();
