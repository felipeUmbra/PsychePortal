// Mock Firestore implementation using localStorage and generic events to simulate Firebase syncing locally
import { v4 as uuidv4 } from 'uuid';

const DRIVE_TOKEN_STORAGE_KEY = 'google_drive_token';

let driveToken: string | null = typeof window !== 'undefined' ? sessionStorage.getItem(DRIVE_TOKEN_STORAGE_KEY) : null;

const getSessionStorageItem = (key: string): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const setSessionStorageItem = (key: string, value: string | null) => {
  if (typeof window === 'undefined') return;

  try {
    if (value) {
      window.sessionStorage.setItem(key, value);
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore storage errors. Token state will still work in memory for the current session.
  }
};

driveToken = getSessionStorageItem(DRIVE_TOKEN_STORAGE_KEY);

export const setDriveToken = (token: string | null) => {
  driveToken = token;
  setSessionStorageItem(DRIVE_TOKEN_STORAGE_KEY, token);
  if (token && !isLoaded) {
    forceSync();
  }
  // Always force a clean sync when a new token is provided to prevent
  // data leakage between different user sessions on the same machine.
  if (token) {
    forceSync().catch(console.error);
  }
};

export const getFirestore = () => ({});

// Setup mock state
let state: Record<string, any[]> = {
  patients: [],
  sessions: [],
  psychologists: [],
  audit_logs: []
};

// Setup internal events for onSnapshot
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

// Collections and Documents
export const collection = (db: any, path: string) => {
  return { type: 'collection', path };
};

export const doc = (dbOrCol: any, path: string, id?: string) => {
  let finalPath = path;
  let finalId = id;

  // Handle doc(collectionRef, id) overload
  if (dbOrCol && typeof dbOrCol === 'object' && dbOrCol.type === 'collection') {
    finalPath = dbOrCol.path;
    finalId = path;
  } else if (!finalId) {
    const parts = finalPath.split('/');
    finalId = parts.pop();
    finalPath = parts.join('/');
  }
  return { type: 'doc', path: finalPath, id: finalId || uuidv4() };
};

// Queries
export const query = (col: any, ...args: any[]) => {
  return { ...col, conditions: args };
};

export const where = (field: string, op: string, val: any) => ({ type: 'where', field, op, val });
export const orderBy = (field: string, dir: string) => ({ type: 'orderBy', field, dir });
export const limit = (num: number) => ({ type: 'limit', num });

// Snapshot Classes
export class DocSnapshot {
  constructor(public id: string, private _data: any) { }
  exists() { return !!this._data; }
  data() {
    if (!this._data) return undefined;
    // Return a deep clone to prevent accidental direct mutation of the mock state.
    // We also remove the 'id' field if it's present in the body to match real Firestore behavior.
    const { id: _, ...fields } = this._data;
    return JSON.parse(JSON.stringify(fields));
  }
}

export class QuerySnapshot {
  docs: DocSnapshot[];
  constructor(docs: DocSnapshot[]) { this.docs = docs; }
  get size() { return this.docs.length; }
  get empty() { return this.docs.length === 0; }
}

const toTimestamp = (val: any): any => {
  if (val === null || val === undefined) return val;
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'number') return val;
  if (typeof val === 'string' && val.length > 5) {
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) return parsed;
  }
  if (val && typeof val === 'object' && val.toDate) {
    return val.toDate().getTime();
  }
  return val;
};

const applyConditions = (items: any[], conditions: any[]) => {
  let filtered = [...items];
  for (const cond of conditions) {
    if (cond.type === 'where') {
      filtered = filtered.filter(item => {
        const v1 = toTimestamp(item[cond.field]);
        const v2 = toTimestamp(cond.val);

        if (cond.op === '==') return v1 === v2;
        if (cond.op === 'in') return Array.isArray(cond.val) && cond.val.map(toTimestamp).includes(v1);
        if (cond.op === '>=') return v1 >= v2;
        if (cond.op === '<=') return v1 <= v2;
        if (cond.op === '<') return v1 < v2;
        if (cond.op === '>') return v1 > v2;
        return true;
      });
    } else if (cond.type === 'orderBy') {
      filtered.sort((a, b) => {
        const v1 = toTimestamp(a[cond.field]);
        const v2 = toTimestamp(b[cond.field]);
        if (cond.dir === 'desc') return v1 < v2 ? 1 : -1;
        return v1 > v2 ? 1 : -1;
      });
    } else if (cond.type === 'limit') {
      filtered = filtered.slice(0, cond.num);
    }
  }
  return filtered;
};

let isLoaded = false;
let loadPromise: Promise<void> | null = null;
let isLoading = false; // Mutex flag to prevent concurrent loads

export const loadFromDrive = async () => {
  if (loadPromise) return loadPromise;
  if (isLoaded && driveToken) return;

  isLoading = true;
  loadPromise = (async () => {
    // Initialize state to empty to ensure no stale data remains if the load takes time
    state = {
      patients: [],
      sessions: [],
      psychologists: [],
  audit_logs: []
};

    try {
      const token = driveToken;
      if (!token) {
        const localCache = localStorage.getItem('mock_db_cache');
        if (localCache) {
          state = JSON.parse(localCache);
          notify();
        }
        return;
      }

      console.log('Loading state from Google Drive...');
      const searchRes = await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name="workspace.json"', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!searchRes.ok) {
        const errorData = await searchRes.json().catch(() => ({}));
        console.error('Drive search failed:', searchRes.status, errorData);

        if (searchRes.status === 401 || searchRes.status === 403) {
          window.dispatchEvent(new CustomEvent('google-auth-error', {
            detail: {
              status: searchRes.status,
              service: 'drive_load_search',
              message: errorData.error?.message || searchRes.statusText
            }
          }));
          // Do NOT set isLoaded=true here, so we can retry when token is fixed
          isLoading = false;
          loadPromise = null;
          return;
        }
        throw new Error(`Drive search failed: ${searchRes.status}`);
      }

      window.dispatchEvent(new CustomEvent('google-auth-success'));
      const searchData = await searchRes.json();

      if (searchData.files && searchData.files.length > 0) {
        const fileId = searchData.files[0].id;
        const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!dlRes.ok) {
          const errorData = await dlRes.json().catch(() => ({}));
          console.error('Drive download failed:', dlRes.status, errorData);
          if (dlRes.status === 401 || dlRes.status === 403) {
            window.dispatchEvent(new CustomEvent('google-auth-error', {
              detail: {
                status: dlRes.status,
                service: 'drive_load_download',
                message: errorData.error?.message || dlRes.statusText
              }
            }));
            isLoading = false;
            loadPromise = null;
            return;
          }
          throw new Error(`Drive download failed: ${dlRes.status}`);
        }

        window.dispatchEvent(new CustomEvent('google-auth-success'));
        const data = await dlRes.json();
        if (data && typeof data === 'object') {
          state = {
            patients: Array.isArray(data.patients) ? data.patients : [],
            sessions: Array.isArray(data.sessions) ? data.sessions : [],
            psychologists: Array.isArray(data.psychologists) ? data.psychologists : [],
            audit_logs: Array.isArray(data.audit_logs) ? data.audit_logs : []
          };
          console.log('State successfully loaded from Google Drive');
          notify();
        }
      } else {
        console.log('No workspace file found in Google Drive appDataFolder.');
        // Fallback to local cache if drive is fresh but we have something in localStorage
        const localCache = localStorage.getItem('mock_db_cache');
        if (localCache) {
          state = JSON.parse(localCache);
          notify();
        }
      }

      // Process any pending operations before marking as loaded
      // This ensures user changes are not lost
      processPendingOperations();

      isLoaded = true; // Only mark as loaded if we successfully communicated with drive
    } catch (err) {
      console.error('Failed to load from Drive:', err);
      isLoaded = true; // Permite salvar mesmo que a carga inicial da nuvem falhe
      // Fallback to local cache on general errors
      const localCache = localStorage.getItem('mock_db_cache');
      if (localCache) {
        state = JSON.parse(localCache);
        notify();
      }
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
};

export const ensureLoaded = () => {
  return loadPromise || loadFromDrive();
};

export const forceSync = async () => {
  if (isLoading && loadPromise) return loadPromise;
  isLoaded = false;
  state = {
    patients: [],
    sessions: [],
    psychologists: [],
  audit_logs: []
};
  loadPromise = null; // Important: Clear the promise to allow a new fetch with fresh tokens
  return loadFromDrive();
};

let syncTimer: any;
let isSyncing = false;

// Pending operations queue to prevent data loss when Drive is loading
let pendingOperations: Array<() => void> = [];
let isQueueProcessing = false;

const processPendingOperations = () => {
  if (isQueueProcessing || pendingOperations.length === 0) return;
  isQueueProcessing = true;

  console.log(`Processing ${pendingOperations.length} pending operations...`);

  // Apply all pending operations to state
  pendingOperations.forEach(op => {
    try {
      op();
    } catch (err) {
      console.error('Error processing pending operation:', err);
    }
  });
  pendingOperations = [];

  isQueueProcessing = false;
  // Now save the merged state to Drive
  saveToDrive();
};

const saveToDrive = () => {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const token = driveToken;

    // Always backup to localStorage as a safety net
    // Even if not fully loaded, backup what we have
    localStorage.setItem('mock_db_cache', JSON.stringify(state));

    if (!token || isSyncing) {
      return;
    }
    isSyncing = true;
    try {
      console.log('Syncing state to Google Drive...');
      const searchRes = await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name="workspace.json"', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!searchRes.ok) {
        const errorData = await searchRes.json().catch(() => ({}));
        if (searchRes.status === 401 || searchRes.status === 403) {
          window.dispatchEvent(new CustomEvent('google-auth-error', {
            detail: {
              status: searchRes.status,
              service: 'drive_sync_search',
              message: errorData.error?.message || searchRes.statusText
            }
          }));
        }
        throw new Error(`Drive sync search failed: ${searchRes.status}`);
      }

      window.dispatchEvent(new CustomEvent('google-auth-success'));
      const searchData = await searchRes.json();

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({ name: 'workspace.json', parents: ['appDataFolder'] })], { type: 'application/json' }));
      form.append('file', new Blob([JSON.stringify(state)], { type: 'application/json' }));

      if (searchData.files && searchData.files.length > 0) {
        console.log('Updating existing Drive file...');
        const updateForm = new FormData();
        updateForm.append('metadata', new Blob([JSON.stringify({ name: 'workspace.json' })], { type: 'application/json' }));
        updateForm.append('file', new Blob([JSON.stringify(state)], { type: 'application/json' }));

        const patchRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${searchData.files[0].id}?uploadType=multipart`, {
          method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: updateForm
        });

        if (!patchRes.ok) {
          const errorData = await patchRes.json().catch(() => ({}));
          if (patchRes.status === 401 || patchRes.status === 403) {
            window.dispatchEvent(new CustomEvent('google-auth-error', {
              detail: {
                status: patchRes.status,
                service: 'drive_sync_update',
                message: errorData.error?.message || patchRes.statusText
              }
            }));
          }
          throw new Error(`Drive update failed: ${patchRes.status}`);
        }
        console.log('Update result:', patchRes.status);
        window.dispatchEvent(new CustomEvent('google-auth-success'));
      } else {
        console.log('Creating new Drive file...');
        const postRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form
        });

        if (!postRes.ok) {
          const errorData = await postRes.json().catch(() => ({}));
          if (postRes.status === 401 || postRes.status === 403) {
            window.dispatchEvent(new CustomEvent('google-auth-error', {
              detail: {
                status: postRes.status,
                service: 'drive_sync_create',
                message: errorData.error?.message || postRes.statusText
              }
            }));
          }
          throw new Error(`Drive create failed: ${postRes.status}`);
        }
        console.log('Create result:', postRes.status);
        window.dispatchEvent(new CustomEvent('google-auth-success'));
      }
    } catch (err) {
      console.error('Google Drive Sync Failed', err);
    } finally {
      isSyncing = false;
    }
  }, 500);
};

// Emergency sync on unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // We can't do much async here, but we can at least ensure localStorage is fresh
    localStorage.setItem('mock_db_cache', JSON.stringify(state));
  });
}

// Initial load
loadPromise = loadFromDrive();

// Fetching
export const getDocs = async (queryObj: any) => {
  await ensureLoaded();
  const collectionData = state[queryObj.path] || [];
  const filtered = queryObj.conditions ? applyConditions(collectionData, queryObj.conditions) : collectionData;
  return new QuerySnapshot(filtered.map(item => new DocSnapshot(item.id, item)));
};

export const getDoc = async (docRef: any) => {
  await ensureLoaded();
  const collectionData = state[docRef.path] || [];
  const item = collectionData.find(i => i.id === docRef.id);
  return new DocSnapshot(docRef.id, item);
};

export const onSnapshot = (queryObj: any, callback: any, errorCallback?: any) => {
  const handler = () => {
    try {
      const collectionData = state[queryObj.path] || [];
      const filtered = queryObj.conditions ? applyConditions(collectionData, queryObj.conditions) : collectionData;
      callback(new QuerySnapshot(filtered.map(item => new DocSnapshot(item.id, item))));
    } catch (err) {
      if (errorCallback) errorCallback(err);
    }
  };

  listeners.add(handler);

  // Emit initial state as soon as Drive data is ready
  ensureLoaded().then(() => {
    if (listeners.has(handler)) handler();
  });

  return () => {
    listeners.delete(handler);
  };
};

// Mutations
export const addDoc = async (colRef: any, data: any) => {
  if (!state[colRef.path]) state[colRef.path] = [];
  const id = uuidv4();

  // Process server timestamps and strip any provided ID to protect identity integrity
  const { id: _, ...processedData } = { ...data } as any;
  for (let key in processedData) {
    if (processedData[key] && processedData[key].isServerTimestamp) {
      processedData[key] = new Date().toISOString();
    }
  }

  // If not loaded yet, queue this operation to prevent data loss
  if (!isLoaded) {
    console.log('Queueing addDoc operation until Drive loads...');
    pendingOperations.push(() => {
      state[colRef.path].push({ id, ...processedData });
      notify();
    });
    // Still return the ID so the caller can use it
    return { id };
  }

  state[colRef.path].push({ id, ...processedData });
  saveToDrive();
  notify();
  return { id };
};

export const setDoc = async (docRef: any, data: any) => {
  if (!state[docRef.path]) state[docRef.path] = [];
  const idx = state[docRef.path].findIndex(i => i.id === docRef.id);

  // Process server timestamps and strip provided ID
  const { id: _, ...processedData } = { ...data } as any;
  for (let key in processedData) {
    if (processedData[key] && processedData[key].isServerTimestamp) {
      processedData[key] = new Date().toISOString();
    }
  }

  // If not loaded yet, queue this operation to prevent data loss
  if (!isLoaded) {
    console.log('Queueing setDoc operation until Drive loads...');
    pendingOperations.push(() => {
      const currentIdx = state[docRef.path].findIndex(i => i.id === docRef.id);
      if (currentIdx >= 0) {
        state[docRef.path][currentIdx] = { id: docRef.id, ...processedData };
      } else {
        state[docRef.path].push({ id: docRef.id, ...processedData });
      }
      notify();
    });
    return;
  }

  if (idx >= 0) {
    state[docRef.path][idx] = { id: docRef.id, ...processedData };
  } else {
    state[docRef.path].push({ id: docRef.id, ...processedData });
  }
  saveToDrive();
  notify();
};

export const updateDoc = async (docRef: any, data: any) => {
  if (!state[docRef.path]) return;
  const idx = state[docRef.path].findIndex(i => i.id === docRef.id);
  if (idx >= 0) {
    // Process server timestamps and strip provided ID
    const { id: _, ...processedData } = { ...data } as any;
    for (let key in processedData) {
      if (processedData[key] && processedData[key].isServerTimestamp) {
        processedData[key] = new Date().toISOString();
      }
    }

    // If not loaded yet, queue this operation to prevent data loss
    if (!isLoaded) {
      console.log('Queueing updateDoc operation until Drive loads...');
      pendingOperations.push(() => {
        const currentIdx = state[docRef.path].findIndex(i => i.id === docRef.id);
        if (currentIdx >= 0) {
          state[docRef.path][currentIdx] = { ...state[docRef.path][currentIdx], ...processedData };
          notify();
        }
      });
      return;
    }

    state[docRef.path][idx] = { ...state[docRef.path][idx], ...processedData };
    saveToDrive();
    notify();
  }
};

export const deleteDoc = async (docRef: any) => {
  if (!state[docRef.path]) return;

  // If not loaded yet, queue this operation to prevent data loss
  if (!isLoaded) {
    console.log('Queueing deleteDoc operation until Drive loads...');
    pendingOperations.push(() => {
      state[docRef.path] = state[docRef.path].filter(i => i.id !== docRef.id);
      notify();
    });
    return;
  }

  state[docRef.path] = state[docRef.path].filter(i => i.id !== docRef.id);
  saveToDrive();
  notify();
};

export const serverTimestamp = () => ({ isServerTimestamp: true });

// --- Storage Mock (Google Drive Integration) ---

export const getStorage = () => ({});

export const ref = (_storage: any, path: string) => {
  return { type: 'storage-ref', path };
};

export const uploadBytes = async (storageRef: any, data: Blob | Uint8Array) => {
  if (!driveToken) throw new Error('Google Drive token not found. Re-authorize in Settings.');

  const fileName = storageRef.path.split('/').pop();
  console.log(`Uploading ${fileName} to Google Drive...`);

  const metadata = {
    name: fileName,
    parents: ['appDataFolder'],
    description: `attachment:${storageRef.path}`
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', data instanceof Uint8Array ? new Blob([data as any]) : data);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${driveToken}` },
    body: form
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Drive upload failed: ${err.error?.message || res.statusText}`);
  }

  const fileData = await res.json();
  return { metadata: { fullPath: storageRef.path }, driveId: fileData.id };
};

export const getDownloadURL = async (storageRef: any) => {
  if (!driveToken) throw new Error('No drive token');

  try {
    const fileName = storageRef.path.split('/').pop();
    // Search by name only using double quotes to handle spaces correctly
    const query = `name = "${fileName?.replace(/"/g, '\\"')}"`;

    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(query)}&fields=files(id,description)`, {
      headers: { Authorization: `Bearer ${driveToken}` }
    });

    if (!searchRes.ok) throw new Error('Failed to find file on Drive');
    const searchData = await searchRes.json();

    // Find the specific file that matches our unique path tag in the description
    const targetFile = searchData.files?.find((f: any) => f.description === `attachment:${storageRef.path}`);

    if (!targetFile) {
      throw new Error('File not found on Google Drive');
    }

    const fileId = targetFile.id;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${driveToken}` }
    });

    if (!res.ok) throw new Error('Failed to fetch file content');

    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error generating download URL:', error);
    // Retorna um link de erro ou fallback
    return '#error-fetching-file';
  }
};

export const deleteObject = async (storageRef: any) => {
  if (!driveToken) throw new Error('No drive token');

  try {
    const fileName = storageRef.path.split('/').pop();
    const query = `name = "${fileName?.replace(/"/g, '\\"')}" and description = 'attachment:${storageRef.path}'`;

    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${driveToken}` }
    });

    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${searchData.files[0].id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${driveToken}` }
      });
    }
  } catch (error) {
    console.error('Error deleting file from Drive:', error);
  }
};
