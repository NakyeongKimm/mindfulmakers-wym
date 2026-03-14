// nativeBridge.js
// Wraps the WKWebView JS bridge (WebBridge.swift).
// In the browser (dev/web), all calls return null/[] so mock data keeps working.

export const isNative = () =>
  typeof window !== "undefined" &&
  typeof window.webkit?.messageHandlers?.wym !== "undefined";

// Send a request to the native layer.
function postToNative(type, extra = {}) {
  if (!isNative()) return;
  window.webkit.messageHandlers.wym.postMessage({ type, ...extra });
}

// Register a listener for native → JS messages.
// Native calls: window.WYMBridge.onMessage({ type, payload })
// Returns an unsubscribe function.
export function onNativeMessage(handler) {
  if (!isNative()) return () => {};
  if (!window.WYMBridge) window.WYMBridge = {};
  window.WYMBridge.onMessage = handler;
  return () => { window.WYMBridge.onMessage = null; };
}

// ── initialData ───────────────────────────────────────────────────────────────
// The main hook. Asks Swift to run InsightEngine and return:
//   { screenTime: {...}, insights: [...] }
// Resolves with that payload, or null if not on native.
//
// Shape of screenTime matches mockScreenTime in App.jsx.
// Shape of insights matches mockInsights in App.jsx.

export function fetchInitialData() {
  return new Promise((resolve) => {
    if (!isNative()) return resolve(null);

    const unsub = onNativeMessage((msg) => {
      if (msg.type === "initialData") {
        unsub();
        resolve(msg.payload);
      }
    });
    postToNative("fetchInitialData");

    setTimeout(() => { unsub(); resolve(null); }, 15_000);
  });
}

// ── mapSnapshot ───────────────────────────────────────────────────────────────
// Request a MapKit route-preview PNG for a specific insight (by id).
// Resolves with a base64 data URI string, or null if not available.

export function fetchMapSnapshot(insightId) {
  return new Promise((resolve) => {
    if (!isNative()) return resolve(null);

    const unsub = onNativeMessage((msg) => {
      if (msg.type === "mapSnapshot" && msg.payload?.insightId === insightId) {
        unsub();
        const uri = `data:image/png;base64,${msg.payload.base64}`;
        resolve(uri);
      }
    });
    postToNative("fetchMapSnapshot", { insightId });

    setTimeout(() => { unsub(); resolve(null); }, 10_000);
  });
}

// ── fetchVisits ───────────────────────────────────────────────────────────────
// Resolves with LocationSession[] or [] if not on native.

export function fetchVisits() {
  return new Promise((resolve) => {
    if (!isNative()) return resolve([]);

    const unsub = onNativeMessage((msg) => {
      if (msg.type === "visitsUpdate") {
        unsub();
        resolve(msg.payload ?? []);
      }
    });
    postToNative("fetchVisits");

    setTimeout(() => { unsub(); resolve([]); }, 5_000);
  });
}

// ── fetchNativeLocation (one-shot) ────────────────────────────────────────────
// Resolves with the current LocationSession or null.

export function fetchNativeLocation() {
  return new Promise((resolve) => {
    if (!isNative()) return resolve(null);

    const unsub = onNativeMessage((msg) => {
      if (msg.type === "initialData") {
        unsub();
        // location comes through as part of the next insight push
        resolve(null);
      }
    });
    postToNative("fetchLocation");

    setTimeout(() => { unsub(); resolve(null); }, 10_000);
  });
}

// ── fetchScreenTimeHits (legacy — kept for SettingsScreen) ────────────────────

export function fetchScreenTimeHits() {
  return Promise.resolve([]);
}
