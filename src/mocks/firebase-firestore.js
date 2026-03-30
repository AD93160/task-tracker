// Mock firebase/firestore for E2E tests
export function initializeFirestore() { return {}; }
export function persistentLocalCache() { return {}; }
export function getFirestore() { return {}; }

export function doc() { return { id: 'mock-doc-id', path: 'mock/path' }; }
export function collection() { return {}; }
export function query() { return {}; }
export function where() { return {}; }

export function setDoc() { return Promise.resolve(); }
export function getDoc() {
  return Promise.resolve({ exists: () => false, data: () => ({}) });
}
export function updateDoc() { return Promise.resolve(); }
export function addDoc() {
  return Promise.resolve({ id: 'mock-added-doc-id' });
}
export function deleteDoc() { return Promise.resolve(); }
export function getDocs() {
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
  // Return empty snapshot immediately — app loads from localStorage instead
  setTimeout(() => callback({ exists: () => false, data: () => ({}) }), 0);
  return () => {};
}

export function arrayUnion(...items) { return items; }
export function arrayRemove(...items) { return items; }
export function serverTimestamp() { return new Date(); }
