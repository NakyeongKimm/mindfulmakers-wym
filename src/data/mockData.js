// ============================================================
// WYM: What You Missed — Mock Data
// ============================================================
// Swap this file with real data exports from:
//   - iOS Screen Time API / Shortcuts automation
//   - Apple Maps / CoreLocation history
//   - WeatherKit or Open-Meteo API
//   - iOS notification center
// All keys and shapes are documented below for easy replacement.
// ============================================================

export const user = {
  name: "Naky",
  location: "Cambridge, MA",
  weekStart: "2026-03-09",
  weekEnd: "2026-03-14",
};

// ── Screen Time ──────────────────────────────────────────────
// Source: iOS Screen Time (Settings > Screen Time > export via Shortcuts)
// Shape: daily average in minutes per app category
export const screenTime = {
  // daily averages this week (minutes)
  dailyAverageMinutes: 462, // 7h 42m

  // per-day totals (minutes), Mon–Sun
  dailyTotals: [390, 510, 440, 520, 475, 500, 460],
  dailyLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],

  // previous week daily totals for comparison
  prevWeekTotals: [360, 480, 400, 490, 430, 510, 420],

  // breakdown by category (minutes/day average)
  byCategory: [
    { category: "Social", minutes: 108, color: "#7F77DD", icon: "💬" },
    { category: "Entertainment", minutes: 94, color: "#EF9F27", icon: "🎬" },
    { category: "Productivity", minutes: 72, color: "#1D9E75", icon: "📋" },
    { category: "News", minutes: 61, color: "#D85A30", icon: "📰" },
    { category: "Shopping", minutes: 48, color: "#378ADD", icon: "🛍️" },
    { category: "Other", minutes: 79, color: "#888780", icon: "📱" },
  ],

  // app-level detail (minutes/day average, top apps)
  byApp: [
    { app: "Reddit", minutes: 80, opens: 23, avgSession: 14, intentional: 0.27 },
    { app: "Instagram", minutes: 54, opens: 18, avgSession: 11, intentional: 0.41 },
    { app: "YouTube", minutes: 48, opens: 9, avgSession: 32, intentional: 0.78 },
    { app: "iMessage", minutes: 41, opens: 34, avgSession: 4, intentional: 0.91 },
    { app: "Twitter / X", minutes: 38, opens: 19, avgSession: 12, intentional: 0.33 },
    { app: "Amazon", minutes: 22, opens: 11, avgSession: 8, intentional: 0.55 },
    { app: "Gmail", minutes: 19, opens: 28, avgSession: 3, intentional: 0.88 },
    { app: "Maps", minutes: 14, opens: 6, avgSession: 7, intentional: 0.95 },
  ],

  // phone-free meals (out of 21 total this week)
  phoneFreeMetrics: {
    mealsThisWeek: 3,
    mealsLastWeek: 1,
    totalMeals: 21,
    phoneFreeExamples: ["Tue dinner", "Thu lunch", "Sat brunch"],
  },
};

// ── Notifications ─────────────────────────────────────────────
// Source: iOS notification center (Shortcuts: "Get Notification History")
// Shape: per-app counts of delivered vs. opened notifications
export const notifications = {
  // total ignored this week
  totalIgnored: 312,
  totalDelivered: 489,

  // per-app breakdown
  byApp: [
    {
      app: "Amazon",
      icon: "📦",
      color: "#FAEEDA",
      delivered: 94,
      opened: 6,
      types: ["shipping updates", "promo deals"],
      recommendation: "turn off",
    },
    {
      app: "News apps",
      icon: "📰",
      color: "#FCEBEB",
      delivered: 87,
      opened: 4,
      types: ["breaking alerts", "trending stories"],
      recommendation: "turn off",
    },
    {
      app: "Shopping (4 apps)",
      icon: "🛍️",
      color: "#E6F1FB",
      delivered: 131,
      opened: 11,
      types: ["flash sales", "cart reminders", "nudges"],
      recommendation: "turn off",
    },
    {
      app: "iMessage",
      icon: "💬",
      color: "#E1F5EE",
      delivered: 98,
      opened: 95,
      types: ["messages"],
      recommendation: "keep",
    },
    {
      app: "Gmail",
      icon: "✉️",
      color: "#EEEDFE",
      delivered: 54,
      opened: 41,
      types: ["emails"],
      recommendation: "keep",
    },
    {
      app: "Calendar",
      icon: "📅",
      color: "#EAF3DE",
      delivered: 25,
      opened: 24,
      types: ["event reminders"],
      recommendation: "keep",
    },
  ],
};

// ── Location / Maps ───────────────────────────────────────────
// Source: Apple Maps Significant Locations (Settings > Privacy > Location Services > System Services > Significant Locations)
// Or: iOS Shortcuts "Get Current Location" logged over time
export const locationHistory = [
  {
    id: "loc_001",
    date: "2026-03-14",
    time: "08:14",
    label: "Charles River Esplanade",
    startCoords: { lat: 42.3536, lng: -71.0707 },
    endCoords: { lat: 42.3601, lng: -71.0942 },
    durationMinutes: 22,
    type: "walk",
    phoneScreenOnMinutes: 19,
    messagesSent: 47,
    messagingThreads: 3,
    nearbyPOIs: ["Charles River", "Esplanade", "Hatch Shell"],
  },
  {
    id: "loc_002",
    date: "2026-03-13",
    time: "18:30",
    label: "Dinner at home",
    startCoords: { lat: 42.3481, lng: -71.0789 },
    endCoords: { lat: 42.3481, lng: -71.0789 },
    durationMinutes: 45,
    type: "meal",
    phoneScreenOnMinutes: 2,
    messagesSent: 0,
    messagingThreads: 0,
    nearbyPOIs: [],
  },
  {
    id: "loc_003",
    date: "2026-03-12",
    time: "12:15",
    label: "Lunch at Flour Bakery",
    startCoords: { lat: 42.3429, lng: -71.0901 },
    endCoords: { lat: 42.3429, lng: -71.0901 },
    durationMinutes: 38,
    type: "meal",
    phoneScreenOnMinutes: 0,
    messagesSent: 0,
    messagingThreads: 0,
    nearbyPOIs: ["Flour Bakery"],
  },
];

// ── Weather ───────────────────────────────────────────────────
// Source: WeatherKit (Apple) or Open-Meteo API (free, open)
// https://api.open-meteo.com/v1/forecast?latitude=42.36&longitude=-71.06&...
export const weatherHistory = [
  {
    date: "2026-03-14",
    time: "08:00",
    condition: "clear",
    label: "sunny",
    tempF: 54,
    windMph: 7,
    goldenHour: false,
    notableCondition: "perfect walking weather",
    icon: "☀️",
  },
  {
    date: "2026-03-13",
    time: "06:48",
    condition: "clear",
    label: "golden hour / sunrise",
    tempF: 46,
    windMph: 4,
    goldenHour: true,
    notableCondition: "optimal sunrise visibility",
    icon: "🌅",
  },
  {
    date: "2026-03-12",
    time: "12:00",
    condition: "partly_cloudy",
    label: "mild and pleasant",
    tempF: 58,
    windMph: 9,
    goldenHour: false,
    notableCondition: "comfortable outdoor conditions",
    icon: "⛅",
  },
  {
    date: "2026-03-11",
    time: "17:30",
    condition: "clear",
    label: "golden hour / sunset",
    tempF: 51,
    windMph: 5,
    goldenHour: true,
    notableCondition: "vivid sunset colors",
    icon: "🌇",
  },
];

// ── Insights (derived / pre-computed) ─────────────────────────
// These would be generated server-side by combining the above data sources.
// For the prototype, they are pre-written here.
// Each insight has: type, severity, title, subtitle, detail, tags, action
export const insights = [
  {
    id: "ins_001",
    type: "missed_moment",
    severity: "high", // high | medium | low
    icon: "🌊",
    iconBg: "#E1F5EE",
    title: "You walked along the Charles River for 22 min while texting",
    subtitle: "Today, 8:14 AM · Cambridge, MA",
    detail: [
      "You sent 47 messages to 3 threads during this walk",
      "Phone screen was on for 19 of 22 minutes",
      "Weather: sunny 54°F — perfect walking conditions",
    ],
    tags: ["sunny 54°F", "river view", "low foot traffic"],
    locationId: "loc_001",
    weatherDate: "2026-03-14",
    mapRoute: {
      label: "Charles River Esplanade",
      startLabel: "start",
      endLabel: "end",
    },
    action: {
      label: "Suggest how to be more present",
      prompt: "Suggest ways I can be more present when walking along the Charles River",
    },
  },
  {
    id: "ins_002",
    type: "missed_moment",
    severity: "high",
    icon: "🌅",
    iconBg: "#FAEEDA",
    title: "Perfect sunrise while you were scrolling Instagram",
    subtitle: "Yesterday, 6:48 AM · 23 min session",
    detail: [
      "Weather: clear skies, golden hour conditions — optimal visibility",
      "You were home (Back Bay). East-facing windows had full sun.",
      "Instagram session ran 6:45–7:08 AM, perfectly overlapping sunrise",
    ],
    tags: ["golden hour", "clear skies", "46°F"],
    locationId: null,
    weatherDate: "2026-03-13",
    mapRoute: null,
    action: {
      label: "Help me fix my mornings",
      prompt: "How can I build a morning routine that includes less phone time?",
    },
  },
  {
    id: "ins_003",
    type: "notification_noise",
    severity: "medium",
    icon: "🔕",
    iconBg: "#FCEBEB",
    title: "312 notifications you never opened this week",
    subtitle: "Across 6 apps · possibly unnecessary distractions",
    detail: [
      "Amazon: 94 notifications, only 6 opened (6% open rate)",
      "News apps: 87 notifications, 4 opened (5% open rate)",
      "Shopping apps (4): 131 notifications, 11 opened (8% open rate)",
    ],
    tags: ["94 Amazon", "87 News", "131 Shopping"],
    locationId: null,
    weatherDate: null,
    mapRoute: null,
    action: {
      label: "Help me cut the noise",
      prompt: "Which of these notifications should I turn off to reduce distractions?",
    },
  },
  {
    id: "ins_004",
    type: "habit_loop",
    severity: "medium",
    icon: "💬",
    iconBg: "#EEEDFE",
    title: "Reddit: 1h 20m daily — you never set out to open it",
    subtitle: "Mostly opened by habit, not intention",
    detail: [
      "73% of opens happened within 2 min of unlocking your phone",
      "Average session: 14 minutes. Intended: 1–2 min.",
      "23 opens per day across the week",
    ],
    tags: ["23 opens/day", "14 min avg session", "habit loop"],
    locationId: null,
    weatherDate: null,
    mapRoute: null,
    barValue: 67,
    barColor: "#7F77DD",
    barLabel: "80 min / day",
    action: {
      label: "Help me be intentional",
      prompt: "Suggest a realistic plan to reduce mindless Reddit usage",
    },
  },
  {
    id: "ins_005",
    type: "win",
    severity: "low",
    icon: "✅",
    iconBg: "#E1F5EE",
    title: "You had 3 phone-free meals this week",
    subtitle: "Up from 1 last week · keep it going",
    detail: [
      "Tue dinner, Thu lunch, Sat brunch — all 30+ min phone-free",
      "That's 3x improvement from last week",
    ],
    tags: ["Tue dinner", "Thu lunch", "Sat brunch"],
    locationId: null,
    weatherDate: null,
    mapRoute: null,
    barValue: 14,
    barColor: "#1D9E75",
    barLabel: "3 of 21 meals",
    action: {
      label: "Build on this habit",
      prompt: "How do I build a habit of more phone-free meals?",
    },
  },
];

// ── Rules / Limits ────────────────────────────────────────────
// User-configured rules (would be stored in app preferences)
export const rules = [
  {
    id: "rule_001",
    name: "River walk DND",
    description: "Near water + good weather → enable Do Not Disturb",
    trigger: "location:water AND weather:clear",
    action: "enable_dnd",
    enabled: true,
  },
  {
    id: "rule_002",
    name: "Morning no-scroll",
    description: "Block social apps before 8 AM",
    trigger: "time:before_8am",
    action: "block_apps:social",
    enabled: true,
  },
  {
    id: "rule_003",
    name: "Meal time focus",
    description: "Limit notifications during meal times",
    trigger: "time:meal_window",
    action: "allow_only:calls,messages",
    enabled: false,
  },
];

// ── Summary Stats (computed from above) ───────────────────────
export const weeklySummary = {
  avgDailyScreenMinutes: screenTime.dailyAverageMinutes,
  totalIgnoredNotifications: notifications.totalIgnored,
  missedMomentsCount: insights.filter((i) => i.type === "missed_moment").length,
  winsCount: insights.filter((i) => i.type === "win").length,
  phoneFreeMetrics: screenTime.phoneFreeMetrics,
};
