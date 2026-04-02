// Mock firebase/firestore for E2E tests
// Supports window.__testFirestoreData for injecting team/user data in tests.
// Keys are Firestore paths (e.g. "users/test-uid-123", "teams/team-1/tasks").
// Doc paths map to plain objects; collection paths map to arrays of objects.
export function initializeFirestore() { return {}; }
export function persistentLocalCache() { return {}; }
export function getFirestore() { return {}; }

function getTestData() {
  return (typeof window !== 'undefined' && window.__testFirestoreData) || {};
}

export function doc(db, ...segments) {
  const path = segments.join('/');
  return { __path: path, __type: 'doc', id: segments[segments.length - 1] || 'mock-doc-id' };
}

export function collection(db, ...segments) {
  const path = segments.join('/');
  return { __path: path, __type: 'collection' };
}

// Pass the ref through so path information is preserved.
export function query(ref) { return ref; }
export function where() { return {}; }

export function setDoc() { return Promise.resolve(); }

export function getDoc(ref) {
  const testData = getTestData();
  const path = ref?.__path || '';
  const data = testData[path];
  if (data !== undefined && !Array.isArray(data)) {
    return Promise.resolve({ exists: () => true, data: () => data, id: ref.id || 'mock-doc-id' });
  }
  return Promise.resolve({ exists: () => false, data: () => ({}) });
}

export function updateDoc() { return Promise.resolve(); }
export function addDoc() {
  return Promise.resolve({ id: 'mock-added-doc-id' });
}
export function deleteDoc() { return Promise.resolve(); }
export function getDocs(ref) {
  const testData = getTestData();
  const path = ref?.__path || '';
  const data = testData[path];
  if (Array.isArray(data)) {
    const docs = data.map((d, i) => ({ id: d.id || `mock-id-${i}`, exists: () => true, data: () => d }));
    return Promise.resolve({ forEach: fn => docs.forEach(fn), docs });
  }
  return Promise.resolve({ forEach: () => {}, docs: [] });
}

export function writeBatch() {
  return {
    set: () => {},
    update: () => {},
    delete: () => {},
    commit: () => Promise.resolve(),
  };
}

export function onSnapshot(ref, callback) {
  const path = ref?.__path || '';
  const testData = getTestData();
  const data = testData[path];
  const docId = ref?.id || path.split('/').pop() || 'mock-doc-id';

  setTimeout(() => {
    if (data === undefined) {
      // No test data for this path → empty snapshot
      callback({ exists: () => false, data: () => ({}), id: docId, docs: [], forEach: () => {} });
    } else if (Array.isArray(data)) {
      // Collection snapshot
      const docs = data.map((d, i) => ({
        id: d.id || `mock-id-${i}`,
        exists: () => true,
        data: () => d,
      }));
      callback({ exists: () => false, data: () => ({}), id: docId, docs, forEach: fn => docs.forEach(fn) });
    } else {
      // Document snapshot
      callback({ exists: () => true, data: () => data, id: docId, docs: [], forEach: () => {} });
    }
  }, 0);

  return () => {};
}

export function arrayUnion(...items) { return items; }
export function arrayRemove(...items) { return items; }
export function serverTimestamp() { return new Date(); }
