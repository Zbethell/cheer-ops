// Remembers which folder cards are saved into.
//
// The point is the person doing the printing. A browser cannot start the print
// script itself - browsers forbid launching local programs - so the card-printing
// PC runs scripts/watch-and-print.ps1, which prints whatever lands in this
// folder. That leaves exactly one thing for the operator to do: press Save. But
// only if they are not asked to find the folder again every time.
//
// A directory handle cannot go in localStorage, which stores strings; it is a
// live object and has to be structured-cloned into IndexedDB. The permission
// grant is separate from the handle and is re-checked each session, though
// Chrome renews it without prompting once a folder has been allowed.
//
// Every function here fails soft. Private windows, cleared site data and
// browsers without the File System Access API all end up back at the plain
// download path, which still works - it is just more clicks.

const DB_NAME = "cheer-ops-cards";
const STORE = "handles";
const KEY = "cardFolder";

export const canRememberFolder = () =>
  typeof window !== "undefined" && !!window.showDirectoryPicker && !!window.indexedDB;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.onerror = () => reject(tx.error);
      if (req) { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }
      else tx.oncomplete = () => resolve();
    });
  } finally {
    db.close();
  }
}

export async function rememberFolder(handle) {
  if (!canRememberFolder()) return false;
  try { await withStore("readwrite", (s) => s.put(handle, KEY)); return true; }
  catch { return false; }
}

export async function recallFolder() {
  if (!canRememberFolder()) return null;
  try { return (await withStore("readonly", (s) => s.get(KEY))) || null; }
  catch { return null; }
}

export async function forgetFolder() {
  if (!canRememberFolder()) return;
  try { await withStore("readwrite", (s) => s.delete(KEY)); } catch { /* nothing to forget */ }
}

/**
 * Whether we may still write to a remembered folder.
 *
 * `prompt` decides whether the browser is allowed to ask. Asking is only
 * permitted directly inside a click - a permission request outside one is
 * rejected - so the page checks silently on load and asks when Save is pressed.
 */
export async function folderIsWritable(handle, { prompt = false } = {}) {
  if (!handle?.queryPermission) return false;
  try {
    const opts = { mode: "readwrite" };
    if ((await handle.queryPermission(opts)) === "granted") return true;
    if (!prompt) return false;
    return (await handle.requestPermission(opts)) === "granted";
  } catch {
    // The folder was deleted, renamed, or is on a drive that is no longer there.
    return false;
  }
}
