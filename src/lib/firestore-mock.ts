// Mock Firestore implementation using localStorage and generic events to simulate Firebase syncing locally
import { v4 as uuidv4 } from 'uuid';

let driveToken: string | null = null;

export const setDriveToken = (token: string | null) => {
  driveToken = token;
  if (token && !isLoaded) {
    forceSync();
  }
};

export const getFirestore = () => ({});

// Setup mock state
let state: Record<string, any[]> = {
  patients: [],
  sessions: [],
  psychologists: []
};

// Setup internal events for onSnapshot
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

// Collections and Documents
export const collection = (db: any, path: string) => {
  return { type: 'collection', path };
};

export const doc = (db: any, path: string, id?: string) => {
  if (!id) {
    const parts = path.split('/');
    id = parts.pop();
    path = parts.join('/');
  }
  return { type: 'doc', path, id: id || uuidv4() };
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
  constructor(public id: string, private _data: any) {}
  exists() { return !!this._data; }
  data() { return this._data; }
}

export class QuerySnapshot {
  docs: DocSnapshot[];
  constructor(docs: DocSnapshot[]) { this.docs = docs; }
  get size() { return this.docs.length; }
}

const applyConditions = (items: any[], conditions: any[]) => {
  let filtered = [...items];
  for (const cond of conditions) {
    if (cond.type === 'where') {
      filtered = filtered.filter(item => {
        let val = item[cond.field];
        if (val && typeof val === 'object' && val.toDate) val = val.toDate();
        const compareVal = cond.val instanceof Date ? cond.val : cond.val;
        
        let v1 = val instanceof Date ? val.getTime() : val;
        let v2 = compareVal instanceof Date ? compareVal.getTime() : compareVal;
        
        // Handle ISO string comparisons transparently against dates
        if (typeof v1 === 'string' && typeof v2 === 'number' && !isNaN(Date.parse(v1))) {
           v1 = new Date(v1).getTime();
        } else if (typeof v2 === 'string' && typeof v1 === 'number' && !isNaN(Date.parse(v2))) {
           v2 = new Date(v2).getTime();
        }

        if (cond.op === '==') return v1 === v2;
        if (cond.op === 'in') return cond.val.includes(v1);
        if (cond.op === '>=') return v1 >= v2;
        if (cond.op === '<=') return v1 <= v2;
        if (cond.op === '<')  return v1 < v2;
        if (cond.op === '>')  return v1 > v2;
        return true;
      });
    } else if (cond.type === 'orderBy') {
      filtered.sort((a, b) => {
        let v1 = a[cond.field];
        let v2 = b[cond.field];
        if (v1 && v1.toDate) v1 = v1.toDate().getTime();
        if (v2 && v2.toDate) v2 = v2.toDate().getTime();
        v1 = v1 instanceof Date ? v1.getTime() : (typeof v1 === 'string' && !isNaN(Date.parse(v1)) ? new Date(v1).getTime() : v1);
        v2 = v2 instanceof Date ? v2.getTime() : (typeof v2 === 'string' && !isNaN(Date.parse(v2)) ? new Date(v2).getTime() : v2);
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
export const loadFromDrive = async () => {
    const token = driveToken;
    if (!token) {
        // Fallback to local cache if no drive token yet
        const localCache = localStorage.getItem('mock_db_cache');
        if (localCache && !isLoaded) {
            state = JSON.parse(localCache);
            notify();
        }
        return;
    }
    if (isLoaded) return;
    
    try {
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
                  return;
              }
              throw new Error(`Drive download failed: ${dlRes.status}`);
          }

          window.dispatchEvent(new CustomEvent('google-auth-success'));
          const data = await dlRes.json();
          if (data && typeof data === 'object') {
            state = data;
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
      isLoaded = true; // Only mark as loaded if we successfully communicated with drive
    } catch (err) {
      console.error('Failed to load from Drive:', err);
      // Fallback to local cache on general errors
      const localCache = localStorage.getItem('mock_db_cache');
      if (localCache) {
        state = JSON.parse(localCache);
        notify();
      }
    }
};

export const ensureLoaded = () => {
    // If we haven't successfully loaded from Drive (isLoaded is false)
    // and we now have a token, we should probably try again.
    const token = driveToken;
    if (!isLoaded && token && loadPromise) {
        // Reset promise so we can try again with the new token
        loadPromise = null;
    }

    if (!loadPromise) {
        loadPromise = loadFromDrive();
    }
    return loadPromise;
};

export const forceSync = async () => {
    isLoaded = false;
    loadPromise = null; // Clear the promise to force a new execution
    loadPromise = loadFromDrive();
    return loadPromise;
};

let syncTimer: any;
let isSyncing = false;

const saveToDrive = () => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
        const token = driveToken;
        
        // Always backup to localStorage as a safety net
        if (isLoaded) {
            localStorage.setItem('mock_db_cache', JSON.stringify(state));
        }
        
        if (!token || isSyncing || !isLoaded) {
            if (!isLoaded) console.warn('Skipping saveToDrive because state is not fully loaded yet.');
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

export const onSnapshot = (queryObj: any, callback: any) => {
  ensureLoaded().then(() => {
    const handler = () => {
      const collectionData = state[queryObj.path] || [];
      const filtered = queryObj.conditions ? applyConditions(collectionData, queryObj.conditions) : collectionData;
      callback(new QuerySnapshot(filtered.map(item => new DocSnapshot(item.id, item))));
    };
    listeners.add(handler);
    handler(); // initial emit
  });
  
  return () => {
     // For mock, returning undefined/noop is safe. In reality, we'd remove from listeners list.
  };
};

// Mutations
export const addDoc = async (colRef: any, data: any) => {
  if (!state[colRef.path]) state[colRef.path] = [];
  const id = uuidv4();
  
  // Format timestamps
  const processedData = { ...data };
  for (let key in processedData) {
    if (processedData[key] && processedData[key].isServerTimestamp) {
      processedData[key] = new Date().toISOString();
    }
  }

  state[colRef.path].push({ id, ...processedData });
  saveToDrive();
  notify();
  return { id };
};

export const setDoc = async (docRef: any, data: any) => {
  if (!state[docRef.path]) state[docRef.path] = [];
  const idx = state[docRef.path].findIndex(i => i.id === docRef.id);
  if (idx >= 0) {
    state[docRef.path][idx] = { id: docRef.id, ...data };
  } else {
    state[docRef.path].push({ id: docRef.id, ...data });
  }
  saveToDrive();
  notify();
};

export const updateDoc = async (docRef: any, data: any) => {
  if (!state[docRef.path]) return;
  const idx = state[docRef.path].findIndex(i => i.id === docRef.id);
  if (idx >= 0) {
    state[docRef.path][idx] = { ...state[docRef.path][idx], ...data };
    saveToDrive();
    notify();
  }
};

export const deleteDoc = async (docRef: any) => {
  if (!state[docRef.path]) return;
  state[docRef.path] = state[docRef.path].filter(i => i.id !== docRef.id);
  saveToDrive();
  notify();
};

export const serverTimestamp = () => ({ isServerTimestamp: true });
