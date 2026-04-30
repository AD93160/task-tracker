// Mock firebase/functions for E2E tests
export function getFunctions() { return {}; }
export function httpsCallable(_functions, name) {
  return async (_data) => {
    // Mock : simule un envoi réussi sans appel réseau
    if (name === "sendInviteEmail") return { data: { success: true } };
    return { data: {} };
  };
}
