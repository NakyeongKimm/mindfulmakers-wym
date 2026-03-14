# WYM: What You Missed

A prototype app that surfaces moments you missed due to excessive phone usage,
cross-referencing screen time, location, and weather data.

## Project Structure

```
src/
  data/
    mockData.js       ← All fake data lives here. Edit this to change what the app shows.
    dataAdapter.js    ← The ONLY file App.jsx imports from. Swap data sources here.
  App.jsx             ← Full app: Today, Trends, Rules, Settings screens
```

## Importing Your Real Data (iOS Shortcuts)

The app supports importing real Screen Time and location data via a JSON file.
No native app build required — works entirely in the browser.

### How it works

1. Fill in `wym-shortcut-template.json` with your data (see below)
2. Open the app → go to **Settings** → tap **Choose JSON file**
3. The app loads your data instantly and stores it in `localStorage`
4. Tap **clear** in Settings to go back to mock data

### Getting your Screen Time numbers

Go to **Settings → Screen Time** on your iPhone and note:
- Daily average (shown at the top)
- Per-app breakdown (scroll down under "Most Used")
- Daily totals for the past week (tap the week view)

Fill those numbers into `wym-shortcut-template.json`.

### Getting your location

The template accepts a `location` object with `lat`, `lng`, and `label`.
You can get coordinates from Maps → long-press any location → copy coordinates.

### iOS Shortcuts automation (attempted)

An iOS Shortcut was prototyped to automate this export:
- **Get Current Location** → provides `lat`/`lng`/`label` automatically
- **Get Weather** at current location → provides `tempF`, `condition`, `icon`
- **Text** action → assembles the JSON with location/weather pre-filled
- **Save File** → saves to iCloud Drive for import into the web app

The Shortcut successfully automates location and weather. Screen Time data
cannot be read programmatically via Shortcuts (Apple's Screen Time API requires
a native app with the `FamilyControls` entitlement) — so those numbers are
entered manually from Settings → Screen Time.

### Data source architecture

```
wym-shortcut-template.json  ← fill this in and import via Settings
        ↓
src/data/shortcutsExport.js ← transforms Shortcut JSON → app data shape
        ↓
src/data/dataAdapter.js     ← checks localStorage first, falls back to mock
        ↓
App.jsx                     ← reads only from dataAdapter (never touches raw data)
```

---

## Real Data Sources to Connect

| Data | Source | Status |
|------|--------|--------|
| Screen Time | Settings → Screen Time (manual) | ✅ via JSON import |
| Location | iOS Shortcuts: Get Current Location | ✅ via JSON import |
| Weather | iOS Shortcuts: Get Weather / Open-Meteo API | ✅ via JSON import |
| Notifications | iOS Shortcuts: "Get Notification History" | mock only |
| Screen Time (auto) | Native app with `FamilyControls` entitlement | requires Xcode build |
| Significant Locations | Native app with CoreLocation | requires Xcode build |

---

## Screens

- **Today** — Insights for this week: missed moments, notification noise, quiet wins
- **Trends** — Bar chart of daily screen time, category breakdown, notification open rates
- **Rules** — Toggle-able automation rules: DND near water, morning no-scroll, meal time focus
- **Settings** — Import real data, data source status, notification preferences

---

## Future Features

- **Intentional vs. habitual classification** — Currently removed; planned for native build. Approach: use average session length derived from DeviceActivity threshold data (short sessions = habitual, long focused sessions = intentional) as the primary signal, optionally combined with user self-report to calibrate per-app scores.
- **Automatic Screen Time sync** — Requires native iOS app with `FamilyControls` entitlement (Apple approval needed). Raw per-app minutes are not accessible via third-party APIs.
- **Significant locations** — CoreLocation `CLVisit` API in the native app for automatic place detection instead of manual city entry.
- **Notification history** — iOS Shortcuts "Get Notification History" or native `UNUserNotificationCenterDelegate` for real open/ignore rates.

---

## Running Locally

```bash
npx create-react-app wym
# Copy src/ files into the new project
npm start
```

Or drop `App.jsx` into any React sandbox (CodeSandbox, StackBlitz, etc.).
The data files (`mockData.js`, `dataAdapter.js`) must be in the same `src/data/` folder.
