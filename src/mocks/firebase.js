// Mock firebase.js for E2E tests — replaces src/firebase.js via Vite alias
export const auth = { currentUser: null };
export const provider = {};
export const db = {};
export const storage = {};
export const functions = {};
export const getMessagingInstance = async () => null;
