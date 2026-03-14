// ScreenTimeManager.swift
// Tracks per-app usage by registering fine-grained DeviceActivity thresholds.
//
// IMPORTANT API CONSTRAINTS:
// - Raw screen-time minutes (like Settings.app shows) are NOT readable.
// - DeviceActivity can fire callbacks when an app exceeds a time threshold.
// - We approximate opens/minutes by stacking many small thresholds per hour.
// - The DeviceActivityMonitor class MUST live in a separate Xcode extension target.
//   (File > New Target > DeviceActivity Monitor Extension)
// - Requires entitlement: com.apple.developer.family-controls
//   Apply at: developer.apple.com/contact/request/family-controls-distribution
//
// App Group ("group.com.yourteam.wym") is the shared store between the
// monitor extension and the main app.

import DeviceActivity
import FamilyControls
import ManagedSettings

// ── App Group shared storage ───────────────────────────────────────────────────
// Both the monitor extension and the main app read/write here.

struct ScreenTimeStore {
    static let groupID = "group.com.yourteam.wym"
    private static var defaults: UserDefaults { UserDefaults(suiteName: groupID)! }

    // A single recorded threshold event: one app exceeded N minutes in one hour window.
    struct ThresholdEvent: Codable {
        let appName: String       // Human-readable label set when registering the event
        let bundleID: String      // e.g. "com.reddit.Reddit"
        let category: AppCategory
        let windowHour: Int       // 0-23 — which hour window fired
        let minutesThreshold: Int // which threshold level fired (5, 10, 20, 30, ...)
        let firedAt: Date         // wall-clock time the callback ran
    }

    // Notification interaction event logged by UNUserNotificationCenterDelegate
    struct NotificationEvent: Codable {
        let appBundleID: String
        let deliveredAt: Date
        let wasOpened: Bool
    }

    // MARK: - Threshold events

    static func appendThresholdEvent(_ event: ThresholdEvent) {
        var events = loadThresholdEvents()
        // Keep only last 7 days
        let cutoff = Calendar.current.date(byAdding: .day, value: -7, to: Date())!
        events = events.filter { $0.firedAt > cutoff }
        events.append(event)
        defaults.set(try? JSONEncoder().encode(events), forKey: "thresholdEvents")
    }

    static func loadThresholdEvents() -> [ThresholdEvent] {
        guard let data = defaults.data(forKey: "thresholdEvents") else { return [] }
        return (try? JSONDecoder().decode([ThresholdEvent].self, from: data)) ?? []
    }

    // MARK: - Notification events

    static func appendNotificationEvent(_ event: NotificationEvent) {
        var events = loadNotificationEvents()
        let cutoff = Calendar.current.date(byAdding: .day, value: -7, to: Date())!
        events = events.filter { $0.deliveredAt > cutoff }
        events.append(event)
        defaults.set(try? JSONEncoder().encode(events), forKey: "notificationEvents")
    }

    static func loadNotificationEvents() -> [NotificationEvent] {
        guard let data = defaults.data(forKey: "notificationEvents") else { return [] }
        return (try? JSONDecoder().decode([NotificationEvent].self, from: data)) ?? []
    }

    // MARK: - JSON export for WebBridge

    static func thresholdEventsJSON() -> String {
        let data = (try? JSONEncoder().encode(loadThresholdEvents())) ?? Data()
        return String(data: data, encoding: .utf8) ?? "[]"
    }

    static func notificationEventsJSON() -> String {
        let data = (try? JSONEncoder().encode(loadNotificationEvents())) ?? Data()
        return String(data: data, encoding: .utf8) ?? "[]"
    }
}

// ── App catalog ───────────────────────────────────────────────────────────────
// The apps we monitor, grouped into the same categories the React app uses.

enum AppCategory: String, Codable, CaseIterable {
    case social        = "Social"
    case entertainment = "Entertainment"
    case productivity  = "Productivity"
    case news          = "News"
    case shopping      = "Shopping"
    case other         = "Other"

    var colorHex: String {
        switch self {
        case .social:        return "#7F77DD"
        case .entertainment: return "#EF9F27"
        case .productivity:  return "#1D9E75"
        case .news:          return "#D85A30"
        case .shopping:      return "#378ADD"
        case .other:         return "#888780"
        }
    }

    var icon: String {
        switch self {
        case .social:        return "💬"
        case .entertainment: return "🎬"
        case .productivity:  return "📋"
        case .news:          return "📰"
        case .shopping:      return "🛍️"
        case .other:         return "📱"
        }
    }
}

struct TrackedApp {
    let name: String
    let bundleID: String
    let category: AppCategory
    // Ratio < 0.5 = mostly habitual (used for intentional score estimation)
    // Planned signal: short avg session length (< ~5 min) = habitual,
    // long focused sessions = intentional. Derived from threshold data:
    //   avgSession = estimatedMinutes / estimatedOpens
    // This is a hardcoded prior until real session data is available.
    let habitualPrior: Double
}

let trackedApps: [TrackedApp] = [
    TrackedApp(name: "Reddit",      bundleID: "com.reddit.Reddit",           category: .social,        habitualPrior: 0.73),
    TrackedApp(name: "Instagram",   bundleID: "com.burbn.instagram",         category: .social,        habitualPrior: 0.59),
    TrackedApp(name: "Twitter / X", bundleID: "com.atebits.Tweetie2",        category: .social,        habitualPrior: 0.67),
    TrackedApp(name: "TikTok",      bundleID: "com.zhiliaoapp.musically",    category: .entertainment, habitualPrior: 0.80),
    TrackedApp(name: "YouTube",     bundleID: "com.google.ios.youtube",      category: .entertainment, habitualPrior: 0.22),
    TrackedApp(name: "iMessage",    bundleID: "com.apple.MobileSMS",         category: .social,        habitualPrior: 0.09),
    TrackedApp(name: "Amazon",      bundleID: "com.amazon.Amazon",           category: .shopping,      habitualPrior: 0.45),
    TrackedApp(name: "Gmail",       bundleID: "com.google.Gmail",            category: .productivity,  habitualPrior: 0.30),
    TrackedApp(name: "Outlook",     bundleID: "com.microsoft.office.outlook",category: .productivity,  habitualPrior: 0.55),
]

// ── DeviceActivity setup ───────────────────────────────────────────────────────
// Registers 24 one-hour schedules per day with multiple threshold levels per app.
// When a threshold fires, the monitor extension records a ThresholdEvent.
//
// Threshold stacking strategy:
//   5 min threshold  → app was opened (low use)
//   15 min threshold → moderate use in that hour
//   30 min threshold → heavy use (caught_in_loop territory)
//
// This lets InsightEngine infer ~usage from how many levels fired in each window.

class ScreenTimeMonitor: ObservableObject {
    private let center = DeviceActivityCenter()

    // Call this once after FamilyControls authorization is granted.
    // Pass the FamilyActivitySelection the user picked in AppPickerView.
    func startDailyMonitoring(selection: FamilyActivitySelection) {
        // One schedule per hour so we know WHICH hour an app was used —
        // critical for correlating with CLVisit timestamps.
        for hour in 0..<24 {
            let scheduleName = DeviceActivityName("hour_\(hour)")
            let schedule = DeviceActivitySchedule(
                intervalStart: DateComponents(hour: hour, minute: 0),
                intervalEnd:   DateComponents(hour: hour, minute: 59),
                repeats: true
            )

            // Register three threshold levels per tracked app
            var events: [DeviceActivityEvent.Name: DeviceActivityEvent] = [:]
            for app in trackedApps {
                for minutes in [5, 15, 30] {
                    let eventName = DeviceActivityEvent.Name("\(app.bundleID)_\(hour)h_\(minutes)m")
                    events[eventName] = DeviceActivityEvent(
                        applications: selection.applicationTokens.filter { _ in true }, // filter by bundleID if possible
                        threshold: DateComponents(minute: minutes)
                    )
                }
            }

            try? center.startMonitoring(scheduleName, during: schedule, events: events)
        }
    }

    func stopAllMonitoring() {
        for hour in 0..<24 {
            center.stopMonitoring([DeviceActivityName("hour_\(hour)")])
        }
    }
}

// ── DeviceActivityMonitor extension ───────────────────────────────────────────
// PASTE THIS into your separate DeviceActivity Monitor Extension target.
// Do NOT include it in the main app target.
//
// import DeviceActivity
//
// class WYMActivityMonitor: DeviceActivityMonitor {
//
//     // Called when a threshold event fires within a scheduled window.
//     override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name,
//                                          activity: DeviceActivityName) {
//         // Parse the event name we registered above: "bundleID_Hh_Mm"
//         let parts = event.rawValue.split(separator: "_")
//         guard parts.count == 3,
//               let hourStr   = parts[1].dropLast().components(separatedBy: "").last.flatMap({ Int($0) }),
//               let minuteStr = String(parts[2].dropLast()).flatMap({ Int($0) }),
//               let app = trackedApps.first(where: { $0.bundleID == String(parts[0]) })
//         else { return }
//
//         let thresholdEvent = ScreenTimeStore.ThresholdEvent(
//             appName:          app.name,
//             bundleID:         app.bundleID,
//             category:         app.category,
//             windowHour:       hourStr,
//             minutesThreshold: minuteStr,
//             firedAt:          Date()
//         )
//         ScreenTimeStore.appendThresholdEvent(thresholdEvent)
//     }
//
//     override func intervalDidEnd(for activity: DeviceActivityName) {
//         // Hour window closed — could persist a "day ended" marker here
//     }
// }

// ── Usage inference from threshold events ─────────────────────────────────────
// Since we can't read raw minutes, we infer from which thresholds fired.

struct InferredAppUsage {
    let app: TrackedApp
    let estimatedMinutes: Int     // estimated total for the day
    let estimatedOpens: Int       // estimated number of opens
    let estimatedAvgSession: Int  // estimated minutes per session
    let intentionalRatio: Double  // 1 - habitualPrior (static prior for now)
    let activeHours: [Int]        // hours of day where use was detected
}

func inferDailyUsage(from events: [ScreenTimeStore.ThresholdEvent], for date: Date) -> [InferredAppUsage] {
    let cal = Calendar.current
    let todayEvents = events.filter { cal.isDate($0.firedAt, inSameDayAs: date) }

    return trackedApps.map { app in
        let appEvents = todayEvents.filter { $0.bundleID == app.bundleID }

        // Highest threshold that fired in each hour = estimated minutes used that hour
        var minutesByHour: [Int: Int] = [:]
        for event in appEvents {
            let current = minutesByHour[event.windowHour] ?? 0
            minutesByHour[event.windowHour] = max(current, event.minutesThreshold)
        }

        let totalMinutes = minutesByHour.values.reduce(0, +)

        // Number of distinct hours with any usage = rough opens estimate
        let activeHours = Array(minutesByHour.keys.sorted())
        let estimatedOpens = max(activeHours.count * 2, 1) // ~2 opens per active hour

        let avgSession = estimatedOpens > 0 ? totalMinutes / estimatedOpens : 0

        return InferredAppUsage(
            app: app,
            estimatedMinutes: totalMinutes,
            estimatedOpens: estimatedOpens,
            estimatedAvgSession: avgSession,
            intentionalRatio: 1.0 - app.habitualPrior,
            activeHours: activeHours
        )
    }
    .filter { $0.estimatedMinutes > 0 }
    .sorted { $0.estimatedMinutes > $1.estimatedMinutes }
}

// ── Authorization ──────────────────────────────────────────────────────────────

class ScreenTimeAuthManager: ObservableObject {
    @Published var isAuthorized = false

    func requestAuthorization() async {
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            await MainActor.run { isAuthorized = true }
        } catch {
            print("Screen Time authorization failed: \(error)")
        }
    }
}

// ── App selection picker ───────────────────────────────────────────────────────

import SwiftUI

struct AppPickerView: View {
    @Binding var selection: FamilyActivitySelection
    @State private var showPicker = false

    var body: some View {
        Button("Select Apps to Monitor") { showPicker = true }
            .familyActivityPicker(isPresented: $showPicker, selection: $selection)
    }
}

// ── ManagedSettings: apply rules from the React Rules screen ──────────────────

class AppRestrictionManager {
    private let store = ManagedSettingsStore()

    func blockApps(selection: FamilyActivitySelection) {
        store.shield.applications = selection.applicationTokens
        store.shield.applicationCategories = ShieldSettings.ActivityCategoryPolicy
            .specific(selection.categoryTokens)
    }

    func removeRestrictions() {
        store.shield.applications = nil
        store.shield.applicationCategories = nil
    }
}
