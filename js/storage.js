const DB_NAME = "gameboy-pwa";
const DB_VER = 2;
const MAX_STATES = 5;

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
      if (!db.objectStoreNames.contains("states")) {
        const states = db.createObjectStore("states", { keyPath: "id" });
        states.createIndex("byRom", "romId", { unique: false });
      }
      if (!db.objectStoreNames.contains("scores")) {
        db.createObjectStore("scores", { keyPath: "gameId" });
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

export function stateId(romIdValue, slot) {
  return `${romIdValue}::${slot}`;
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
  const states = await listStates(id);
  for (const row of states) {
    await tx("states", "readwrite", (os) => os.delete(row.id));
  }
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

export async function listStates(romIdValue) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction("states").objectStore("states").getAll();
    req.onsuccess = () => {
      const rows = (req.result || [])
        .filter((row) => row.romId === romIdValue)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function putState(row) {
  const id = row.id || stateId(row.romId, row.slot);
  const record = { ...row, id, createdAt: row.createdAt || Date.now() };
  await tx("states", "readwrite", (os) => os.put(record));
  return id;
}

export async function deleteState(id) {
  await tx("states", "readwrite", (os) => os.delete(id));
}

export async function saveNewState(romIdValue, extra) {
  const existing = await listStates(romIdValue);
  const used = new Set(existing.map((s) => s.slot));
  let slot = 1;
  while (used.has(slot) && slot <= MAX_STATES) slot += 1;
  if (slot > MAX_STATES) {
    const oldest = [...existing].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0];
    if (oldest) await deleteState(oldest.id);
    slot = oldest?.slot || 1;
  }
  return putState({
    romId: romIdValue,
    slot,
    ...extra,
  });
}

export async function getBestScore(gameId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction("scores").objectStore("scores").get(gameId);
    req.onsuccess = () => resolve(req.result?.best || 0);
    req.onerror = () => reject(req.error);
  });
}

export async function putBestScore(gameId, score) {
  const best = Math.max(0, Number(score) || 0);
  const prev = await getBestScore(gameId);
  if (best <= prev) return prev;
  await tx("scores", "readwrite", (os) => os.put({ gameId, best, updatedAt: Date.now() }));
  return best;
}
