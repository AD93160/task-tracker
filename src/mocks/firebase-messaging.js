// Mock firebase/messaging for E2E tests
export function getMessaging() { return null; }
export function isSupported() { return Promise.resolve(false); }
export function getToken() { return Promise.resolve(null); }
export function onMessage() { return () => {}; }
