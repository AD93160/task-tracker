// Mock firebase/storage for E2E tests
export function ref() { return {}; }
export function uploadBytes() { return Promise.resolve(); }
export function getDownloadURL() { return Promise.resolve("https://mock-storage-url/file.jpg"); }
export function deleteObject() { return Promise.resolve(); }
