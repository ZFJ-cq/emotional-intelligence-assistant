var DB_NAME = 'EQReplyDB';
var DB_VERSION = 1;
let db = null;

var CryptoUtil = {
    _cachedKey: null,

    async generateKey() {
        const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
        );
        this._cachedKey = key;
        localStorage.setItem('eq_enc_enabled', 'true');
        return key;
    },

    async getKey() {
        if (this._cachedKey) return this._cachedKey;
        return null;
    },

    hasKey() {
        return !!this._cachedKey;
    },

    async encrypt(text) {
        try {
            const key = await this.getKey();
            if (!key) return text;
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encoded = new TextEncoder().encode(text);
            const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < combined.length; i += chunkSize) {
                const chunk = combined.subarray(i, i + chunkSize);
                binary += String.fromCharCode.apply(null, chunk);
            }
            return btoa(binary);
        } catch (e) { return text; }
    },

    async decrypt(ciphertext) {
        try {
            const key = await this.getKey();
            if (!key) return ciphertext;
            const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
            const iv = combined.slice(0, 12);
            const data = combined.slice(12);
            const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
            return new TextDecoder().decode(decrypted);
        } catch (e) { return ciphertext; }
    }
};

var DataLog = {
    async add(action, type, detail) {
        try {
            if (!db || !db.objectStoreNames.contains('activityLog')) return;
            const tx = db.transaction('activityLog', 'readwrite');
            const store = tx.objectStore('activityLog');
            store.add({ id: Date.now() + Math.random(), action, type, detail, timestamp: new Date().toISOString() });
        } catch (e) {
            console.warn('Activity log skipped:', e);
        }
    },
    async getAll() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction('activityLog', 'readonly');
            const req = tx.objectStore('activityLog').getAll();
            req.onsuccess = () => resolve(req.result.reverse());
            req.onerror = () => reject(req.error);
        });
    }
};

var DB = {
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const d = e.target.result;
                if (!d.objectStoreNames.contains('scenes')) {
                    const s = d.createObjectStore('scenes', { keyPath: 'id' });
                    s.createIndex('parentId', 'parentId', { unique: false });
                }
                if (!d.objectStoreNames.contains('replies')) {
                    const s = d.createObjectStore('replies', { keyPath: 'id' });
                    s.createIndex('sceneId', 'sceneId', { unique: false });
                    s.createIndex('style', 'style', { unique: false });
                }
                if (!d.objectStoreNames.contains('userHistory')) {
                    const s = d.createObjectStore('userHistory', { keyPath: 'id' });
                    s.createIndex('timestamp', 'timestamp', { unique: false });
                    s.createIndex('scene', 'scene', { unique: false });
                }
                if (!d.objectStoreNames.contains('favorites')) {
                    d.createObjectStore('favorites', { keyPath: 'id' });
                }
                if (!d.objectStoreNames.contains('folders')) {
                    d.createObjectStore('folders', { keyPath: 'id' });
                }
                if (!d.objectStoreNames.contains('settings')) {
                    d.createObjectStore('settings', { keyPath: 'key' });
                }
                if (!d.objectStoreNames.contains('activityLog')) {
                    const s = d.createObjectStore('activityLog', { keyPath: 'id' });
                    s.createIndex('timestamp', 'timestamp', { unique: false });
                }
                if (!d.objectStoreNames.contains('userTags')) {
                    d.createObjectStore('userTags', { keyPath: 'id' });
                }
            };
            request.onsuccess = (e) => { db = e.target.result; resolve(db); };
            request.onerror = (e) => reject(e.target.error);
        });
    },

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async get(storeName, id) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).put(data);
            req.onsuccess = () => { DataLog.add('put', storeName, 'id=' + data.id); resolve(req.result); };
            req.onerror = () => reject(req.error);
        });
    },

    async add(storeName, data) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).add(data);
            req.onsuccess = () => { DataLog.add('add', storeName, 'id=' + (data.id || 'auto')); resolve(req.result); };
            req.onerror = () => reject(req.error);
        });
    },

    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).delete(id);
            req.onsuccess = () => { DataLog.add('delete', storeName, 'id=' + id); resolve(); };
            req.onerror = () => reject(req.error);
        });
    },

    async clear(storeName) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).clear();
            req.onsuccess = () => { DataLog.add('clear', storeName, 'all'); resolve(); };
            req.onerror = () => reject(req.error);
        });
    },

    async getByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const index = tx.objectStore(storeName).index(indexName);
            const req = index.getAll(value);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async count(storeName) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async getSetting(key) {
        const result = await this.get('settings', key);
        return result ? result.value : null;
    },

    async setSetting(key, value) {
        await this.put('settings', { key, value });
    },

    async exportAll() {
        const data = {};
        const storeNames = ['scenes', 'replies', 'userHistory', 'favorites', 'folders', 'settings', 'userTags'];
        for (const name of storeNames) {
            data[name] = await this.getAll(name);
        }
        const shouldEncrypt = CryptoUtil.hasKey();
        const rawData = JSON.stringify(data);
        const payload = shouldEncrypt ? await CryptoUtil.encrypt(rawData) : rawData;
        return JSON.stringify({
            version: DB_VERSION,
            exportedAt: new Date().toISOString(),
            encrypted: shouldEncrypt,
            data: payload
        });
    },

    async importAll(jsonStr) {
        try {
            const backup = JSON.parse(jsonStr);
            if (!backup || typeof backup !== 'object' || !backup.data) {
                throw new Error('无效的备份文件格式');
            }
            let dataStr = backup.data;
            if (backup.encrypted) {
                dataStr = await CryptoUtil.decrypt(dataStr);
            }
            const data = JSON.parse(dataStr);
            if (!data || typeof data !== 'object') {
                throw new Error('无效的备份数据');
            }
            const storeNames = ['scenes', 'replies', 'userHistory', 'favorites', 'folders', 'settings', 'userTags'];
            // Validate all data before writing
            const validatedData = {};
            for (const name of storeNames) {
                if (data[name] && Array.isArray(data[name])) {
                    const maxItems = name === 'replies' ? 10000 : 1000;
                    validatedData[name] = data[name].slice(0, maxItems).filter(item => item && typeof item === 'object');
                }
            }
            for (const name of storeNames) {
                if (validatedData[name]) {
                    await this.clear(name);
                    for (const item of validatedData[name]) {
                        if (name === 'replies' && item.reply) {
                            item.reply = item.reply.replace(/<[^>]*>/g, '');
                        }
                        if (name === 'replies' && item.input) {
                            item.input = item.input.replace(/<[^>]*>/g, '');
                        }
                        await this.put(name, item);
                    }
                }
            }
            await DataLog.add('import', 'all', 'data imported');
            return true;
        } catch (e) {
            console.error('Import failed:', e);
            return false;
        }
    },

    async deleteAllData() {
        const storeNames = ['scenes', 'replies', 'userHistory', 'favorites', 'folders', 'settings', 'userTags', 'activityLog'];
        for (const name of storeNames) {
            await this.clear(name);
        }
        localStorage.removeItem('eq_enc_enabled');
        localStorage.removeItem('eq_lock_pwd');
        localStorage.removeItem('eq_lock_enabled');
    }
};
