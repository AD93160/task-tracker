// Mock firebase/auth for E2E tests
const mockUser = {
  uid: 'test-uid-123',
  email: 'test@test.com',
  displayName: 'Test User',
  emailVerified: true,
  photoURL: null,
};

export function onAuthStateChanged(auth, callback) {
  // Immediately resolve with mock user (simulates logged-in state)
  setTimeout(() => callback(mockUser), 0);
  return () => {};
}

export function signInWithPopup() {
  return Promise.resolve({ user: mockUser });
}

export function signOut() {
  return Promise.resolve();
}

export function createUserWithEmailAndPassword() {
  return Promise.resolve({ user: mockUser });
}

export function signInWithEmailAndPassword() {
  return Promise.resolve({ user: mockUser });
}

export function sendEmailVerification() {
  return Promise.resolve();
}

export class GoogleAuthProvider {}

export function getAuth() {
  return {};
}
