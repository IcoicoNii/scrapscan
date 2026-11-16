// Minimal promise wrapper around IndexedDB (browser only). Two stores:
//   queue: saved collections waiting to send, keyed by collection id
//   meta:  small key/value records (the household directory)

const DB_NAME = "scrapscan";
const DB_VERSION = 1;
export type StoreName = "queue" | "meta";

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close(); // let a newer tab upgrade
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB blocked"));
  }).catch((e) => {
    opening = null; // allow a later retry
    throw e;
  });
  return opening;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        // Resolve on commit, not on request success, so a write is durable before we report it saved.
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
      }),
  );
}

export const idb = {
  get: <T>(store: StoreName, key: IDBValidKey) => run<T | undefined>(store, "readonly", (s) => s.get(key)),
  getAll: <T>(store: StoreName) => run<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>),
  put: (store: StoreName, value: unknown, key?: IDBValidKey) => run(store, "readwrite", (s) => s.put(value, key)),
  delete: (store: StoreName, key: IDBValidKey) => run(store, "readwrite", (s) => s.delete(key)),
  /** True if this browser can store data (false in some private modes). */
  available: () => open().then(() => true, () => false),
};
