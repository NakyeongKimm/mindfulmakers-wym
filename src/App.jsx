// WYM: What You Missed — Full Prototype App
// All data flows from mockData.js via dataAdapter.js
// To swap data: edit mockData.js or point dataAdapter.js to a new source

import { useState, useMemo } from "react";
import {
  saveImportedData, clearImportedData, hasImportedData,
  getYesterdayStats, getScreenTimeByDay, getScreenTimeByCategory, getScreenTimeByApp,
} from "./data/dataAdapter";

// ── Inline mock data (mirrors mockData.js for single-file artifact) ──────────
// eslint-disable-next-line no-unused-vars
const mockUser = { name: "Naky", location: "Cambridge, MA", weekStart: "Mar 9", weekEnd: "Mar 14, 2026" };


const mockNotifications = {
  totalIgnored: 312, totalDelivered: 489,
  noiseByHour: [30, 20, 85, 100, 40, 25, 15],
  noiseDesc: "Your focus was interrupted 28 times by non-essential notifications between 2 PM and 4 PM.",
  byApp: [
    { app: "Amazon", icon: "📦", color: "#FAEEDA", textColor: "#854F0B", delivered: 94, opened: 6, types: ["shipping updates", "promo deals"], recommendation: "turn off" },
    { app: "News apps", icon: "📰", color: "#FCEBEB", textColor: "#A32D2D", delivered: 87, opened: 4, types: ["breaking alerts", "trending"], recommendation: "turn off" },
    { app: "Shopping (4)", icon: "🛍️", color: "#E6F1FB", textColor: "#185FA5", delivered: 131, opened: 11, types: ["flash sales", "reminders"], recommendation: "turn off" },
    { app: "iMessage", icon: "💬", color: "#E1F5EE", textColor: "#0F6E56", delivered: 98, opened: 95, types: ["messages"], recommendation: "keep" },
    { app: "Gmail", icon: "✉️", color: "#EEEDFE", textColor: "#3C3489", delivered: 54, opened: 41, types: ["emails"], recommendation: "keep" },
    { app: "Calendar", icon: "📅", color: "#EAF3DE", textColor: "#27500A", delivered: 25, opened: 24, types: ["event reminders"], recommendation: "keep" },
  ],
};

const mockInsights = [
  {
    id: "ins_001", type: "missed_moment", severity: "high", icon: "🌊", iconBg: "#E1F5EE",
    title: "You walked along the Charles River for 22 min while texting",
    subtitle: "Today, 8:14 AM · Cambridge, MA",
    detail: ["You sent 47 messages to 3 threads during this walk", "Phone screen was on for 19 of 22 minutes", "Weather: sunny 54°F — perfect walking conditions"],
    tags: ["sunny 54°F", "river view", "low foot traffic"],
    hasMap: true,
    action: { label: "Suggest how to be more present", prompt: "Suggest ways I can be more present when walking along the Charles River" },
  },
  {
    id: "ins_002", type: "missed_moment", severity: "high", icon: "🌅", iconBg: "#FAEEDA",
    title: "Perfect sunrise while you were scrolling Instagram",
    subtitle: "Yesterday, 6:48 AM · 23 min session",
    detail: ["Clear skies, golden hour — optimal visibility", "East-facing windows had full sun at your location", "Instagram session ran 6:45–7:08 AM, overlapping sunrise exactly"],
    tags: ["golden hour", "clear skies", "46°F"],
    hasMap: false,
    action: { label: "Help me fix my mornings", prompt: "How can I build a morning routine that includes less phone time?" },
  },
  {
    id: "ins_003", type: "notification_noise", severity: "medium", icon: "🔕", iconBg: "#FCEBEB",
    title: "312 notifications you never opened this week",
    subtitle: "Across 6 apps · possibly unnecessary distractions",
    detail: ["Amazon: 94 notifications, only 6 opened (6% open rate)", "News apps: 87 notifications, 4 opened (5% open rate)", "Shopping apps: 131 notifications, 11 opened (8% open rate)"],
    tags: ["94 Amazon", "87 News", "131 Shopping"],
    hasMap: false,
    action: { label: "Help me cut the noise", prompt: "Which of these notifications should I turn off to reduce distractions?" },
  },
  {
    id: "ins_004", type: "habit_loop", severity: "medium", icon: "💬", iconBg: "#EEEDFE",
    title: "Reddit: 1h 20m daily — you never set out to open it",
    subtitle: "Mostly opened by habit, not intention",
    detail: ["73% of opens happened within 2 min of unlocking your phone", "Average session: 14 minutes. Intended: 1–2 min.", "23 opens per day across the week"],
    tags: ["23 opens/day", "14 min avg session", "habit loop"],
    hasMap: false, barValue: 67, barColor: "#7F77DD", barLabel: "80 min / day",
    action: { label: "Help me be intentional", prompt: "Suggest a realistic plan to reduce mindless Reddit usage" },
  },
  {
    id: "ins_005", type: "win", severity: "low", icon: "✅", iconBg: "#E1F5EE",
    title: "You had 3 phone-free meals this week",
    subtitle: "Up from 1 last week · keep it going",
    detail: ["Tue dinner, Thu lunch, Sat brunch — all 30+ min phone-free", "That's 3× improvement from last week"],
    tags: ["Tue dinner", "Thu lunch", "Sat brunch"],
    hasMap: false, barValue: 14, barColor: "#1D9E75", barLabel: "3 of 21 meals",
    action: { label: "Build on this habit", prompt: "How do I build a habit of more phone-free meals?" },
    winDesc: "You left your phone in the other room for 35 minutes while reading. Your heart rate stayed at a steady 62bpm.",
  },
  {
    id: "ins_006", type: "caught_in_loop", icon: "⏱️", iconBg: "#FEF2F2",
    title: "Lunch Break Sinkhole",
    desc: 'Spent 45 minutes on TikTok while eating. Reported feeling "drained" afterward.',
  },
  {
    id: "ins_007", type: "caught_in_loop", icon: "✉️", iconBg: "#EFF6FF",
    title: "Email Reflex",
    desc: "Checked Outlook 12 times between 7 PM and 9 PM without responding to anything.",
  },
];

const mockRules = [
  { id: "rule_001", name: "River walk DND", description: "Near water + good weather → enable Do Not Disturb", trigger: "location:water AND weather:clear", action: "enable_dnd", enabled: true, icon: "🌊" },
  { id: "rule_002", name: "Morning no-scroll", description: "Block social apps before 8 AM", trigger: "time:before_8am", action: "block_apps:social", enabled: true, icon: "🌅" },
  { id: "rule_003", name: "Meal time focus", description: "Limit notifications during meal times", trigger: "time:meal_window", action: "allow_only:calls,messages", enabled: false, icon: "🍽️" },
  { id: "rule_004", name: "Walk mode", description: "Detect walking pace → silence non-urgent apps", trigger: "motion:walking", action: "silence_apps:social,news", enabled: false, icon: "🚶" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtMin(m) {
  const h = Math.floor(m / 60), min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SeverityPill({ severity }) {
  const map = {
    high: { label: "big miss", bg: "#FCEBEB", color: "#A32D2D" },
    medium: { label: "worth reviewing", bg: "#FAEEDA", color: "#854F0B" },
    low: { label: "nice one", bg: "#EAF3DE", color: "#3B6D11" },
  };
  const s = map[severity];
  return (
    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, fontWeight: 500, flexShrink: 0, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function MapPreview() {
  return (
    <div style={{ marginTop: 10, borderRadius: 8, border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden", background: "#D4F0E8", height: 96 }}>
      <svg width="100%" height="96" viewBox="0 0 360 96" xmlns="http://www.w3.org/2000/svg">
        <rect width="360" height="96" fill="#D4F0E8"/>
        <path d="M 20 68 Q 60 38 100 63 Q 150 83 200 58 Q 250 33 300 53 Q 330 63 350 48" stroke="#5DCAA5" strokeWidth="12" fill="none" strokeLinecap="round" opacity="0.4"/>
        <path d="M 20 68 Q 60 38 100 63 Q 150 83 200 58 Q 250 33 300 53 Q 330 63 350 48" stroke="#0F6E56" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="5,4"/>
        <circle cx="28" cy="68" r="5" fill="#1D9E75"/>
        <circle cx="342" cy="50" r="5" fill="#A32D2D"/>
        <text x="36" y="64" fontSize="9" fill="#085041" fontFamily="sans-serif">start</text>
        <text x="314" y="46" fontSize="9" fill="#A32D2D" fontFamily="sans-serif">end</text>
        <text x="130" y="30" fontSize="9" fill="#085041" fontFamily="sans-serif" fontWeight="500">Charles River Esplanade</text>
      </svg>
    </div>
  );
}

function InsightCard({ insight }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(!open)} style={{ marginBottom: 10, background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, overflow: "hidden", cursor: "pointer", transition: "border-color 0.15s" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 14px" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: insight.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
          {insight.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", lineHeight: 1.4 }}>{insight.title}</div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 3 }}>{insight.subtitle}</div>
        </div>
        <SeverityPill severity={insight.severity} />
      </div>
      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
          <div style={{ paddingTop: 12 }}>
            {insight.detail.map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 6, lineHeight: 1.4 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-border-secondary)", flexShrink: 0, marginTop: 5 }}/>
                <span>{d}</span>
              </div>
            ))}
            {insight.hasMap && <MapPreview />}
            {insight.tags && (
              <div style={{ marginTop: 8 }}>
                {insight.tags.map((t, i) => (
                  <span key={i} style={{ fontSize: 11, color: "#3B6D11", background: "#EAF3DE", borderRadius: 6, padding: "2px 7px", border: "0.5px solid #C0DD97", display: "inline-block", marginTop: 4, marginRight: 4 }}>{t}</span>
                ))}
              </div>
            )}
            {insight.barValue !== undefined && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>
                  <span>usage</span><span>{insight.barLabel}</span>
                </div>
                <div style={{ height: 6, background: "var(--color-background-secondary)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${insight.barValue}%`, background: insight.barColor, borderRadius: 4, transition: "width 0.5s" }}/>
                </div>
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); alert(`This would open: "${insight.action.prompt}"`); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 13, fontWeight: 500, color: "#1D9E75", background: "#E1F5EE", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}
            >
              {insight.action.label} ↗
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Screens ──────────────────────────────────────────────────────────────────

function TodayScreen({ data }) {
  const { yday, byApp } = data;
  // For "caught in the loop", prefer imported app data; fall back to mock
  const loopItems = byApp.length
    ? byApp.slice(0, 2).map((a, i) => ({
        id: `live_loop_${i}`,
        type: "caught_in_loop",
        icon: ["📱", "⏱️"][i] || "📱",
        iconBg: ["#EEEDFE", "#FEF2F2"][i] || "#EEEDFE",
        title: `${a.app}: ${a.label} today`,
        desc: `${a.opens} opens · ${Math.round((1 - (a.intentional ?? 0.5)) * 100)}% habitual`,
      }))
    : mockInsights.filter(i => i.type === "caught_in_loop");
  const hero = mockInsights.find(i => i.id === "ins_002");
  const win = mockInsights.find(i => i.type === "win");

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 20px 8px" }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.5, color: "var(--color-text-primary)" }}>Yesterday</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>{yday.date}</div>
        </div>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👤</div>
      </div>

      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* What You Missed */}
        <div style={{ borderRadius: 24, background: "#FFFBEB", border: "1px solid #FDE68A", padding: "20px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -16, right: -16, width: 96, height: 96, borderRadius: "50%", background: "#FDE68A", opacity: 0.3, filter: "blur(16px)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>{hero.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#B45309" }}>What You Missed</span>
          </div>
          <p style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.5, color: "#1C1917", margin: 0 }}>
            {hero.title}
          </p>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6, color: "#78716C" }}>
            <span style={{ fontSize: 13 }}>🕐</span>
            <span style={{ fontSize: 12 }}>{hero.subtitle}</span>
          </div>
        </div>

        {/* Summary */}
        <div style={{ borderRadius: 24, background: "#134E4A", color: "white", padding: "20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5EEAD4", marginBottom: 10 }}>Summary</div>
          <p style={{ fontSize: 18, fontWeight: 300, lineHeight: 1.4, margin: 0 }}>
            Yesterday was <strong style={{ fontWeight: 600, color: "#CCFBF1" }}>{yday.digitalPercent}% digital</strong>. You picked up your phone {yday.phonePickups} times, {yday.pickupContext}.
          </p>
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #1F6463", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 20 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5EEAD4" }}>Total Screen</div>
                <div style={{ fontSize: 20, fontWeight: 600, marginTop: 2 }}>{fmtMin(yday.totalMinutes)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5EEAD4" }}>Mindless</div>
                <div style={{ fontSize: 20, fontWeight: 600, marginTop: 2 }}>{fmtMin(yday.mindlessMinutes)}</div>
              </div>
            </div>
            <span style={{ fontSize: 22 }}>📈</span>
          </div>
        </div>

        {/* Caught in the Loop */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A8A29E", marginBottom: 12, paddingLeft: 4 }}>Caught in the Loop</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loopItems.map((item) => (
              <div key={item.id} style={{ background: "white", borderRadius: 18, border: "1px solid #F5F5F4", padding: "14px 16px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: item.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#1C1917" }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: "#78716C", marginTop: 3, lineHeight: 1.4 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notification Noise */}
        <div style={{ borderRadius: 24, background: "#F5F5F4", padding: "20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#78716C", marginBottom: 16 }}>Notification Noise</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80, marginBottom: 14 }}>
            {mockNotifications.noiseByHour.map((h, i) => (
              <div key={i} style={{ flex: 1, height: `${h}%`, background: (i === 2 || i === 3) ? "#14B8A6" : "#D6D3D1", borderRadius: "3px 3px 0 0" }} />
            ))}
          </div>
          <p style={{ fontSize: 13, color: "#57534E", margin: 0, lineHeight: 1.5 }}>{mockNotifications.noiseDesc}</p>
        </div>

        {/* A Quiet Win */}
        <div style={{ borderRadius: 24, background: "#F0FDFA", border: "1px solid #CCFBF1", padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: "#0F766E" }}>
            <span style={{ fontSize: 16 }}>{win.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>A Quiet Win</span>
          </div>
          <p style={{ fontSize: 15, fontWeight: 500, color: "#1C1917", margin: 0, lineHeight: 1.5 }}>
            {win.winDesc}
          </p>
        </div>
      </div>
    </div>
  );
}

function TrendsScreen({ data }) {
  const days = data.byDay.map(d => d.label);
  const vals = data.byDay.map(d => d.minutes);
  const prev = data.byDay.map(d => d.prevMinutes);
  const max = Math.max(...vals, ...prev);

  return (
    <div style={{ padding: "0 14px 16px" }}>
      <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 16, marginTop: 4 }}>screen time by day</div>

      {/* Bar chart */}
      <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "0.5px solid var(--color-border-tertiary)", padding: "16px 14px" }}>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 120, overflow: "hidden" }}>
          {days.map((d, i) => (
            <div key={d} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, height: "100%" }}>
              <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", gap: 1 }}>
                <div style={{ flex: 1, height: `${Math.round((prev[i] / max) * 100)}%`, background: "var(--color-border-tertiary)", borderRadius: "2px 2px 0 0" }}/>
                <div style={{ flex: 1, height: `${Math.round((vals[i] / max) * 100)}%`, background: i === 6 ? "#1D9E75" : "#7F77DD", borderRadius: "2px 2px 0 0" }}/>
              </div>
              <div style={{ fontSize: 9, color: "var(--color-text-secondary)", flexShrink: 0 }}>{d}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11, color: "var(--color-text-secondary)" }}>
          <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#7F77DD", marginRight: 4 }}/>this week</span>
          <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--color-border-tertiary)", marginRight: 4 }}/>last week</span>
        </div>
      </div>

      {/* Category breakdown */}
      <div style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "20px 0 10px" }}>by category (daily avg)</div>
      <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "0.5px solid var(--color-border-tertiary)", padding: "14px" }}>
        {data.byCategory.map((c) => (
          <div key={c.category} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: "var(--color-text-primary)" }}>{c.icon} {c.category}</span>
              <span style={{ color: "var(--color-text-secondary)" }}>{fmtMin(c.minutes)}</span>
            </div>
            <div style={{ height: 5, background: "var(--color-border-tertiary)", borderRadius: 4 }}>
              <div style={{ height: "100%", width: `${c.pct}%`, background: c.color, borderRadius: 4 }}/>
            </div>
          </div>
        ))}
      </div>

      {/* Notifications */}
      <div style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "20px 0 10px" }}>notification open rates</div>
      <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "0.5px solid var(--color-border-tertiary)", padding: "14px" }}>
        {mockNotifications.byApp.map((n) => {
          const openRate = Math.round((n.opened / n.delivered) * 100);
          return (
            <div key={n.app} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 14, flexShrink: 0 }}>{n.icon}</div>
              <div style={{ width: 100, fontSize: 12, color: "var(--color-text-primary)", flexShrink: 0 }}>{n.app}</div>
              <div style={{ flex: 1, height: 6, background: "var(--color-border-tertiary)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${openRate}%`, height: "100%", background: n.recommendation === "keep" ? "#1D9E75" : "#D85A30", borderRadius: 4 }}/>
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", width: 28, textAlign: "right", flexShrink: 0 }}>{openRate}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RulesScreen() {
  const [rules, setRules] = useState(mockRules);

  const toggle = (id) => setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));

  return (
    <div style={{ padding: "0 14px 16px" }}>
      <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 16, marginTop: 4 }}>
        Automatic rules trigger DND, app limits, or focus modes based on context.
      </div>

      {rules.map((rule) => (
        <div key={rule.id} style={{ marginBottom: 10, background: "var(--color-background-primary)", border: `0.5px solid ${rule.enabled ? "var(--color-border-secondary)" : "var(--color-border-tertiary)"}`, borderRadius: 12, padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: rule.enabled ? "#E1F5EE" : "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
              {rule.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{rule.name}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{rule.description}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", padding: "2px 7px", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)" }}>
                  IF {rule.trigger}
                </span>
                <span style={{ fontSize: 10, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", padding: "2px 7px", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)" }}>
                  THEN {rule.action}
                </span>
              </div>
            </div>
            <button
              onClick={() => toggle(rule.id)}
              style={{ flexShrink: 0, width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: rule.enabled ? "#1D9E75" : "var(--color-border-tertiary)", position: "relative", transition: "background 0.2s" }}
            >
              <div style={{ position: "absolute", top: 2, left: rule.enabled ? 20 : 2, width: 18, height: 18, borderRadius: 9, background: "white", transition: "left 0.2s" }}/>
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={() => alert("This would open a rule builder to add new automation")}
        style={{ width: "100%", marginTop: 6, padding: "12px", border: "0.5px dashed var(--color-border-secondary)", borderRadius: 12, background: "transparent", color: "var(--color-text-secondary)", fontSize: 13, cursor: "pointer" }}
      >
        + Add new rule
      </button>
    </div>
  );
}

// ── Weather condition helpers ─────────────────────────────────
function wxIcon(code) {
  if (code === 0) return { icon: "☀️", label: "sunny", condition: "clear" };
  if (code <= 2) return { icon: "⛅", label: "partly cloudy", condition: "partly_cloudy" };
  if (code <= 3) return { icon: "☁️", label: "overcast", condition: "overcast" };
  if (code <= 57) return { icon: "🌧️", label: "drizzle", condition: "rain" };
  if (code <= 67) return { icon: "🌧️", label: "rain", condition: "rain" };
  if (code <= 77) return { icon: "❄️", label: "snow", condition: "snow" };
  if (code <= 82) return { icon: "🌦️", label: "rain showers", condition: "rain" };
  return { icon: "⛈️", label: "stormy", condition: "storm" };
}

function SettingsScreen({ onDataImported }) {
  const [imported, setImported] = useState(hasImportedData());
  const [step, setStep] = useState("idle"); // idle | locating | weather | form | saving | done
  const [locData, setLocData] = useState(null);   // { lat, lng, label }
  const [wxData, setWxData] = useState(null);     // { tempF, icon, label, condition }
  const [locError, setLocError] = useState(null);
  // Screen Time form state
  const [yourName, setYourName] = useState("Naky");
  const [dailyTotal, setDailyTotal] = useState("");
  const [apps, setApps] = useState([
    { app: "", minutes: "" },
    { app: "", minutes: "" },
    { app: "", minutes: "" },
  ]);

  function addApp() {
    setApps(a => [...a, { app: "", minutes: "" }]);
  }
  function updateApp(i, field, val) {
    setApps(a => a.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  }

  const [cityInput, setCityInput] = useState("");

  async function fetchWeatherForCoords(lat, lng, label) {
    setLocData({ lat, lng, label });
    setStep("weather");
    try {
      const wx = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=fahrenheit&windspeed_unit=mph`
      ).then(r => r.json());
      const c = wx.current;
      const info = wxIcon(c.weathercode);
      setWxData({ tempF: Math.round(c.temperature_2m), windMph: Math.round(c.windspeed_10m), ...info });
    } catch {
      setWxData({ tempF: 0, windMph: 0, icon: "🌤️", label: "unknown", condition: "clear" });
    }
    setStep("form");
  }

  async function handleUseMyData() {
    setLocError(null);
    setStep("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let label = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
        try {
          const geo = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          ).then(r => r.json());
          const city = geo.address?.city || geo.address?.town || geo.address?.village || "";
          const state = geo.address?.state || "";
          if (city) label = state ? `${city}, ${state}` : city;
        } catch { /* use coords as label */ }
        await fetchWeatherForCoords(lat, lng, label);
      },
      () => {
        // GPS blocked (HTTP) — fall back to city name input
        setStep("city");
      },
      { timeout: 8000 }
    );
  }

  async function handleCitySubmit() {
    if (!cityInput.trim()) return;
    setStep("weather");
    try {
      const geo = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityInput)}&format=json&limit=1`
      ).then(r => r.json());
      if (!geo.length) { setLocError("City not found. Try again."); setStep("city"); return; }
      const { lat, lon, display_name } = geo[0];
      const parts = display_name.split(", ");
      const label = parts.slice(0, 2).join(", ");
      await fetchWeatherForCoords(parseFloat(lat), parseFloat(lon), label);
    } catch {
      setLocError("Could not look up city. Check your connection.");
      setStep("city");
    }
  }

  function handleSubmit() {
    setStep("saving");
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const filledApps = apps.filter(a => a.app && a.minutes);
    const total = parseInt(dailyTotal) || filledApps.reduce((s, a) => s + parseInt(a.minutes || 0), 0) || 300;
    const json = {
      exportedAt: now,
      user: { name: yourName, location: locData?.label ?? "" },
      screenTime: {
        weekStart: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10),
        weekEnd: today,
        dailyTotals: Array(7).fill(total),
        byApp: filledApps.map(a => ({ app: a.app, minutes: parseInt(a.minutes), opens: Math.round(parseInt(a.minutes) / 4) })),
      },
      location: locData ? { ...locData, timestamp: now } : null,
      weather: wxData ? { ...wxData } : null,
    };
    saveImportedData(json);
    setImported(true);
    setStep("done");
    onDataImported?.();
  }

  function handleClear() {
    clearImportedData();
    setImported(false);
    setStep("idle");
    setLocData(null);
    setWxData(null);
    setApps([{ app: "", minutes: "" }, { app: "", minutes: "" }, { app: "", minutes: "" }]);
    setDailyTotal("");
    onDataImported?.();
  }

  const inputStyle = {
    width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 13,
    border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)",
    color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box",
  };
  const btnPrimary = {
    width: "100%", padding: "11px 0", borderRadius: 8, background: "#1D9E75",
    color: "white", fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer", marginTop: 4,
  };

  return (
    <div style={{ padding: "0 14px 16px" }}>

      {/* ── Main CTA card ── */}
      <SectionLabel style={{ padding: "12px 0 8px" }}>your data</SectionLabel>

      {imported && step !== "form" ? (
        <div style={{ background: "#F0FDF4", border: "0.5px solid #86EFAC", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 22 }}>✅</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#166534" }}>Your data is loaded</div>
              <div style={{ fontSize: 11, color: "#16a34a", marginTop: 2 }}>
                Location, weather &amp; Screen Time are live
              </div>
            </div>
            <button onClick={handleClear} style={{ fontSize: 11, color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>
              reset
            </button>
          </div>
        </div>
      ) : step === "idle" ? (
        <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 4 }}>Use your real data</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
            Auto-detects your location &amp; weather. You enter your Screen Time numbers from <strong>Settings → Screen Time</strong>.
          </div>
          {locError && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>{locError}</div>}
          <button style={btnPrimary} onClick={handleUseMyData}>
            Use my location &amp; Screen Time
          </button>
        </div>
      ) : step === "locating" || step === "weather" ? (
        <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>{step === "locating" ? "📍" : "🌤️"}</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            {step === "locating" ? "Getting your location…" : "Fetching weather…"}
          </div>
        </div>
      ) : step === "city" ? (
        <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 4 }}>Enter your city</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10, lineHeight: 1.5 }}>
            GPS requires HTTPS — type your city instead and we'll fetch the weather.
          </div>
          {locError && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>{locError}</div>}
          <input
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 13, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
            placeholder="e.g. Seoul, Korea"
            value={cityInput}
            onChange={e => setCityInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCitySubmit()}
          />
          <button style={{ width: "100%", padding: "11px 0", borderRadius: 8, background: "#1D9E75", color: "white", fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer" }} onClick={handleCitySubmit}>
            Continue
          </button>
        </div>
      ) : step === "form" ? (
        <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 14 }}>
          {/* Location + weather confirmed */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, background: "var(--color-background-primary)", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
              <div style={{ color: "var(--color-text-secondary)", fontSize: 10, marginBottom: 2 }}>LOCATION</div>
              <div style={{ fontWeight: 500 }}>📍 {locData?.label}</div>
            </div>
            {wxData && (
              <div style={{ flex: 1, background: "var(--color-background-primary)", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
                <div style={{ color: "var(--color-text-secondary)", fontSize: 10, marginBottom: 2 }}>WEATHER</div>
                <div style={{ fontWeight: 500 }}>{wxData.icon} {wxData.tempF}°F · {wxData.label}</div>
              </div>
            )}
          </div>

          {/* Name */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>YOUR NAME</div>
            <input style={inputStyle} value={yourName} onChange={e => setYourName(e.target.value)} placeholder="Your name" />
          </div>

          {/* Daily total */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>
              DAILY SCREEN TIME (minutes) — from Settings → Screen Time
            </div>
            <input style={inputStyle} type="number" value={dailyTotal} onChange={e => setDailyTotal(e.target.value)} placeholder="e.g. 320" />
          </div>

          {/* Top apps */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 6 }}>
              TOP APPS (from Screen Time "Most Used")
            </div>
            {apps.map((row, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input
                  style={{ ...inputStyle, flex: 2 }}
                  placeholder={`App ${i + 1} name`}
                  value={row.app}
                  onChange={e => updateApp(i, "app", e.target.value)}
                />
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  type="number"
                  placeholder="min"
                  value={row.minutes}
                  onChange={e => updateApp(i, "minutes", e.target.value)}
                />
              </div>
            ))}
            <button onClick={addApp} style={{ fontSize: 12, color: "#1D9E75", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              + add app
            </button>
          </div>

          <button style={btnPrimary} onClick={handleSubmit}>
            Load my data
          </button>
          <button onClick={() => setStep("idle")} style={{ width: "100%", padding: "8px 0", marginTop: 6, fontSize: 12, color: "var(--color-text-secondary)", background: "none", border: "none", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      ) : null}

      <SectionLabel style={{ marginTop: 16 }}>notification preferences</SectionLabel>
      {[
        { label: "Weekly digest", sub: "Sunday evenings", on: true },
        { label: "Missed moment alerts", sub: "Real-time, when detected", on: true },
        { label: "Habit loop warnings", sub: "After 5+ habit sessions", on: false },
      ].map((p) => (
        <div key={p.label} style={{ display: "flex", alignItems: "center", marginBottom: 8, background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{p.label}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>{p.sub}</div>
          </div>
          <div style={{ width: 40, height: 22, borderRadius: 11, background: p.on ? "#1D9E75" : "var(--color-border-tertiary)", position: "relative", cursor: "pointer" }}>
            <div style={{ position: "absolute", top: 2, left: p.on ? 20 : 2, width: 18, height: 18, borderRadius: 9, background: "white" }}/>
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ children, style }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", letterSpacing: "0.06em", textTransform: "uppercase", padding: "12px 14px 6px", ...style }}>
      {children}
    </div>
  );
}

// ── Nav Icons ────────────────────────────────────────────────────────────────
const HomeIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>;
const TrendsIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
const RulesIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>;
const SettingsIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;

const TABS = [
  { id: "today", label: "today", Icon: HomeIcon, Screen: TodayScreen },
  { id: "trends", label: "trends", Icon: TrendsIcon, Screen: TrendsScreen },
  { id: "rules", label: "rules", Icon: RulesIcon, Screen: RulesScreen },
  { id: "settings", label: "settings", Icon: SettingsIcon, Screen: SettingsScreen },
];

// ── App Shell ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("today");
  const [dataVersion, setDataVersion] = useState(0);

  // Recompute whenever data is imported — guarantees screens always see fresh data
  const screenData = useMemo(() => ({
    yday: getYesterdayStats(),
    byDay: getScreenTimeByDay(),
    byCategory: getScreenTimeByCategory(),
    byApp: getScreenTimeByApp(),
  }), [dataVersion]); // dataVersion bump triggers re-read from localStorage

  function handleDataImported() {
    setDataVersion(v => v + 1);
  }

  function renderScreen() {
    if (tab === "settings") return <SettingsScreen onDataImported={handleDataImported} />;
    if (tab === "today")    return <TodayScreen data={screenData} />;
    if (tab === "trends")   return <TrendsScreen data={screenData} />;
    const current = TABS.find(t => t.id === tab);
    return <current.Screen />;
  }

  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="phone">
      <div className="dynamic-island" />

      {/* Top bar — fixed inside phone, does not scroll */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "52px 16px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-primary)" }}>
        <div style={{ fontSize: 17, fontWeight: 500, color: "var(--color-text-primary)", letterSpacing: -0.5 }}>
          <span style={{ color: "#1D9E75" }}>WYM</span>
          <span style={{ fontWeight: 400, color: "var(--color-text-secondary)", fontSize: 14 }}> — what you missed</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--color-text-secondary)", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 20, padding: "3px 10px" }}>
          {today}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="phone-scroll">
        {renderScreen()}
      </div>

      {/* Bottom nav */}
      <nav className="phone-nav">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontSize: 10, color: tab === id ? "#1D9E75" : "var(--color-text-secondary)", background: tab === id ? "#E1F5EE" : "transparent", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
