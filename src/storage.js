const DB_NAME = 'BlueMarbleDB';
const DB_VERSION = 1;
const TEMPLATES_STORE = 'templates';
const SNAPSHOTS_STORE = 'snapshots';
const MAX_SNAPSHOTS = 10;

export default class StorageManager {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.errorCode);
        reject('Error opening database');
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(TEMPLATES_STORE)) {
          db.createObjectStore(TEMPLATES_STORE, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(SNAPSHOTS_STORE)) {
          const snapshotStore = db.createObjectStore(SNAPSHOTS_STORE, { keyPath: 'id', autoIncrement: true });
          snapshotStore.createIndex('templateId', 'templateId', { unique: false });
        }
      };
    });
  }

  async putTemplate(templateData) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TEMPLATES_STORE], 'readwrite');
      const store = transaction.objectStore(TEMPLATES_STORE);
      const request = store.put(templateData);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject('Error saving template: ' + event.target.errorCode);
    });
  }

  async getTemplates() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TEMPLATES_STORE], 'readonly');
      const store = transaction.objectStore(TEMPLATES_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject('Error fetching templates: ' + event.target.errorCode);
    });
  }

  async deleteTemplate(id) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TEMPLATES_STORE], 'readwrite');
      const store = transaction.objectStore(TEMPLATES_STORE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject('Error deleting template: ' + event.target.errorCode);
    });
  }

  async putSnapshot(templateId, snapshotData) {
    if (!this.db) await this.init();
    return new Promise(async (resolve, reject) => {
        const transaction = this.db.transaction([SNAPSHOTS_STORE], 'readwrite');
        const store = transaction.objectStore(SNAPSHOTS_STORE);
        
        const index = store.index('templateId');
        const snapshotsRequest = index.getAll(templateId);

        snapshotsRequest.onsuccess = () => {
            const snapshots = snapshotsRequest.result;
            snapshots.sort((a, b) => b.timestamp - a.timestamp);

            if (snapshots.length >= MAX_SNAPSHOTS) {
                const oldestSnapshotId = snapshots[snapshots.length - 1].id;
                store.delete(oldestSnapshotId);
            }

            const addRequest = store.add({ templateId, ...snapshotData, timestamp: Date.now() });
            addRequest.onsuccess = () => resolve(addRequest.result);
            addRequest.onerror = (event) => reject('Error saving snapshot: ' + event.target.errorCode);
        };
        snapshotsRequest.onerror = (event) => reject('Error fetching snapshots for rotation: ' + event.target.errorCode);
    });
  }
}
