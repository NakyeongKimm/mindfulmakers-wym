// ============================================================
// WYM: iOS Shortcuts Export Adapter
// ============================================================
// Transforms the JSON produced by the WYM iOS Shortcut into
// the shape that dataAdapter.js expects.
//
// The Shortcut saves a file to iCloud Drive / Files app.
// The user taps "Import" in the web app to load it.
//
// Expected input shape (from Shortcut):
// {
//   "exportedAt": "2026-03-14T15:54:00",
//   "user": { "name": "Naky", "location": "Cambridge, MA" },
//   "screenTime": {
//     "weekStart": "2026-03-09",
//     "weekEnd": "2026-03-14",
//     "dailyTotals": [390, 510, 440, 520, 475, 500, 460],   // Mon–Sun, minutes
//     "byApp": [
//       { "app": "Instagram", "minutes": 54, "opens": 18 },
//       ...
//     ]
//   },
//   "location": {
//     "lat": 42.3601,
//     "lng": -71.0942,
//     "label": "Cambridge, MA",
//     "timestamp": "2026-03-14T15:54:00"
//   },
//   "weather": {
//     "tempF": 54,
//     "condition": "clear",
//     "icon": "☀️"
//   }
// }
// ============================================================

import * as mock from "./mockData.js";

const STORAGE_KEY = "wym_shortcuts_data";

// ── Save / Load from localStorage ─────────────────────────────
export function saveImportedData(json) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(json));
}

export function loadImportedData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearImportedData() {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasImportedData() {
  return !!localStorage.getItem(STORAGE_KEY);
}

// ── Helpers ────────────────────────────────────────────────────
function avg(arr) {
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

// Guess intentionality score by app name (used when Shortcut doesn't provide it)
function guessIntentional(appName) {
  const low = ["instagram", "tiktok", "reddit", "twitter", "x", "snapchat", "facebook"];
  const high = ["imessage", "messages", "gmail", "mail", "calendar", "maps", "facetime", "phone"];
  const name = appName.toLowerCase();
  if (low.some((a) => name.includes(a))) return 0.3;
  if (high.some((a) => name.includes(a))) return 0.9;
  return 0.6;
}

// Category mapping by app name
function guessCategory(appName) {
  const name = appName.toLowerCase();
  if (["instagram", "tiktok", "snapchat", "facebook", "twitter", "x", "reddit"].some(a => name.includes(a)))
    return { category: "Social", color: "#7F77DD", icon: "💬" };
  if (["youtube", "netflix", "hulu", "spotify", "apple tv", "disney"].some(a => name.includes(a)))
    return { category: "Entertainment", color: "#EF9F27", icon: "🎬" };
  if (["gmail", "mail", "calendar", "notion", "docs", "sheets", "slack", "teams"].some(a => name.includes(a)))
    return { category: "Productivity", color: "#1D9E75", icon: "📋" };
  if (["news", "cnn", "bbc", "nyt", "apple news"].some(a => name.includes(a)))
    return { category: "News", color: "#D85A30", icon: "📰" };
  if (["amazon", "ebay", "etsy", "shop", "shopping"].some(a => name.includes(a)))
    return { category: "Shopping", color: "#378ADD", icon: "🛍️" };
  return { category: "Other", color: "#888780", icon: "📱" };
}

// ── Transform Shortcut JSON → app data shape ──────────────────
export function transform(raw) {
  const st = raw.screenTime ?? {};
  const dailyTotals = st.dailyTotals ?? mock.screenTime.dailyTotals;
  const dailyAverageMinutes = avg(dailyTotals);

  const byApp = (st.byApp ?? mock.screenTime.byApp).map((a) => ({
    app: a.app,
    minutes: a.minutes,
    opens: a.opens ?? Math.round(a.minutes / 3),
    avgSession: a.avgSession ?? Math.round(a.minutes / (a.opens ?? Math.round(a.minutes / 3))),
    intentional: a.intentional ?? guessIntentional(a.app),
  }));

  // Derive byCategory from byApp
  const catMap = {};
  for (const a of byApp) {
    const cat = guessCategory(a.app);
    if (!catMap[cat.category]) catMap[cat.category] = { ...cat, minutes: 0 };
    catMap[cat.category].minutes += a.minutes;
  }
  const byCategory = Object.values(catMap).sort((a, b) => b.minutes - a.minutes);

  // Location today
  const loc = raw.location;
  const locationHistory = loc
    ? [
        {
          id: "loc_live",
          date: loc.timestamp?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
          time: loc.timestamp?.slice(11, 16) ?? "00:00",
          label: loc.label ?? "Current location",
          startCoords: { lat: loc.lat, lng: loc.lng },
          endCoords: { lat: loc.lat, lng: loc.lng },
          durationMinutes: 0,
          type: "current",
          phoneScreenOnMinutes: 0,
          messagesSent: 0,
          messagingThreads: 0,
          nearbyPOIs: [],
        },
      ]
    : mock.locationHistory;

  // Weather today
  const wx = raw.weather;
  const weatherHistory = wx
    ? [
        {
          date: raw.exportedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
          time: raw.exportedAt?.slice(11, 16) ?? "00:00",
          condition: wx.condition ?? "clear",
          label: wx.label ?? wx.condition ?? "current conditions",
          tempF: wx.tempF ?? 0,
          windMph: wx.windMph ?? 0,
          goldenHour: false,
          notableCondition: wx.label ?? "",
          icon: wx.icon ?? "🌤️",
        },
      ]
    : mock.weatherHistory;

  // Build a real-data insight for today's top app
  const topApp = byApp[0];
  const liveInsights = topApp
    ? [
        {
          id: "ins_live_001",
          type: "habit_loop",
          severity: topApp.intentional < 0.5 ? "high" : "medium",
          icon: "📱",
          iconBg: "#EEEDFE",
          title: `${topApp.app}: ${Math.floor(topApp.minutes / 60)}h ${topApp.minutes % 60}m today`,
          subtitle: `${topApp.opens} opens · avg ${topApp.avgSession} min/session`,
          detail: [
            `${Math.round((1 - topApp.intentional) * 100)}% of opens were habitual`,
            `Average session: ${topApp.avgSession} min`,
            `Total today: ${topApp.minutes} min`,
          ],
          tags: [`${topApp.opens} opens`, `${topApp.avgSession} min avg`, "live data"],
          locationId: null,
          weatherDate: null,
          mapRoute: null,
          barValue: Math.min(100, Math.round((topApp.minutes / dailyAverageMinutes) * 100)),
          barColor: "#7F77DD",
          barLabel: `${topApp.minutes} min / day`,
          action: {
            label: "Help me be more intentional",
            prompt: `I'm spending ${topApp.minutes} min/day on ${topApp.app}. Help me use it more intentionally.`,
          },
        },
      ]
    : [];

  return {
    user: {
      name: raw.user?.name ?? mock.user.name,
      location: raw.user?.location ?? loc?.label ?? mock.user.location,
      weekStart: st.weekStart ?? mock.user.weekStart,
      weekEnd: st.weekEnd ?? mock.user.weekEnd,
    },
    screenTime: {
      dailyAverageMinutes,
      dailyTotals,
      dailyLabels: mock.screenTime.dailyLabels,
      prevWeekTotals: st.prevWeekTotals ?? mock.screenTime.prevWeekTotals,
      byCategory,
      byApp,
      phoneFreeMetrics: st.phoneFreeMetrics ?? mock.screenTime.phoneFreeMetrics,
    },
    notifications: mock.notifications,
    locationHistory,
    weatherHistory,
    insights: [...liveInsights, ...mock.insights.filter((i) => i.id !== "ins_live_001")],
    rules: mock.rules,
    weeklySummary: {
      avgDailyScreenMinutes: dailyAverageMinutes,
      totalIgnoredNotifications: mock.notifications.totalIgnored,
      missedMomentsCount: liveInsights.filter((i) => i.type === "missed_moment").length + mock.insights.filter((i) => i.type === "missed_moment").length,
      winsCount: mock.insights.filter((i) => i.type === "win").length,
    },
  };
}
