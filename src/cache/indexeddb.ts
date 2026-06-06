const DB_NAME = 'maplibre-gl-tileserver';
const STORE_NAME = 'tiles';
const DB_VERSION = 1;

export class IndexedDBTileCache {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(key: string): Promise<Uint8Array | undefined> {
    if (!this.db) return undefined;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result as ArrayBuffer | undefined;
        resolve(result ? new Uint8Array(result) : undefined);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async set(key: string, value: Uint8Array): Promise<void> {
    if (!this.db) return;
    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength), key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
