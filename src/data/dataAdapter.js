// ============================================================
// WYM: Data Adapter
// ============================================================
// This is the ONLY file the app imports data from.
// Priority:
//   1. User-imported Shortcuts JSON (stored in localStorage)
//   2. Mock data (fallback for demo / development)
// ============================================================

import * as mock from "./mockData.js";
import { loadImportedData, transform, hasImportedData } from "./shortcutsExport.js";

function getSource() {
  if (hasImportedData()) {
    const raw = loadImportedData();
    return transform(raw);
  }
  return mock;
}

// Re-read on every call so imports take effect immediately without refresh
const src = () => getSource();

// ── User ─────────────────────────────────────────────────────
export function getUser() {
  return src().user;
}

// ── Weekly Summary ───────────────────────────────────────────
export function getWeeklySummary() {
  const s = src();
  return {
    avgDailyScreenMinutes: s.screenTime.avgDailyScreenMinutes ?? s.screenTime.dailyAverageMinutes,
    avgDailyScreenLabel: formatMinutes(s.screenTime.avgDailyScreenMinutes ?? s.screenTime.dailyAverageMinutes),
    totalIgnoredNotifications: s.notifications?.totalIgnored ?? s.weeklySummary?.totalIgnoredNotifications,
    missedMomentsCount: s.weeklySummary?.missedMomentsCount ?? s.insights?.filter((i) => i.type === "missed_moment").length,
    winsCount: s.weeklySummary?.winsCount ?? s.insights?.filter((i) => i.type === "win").length,
    weekRange: `${s.user.weekStart} → ${s.user.weekEnd}`,
  };
}

// ── Screen Time ──────────────────────────────────────────────
export function getScreenTimeByDay() {
  const s = src();
  return s.screenTime.dailyLabels.map((label, i) => ({
    label,
    minutes: s.screenTime.dailyTotals[i],
    prevMinutes: s.screenTime.prevWeekTotals[i],
    hours: (s.screenTime.dailyTotals[i] / 60).toFixed(1),
  }));
}

export function getScreenTimeByCategory() {
  const s = src();
  const dailyAvg = s.screenTime.dailyAverageMinutes ?? s.screenTime.avgDailyScreenMinutes;
  return s.screenTime.byCategory.map((c) => ({
    ...c,
    pct: Math.round((c.minutes / dailyAvg) * 100),
    label: formatMinutes(c.minutes),
  }));
}

export function getScreenTimeByApp() {
  const s = src();
  return s.screenTime.byApp.map((a) => ({
    ...a,
    intentionalPct: Math.round(a.intentional * 100),
    habitualPct: Math.round((1 - a.intentional) * 100),
    label: formatMinutes(a.minutes),
  }));
}

export function getPhoneFreeMetrics() {
  return src().screenTime.phoneFreeMetrics;
}

// ── Notifications ─────────────────────────────────────────────
export function getNotifications() {
  return src().notifications.byApp.map((n) => ({
    ...n,
    openRate: Math.round((n.opened / n.delivered) * 100),
    ignored: n.delivered - n.opened,
  }));
}

export function getNotificationSummary() {
  const n = src().notifications;
  return {
    totalIgnored: n.totalIgnored,
    totalDelivered: n.totalDelivered,
    openRate: Math.round((1 - n.totalIgnored / n.totalDelivered) * 100),
  };
}

// ── Location ─────────────────────────────────────────────────
export function getLocationHistory() {
  return src().locationHistory;
}

// ── Weather ───────────────────────────────────────────────────
export function getWeatherForDate(date) {
  return src().weatherHistory.find((w) => w.date === date) || null;
}

// ── Insights ─────────────────────────────────────────────────
export function getAllInsights() {
  return src().insights;
}

export function getInsightsByType(type) {
  return src().insights.filter((i) => i.type === type);
}

export function getMissedMoments() {
  return src().insights.filter((i) => i.type === "missed_moment");
}

export function getWins() {
  return src().insights.filter((i) => i.type === "win");
}

// ── Rules ─────────────────────────────────────────────────────
export function getRules() {
  return src().rules;
}

// ── Yesterday stats (derived for TodayScreen) ─────────────────
export function getYesterdayStats() {
  const s = src();
  const totals = s.screenTime.dailyTotals ?? [];
  const lastTotal = totals[totals.length - 1] ?? 372;
  const byApp = s.screenTime.byApp ?? [];

  const mindlessMinutes = byApp
    .filter(a => (a.intentional ?? 0.6) < 0.5)
    .reduce((sum, a) => sum + a.minutes, 0);
  const totalOpens = byApp.reduce((sum, a) => sum + (a.opens ?? 0), 0);
  const topApp = byApp[0];

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return {
    date: dateStr,
    digitalPercent: Math.min(99, Math.round((lastTotal / 960) * 100)) || 84,
    phonePickups: totalOpens || 142,
    totalMinutes: lastTotal,
    mindlessMinutes: mindlessMinutes || Math.round(lastTotal * 0.69),
    pickupContext: topApp ? `mostly using ${topApp.app}` : "seeking distraction",
  };
}

// ── Helpers ───────────────────────────────────────────────────
export function formatMinutes(mins) {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export { hasImportedData };
export { saveImportedData, clearImportedData } from "./shortcutsExport.js";
