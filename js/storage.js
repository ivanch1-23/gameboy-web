const DB_NAME = "gameboy-pwa";
const DB_VER = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("roms")) {
        db.createObjectStore("roms", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("saves")) {
        db.createObjectStore("saves", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const os = t.objectStore(store);
        const result = fn(os);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
      })
  );
}

export function romId(name, size) {
  return `${name}::${size}`;
}

export async function listRoms() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction("roms").objectStore("roms").getAll();
    req.onsuccess = () => {
      const rows = (req.result || []).sort((a, b) => a.name.localeCompare(b.name, "es"));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function putRom({ name, data }) {
  const id = romId(name, data.byteLength);
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data);
  await tx("roms", "readwrite", (os) => {
    os.put({
      id,
      name,
      size: bytes.byteLength,
      data: bytes,
      addedAt: Date.now(),
    });
  });
  return id;
}

export async function getRom(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction("roms").objectStore("roms").get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteRom(id) {
  await tx("roms", "readwrite", (os) => os.delete(id));
  await tx("saves", "readwrite", (os) => os.delete(id));
}

export async function putSave(id, data) {
  await tx("saves", "readwrite", (os) => os.put({ id, data, updatedAt: Date.now() }));
}

export async function getSave(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction("saves").objectStore("saves").get(id);
    req.onsuccess = () => resolve(req.result?.data || null);
    req.onerror = () => reject(req.error);
  });
}
