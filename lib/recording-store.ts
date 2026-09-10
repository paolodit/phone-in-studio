import { recordingLockName, type LocalRecording } from "@/lib/recording-model";

const databaseName = "phone-in-recordings-v1";
let opening: Promise<IDBDatabase> | undefined;
function database() {
  if (!opening) opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error("This browser cannot save local recordings.")); return; }
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("recordings", { keyPath: "id" });
      request.result.createObjectStore("chunks", { keyPath: ["recordingId", "index"] });
    };
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); opening = undefined; }; resolve(request.result); };
    request.onerror = () => reject(new Error("Local recording storage is unavailable. Check browser storage permissions."));
    request.onblocked = () => reject(new Error("Close other recording windows, then try again."));
  }).catch((error) => { opening = undefined; throw error; });
  return opening;
}
async function write(stores: string[], run: (transaction: IDBTransaction) => void) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error ?? new Error("Recording storage failed.")); tx.onabort = () => reject(tx.error ?? new Error("Recording storage was interrupted."));
    try { run(tx); } catch (error) { tx.abort(); reject(error); }
  });
}
export const saveRecording = (recording: LocalRecording) => write(["recordings"], (tx) => { tx.objectStore("recordings").put(recording); });
export const saveRecordingChunk = (recordingId: string, index: number, blob: Blob) => write(["chunks"], (tx) => { tx.objectStore("chunks").put({ recordingId, index, blob }); });
export async function listRecordings(showId: string): Promise<LocalRecording[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction("recordings").objectStore("recordings").getAll();
    request.onsuccess = () => resolve((request.result as LocalRecording[]).filter((item) => item.showId === showId).sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
    request.onerror = () => reject(request.error);
  });
}
export async function recordingBlob(recording: LocalRecording) {
  const db = await database();
  return new Promise<Blob>((resolve, reject) => {
    const range = IDBKeyRange.bound([recording.id, 0], [recording.id, Number.MAX_SAFE_INTEGER]);
    const request = db.transaction("chunks").objectStore("chunks").getAll(range);
    request.onsuccess = () => resolve(new Blob(request.result.map((item: { blob: Blob }) => item.blob), { type: recording.mimeType }));
    request.onerror = () => reject(request.error);
  });
}
export const deleteRecording = (id: string) => write(["recordings", "chunks"], (tx) => {
  tx.objectStore("recordings").delete(id);
  tx.objectStore("chunks").delete(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]));
});

/** Explicit recovery only, after verifying no Studio tab owns this capture. */
export async function recoverRecording(recording: LocalRecording): Promise<LocalRecording> {
  if (!navigator.locks) throw new Error("This browser cannot safely check for active recordings. Use Chrome or Edge to recover this capture.");
  return navigator.locks.request(recordingLockName(recording.id), { ifAvailable: true }, async (lock) => {
    if (!lock) throw new Error("This capture is still active in a Studio tab. Stop and save it there first.");
    const latest = (await listRecordings(recording.showId)).find((item) => item.id === recording.id);
    if (!latest) throw new Error("This recording no longer exists.");
    if (latest.status !== "recording") return latest;
    const recovered: LocalRecording = { ...latest, status: "interrupted", note: "Recovered after an unfinished capture. The final seconds may be missing; check playback and download a copy." };
    await saveRecording(recovered);
    return recovered;
  });
}
