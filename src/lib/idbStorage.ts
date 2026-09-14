/**
 * Robust, zero-dependency IndexedDB key-value storage.
 * Designed to bypass localStorage 5MB quota limitations for large base64 documents,
 * ID cards, audio notes, and rich attachments.
 */

const DB_NAME = 'MMBA_OFFLINE_DB';
const DB_VERSION = 1;
const STORE_NAME = 'mmba_keyval';

class IDBStorage {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryFallback = new Map<string, any>();

  private getDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return Promise.resolve(null);
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        try {
          const request = window.indexedDB.open(DB_NAME, DB_VERSION);

          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME);
            }
          };

          request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
          };

          request.onerror = (err) => {
            console.warn('[IDBStorage] IndexedDB open error, using memory fallback:', err);
            resolve(null);
          };
        } catch (e) {
          console.warn('[IDBStorage] IndexedDB initialization failed, using fallback:', e);
          resolve(null);
        }
      });
    }

    return this.dbPromise;
  }

  public async get<T = any>(key: string): Promise<T | null> {
    const db = await this.getDB();
    if (!db) {
      return (this.memoryFallback.get(key) as T) || null;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onsuccess = () => {
          resolve(req.result !== undefined ? req.result : null);
        };

        req.onerror = () => {
          resolve((this.memoryFallback.get(key) as T) || null);
        };
      } catch (err) {
        resolve((this.memoryFallback.get(key) as T) || null);
      }
    });
  }

  public async set(key: string, value: any): Promise<void> {
    this.memoryFallback.set(key, value);
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, key);

        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch (err) {
        resolve();
      }
    });
  }

  public async delete(key: string): Promise<void> {
    this.memoryFallback.delete(key);
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);

        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch (err) {
        resolve();
      }
    });
  }

  public async clear(): Promise<void> {
    this.memoryFallback.clear();
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();

        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch (err) {
        resolve();
      }
    });
  }
}

export const idbStorage = new IDBStorage();
