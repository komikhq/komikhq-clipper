/**
 * Temporary IndexedDB Storage Bridge
 *
 * Facilitates transferring large binary buffers between Service Worker
 * and Offscreen Document within the same extension origin.
 * Bypasses Chrome's 64 MB runtime message IPC limit completely.
 */

const DB_NAME = 'KomikHQClipperTempDB';
const DB_VERSION = 1;
const STORE_NAME = 'temp_blobs';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Stores an ArrayBuffer or Uint8Array temporarily in IndexedDB.
 */
export async function storeTempBinary(key: string, data: ArrayBuffer | Uint8Array): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const buffer = data instanceof Uint8Array ? data.buffer : data;
    const request = store.put(buffer, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error(`Failed to store temporary binary for key: ${key}`));

    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Transaction error while storing binary'));
    };
  });
}

/**
 * Retrieves an ArrayBuffer from IndexedDB and IMMEDIATELY deletes it from the store
 * to ensure zero storage buildup.
 */
export async function retrieveAndRemoveTempBinary(key: string): Promise<ArrayBuffer | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(key);

    getRequest.onsuccess = () => {
      const result = getRequest.result as ArrayBuffer | undefined;
      // Immediately delete record in the same transaction
      store.delete(key);
      resolve(result ?? null);
    };

    getRequest.onerror = () => reject(getRequest.error || new Error(`Failed to retrieve binary for key: ${key}`));

    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Transaction error while retrieving and deleting binary'));
    };
  });
}

/**
 * Explicitly removes any dangling temporary binary record.
 */
export async function removeTempBinary(key: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);

      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // Ignore cleanup failure for non-existent db
  }
}
