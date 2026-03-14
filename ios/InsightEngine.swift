// InsightEngine.swift
// Correlates LocationSession records with inferred screen-time usage to produce
// WYMInsight objects — the same JSON shape the React app reads from mockInsights.
//
// Pattern detections:
//   missed_moment   — walking at a scenic place while phone was heavily in use
//   missed_moment   — golden-hour / sunrise window overlapped a social-app session
//   caught_in_loop  — meal-time window with heavy entertainment/social use
//   habit_loop      — an app opened many times per day with low intentionality
//   notification_noise — apps with <15% notification open rate
//   win             — meal window passed with zero social/entertainment threshold events

import Foundation
import CoreLocation

// ── WYMInsight — matches the mockInsights shape in App.jsx ────────────────────

struct WYMInsight: Codable {
    let id: String
    let type: String         // "missed_moment" | "habit_loop" | "notification_noise" | "caught_in_loop" | "win"
    let severity: String?    // "high" | "medium" | "low"
    let icon: String
    let iconBg: String
    let title: String
    let subtitle: String?
    let detail: [String]?
    let tags: [String]?
    let hasMap: Bool?
    // For map-backed insights: the start/end coords are passed separately so
    // WebBridge can generate a snapshot before sending to React
    let mapStartLat: Double?
    let mapStartLon: Double?
    let mapEndLat: Double?
    let mapEndLon: Double?
    let barValue: Int?       // 0-100 for progress bar
    let barColor: String?
    let barLabel: String?
    let desc: String?        // for caught_in_loop cards
    let winDesc: String?     // for win cards
    let action: WYMAction?
}

struct WYMAction: Codable {
    let label: String
    let prompt: String
}

// ── Insight generation ────────────────────────────────────────────────────────

struct InsightEngine {

    // Main entry point — call from WebBridge before sending data to React.
    static func generateInsights(
        sessions: [LocationSession],
        usage: [InferredAppUsage],
        notificationEvents: [ScreenTimeStore.NotificationEvent]
    ) -> [WYMInsight] {
        var insights: [WYMInsight] = []
        var idCounter = 1
        func nextID() -> String { let id = "ins_\(String(format: "%03d", idCounter))"; idCounter += 1; return id }

        // 1. missed_moment: walking at scenic place while messaging/social use detected
        insights += missedWalkMoments(sessions: sessions, usage: usage, nextID: nextID)

        // 2. missed_moment: golden hour / sunrise overlapped with social-app session
        insights += missedGoldenHourMoments(sessions: sessions, usage: usage, nextID: nextID)

        // 3. caught_in_loop: meal-time heavy phone use
        insights += mealTimeSinkholes(usage: usage, nextID: nextID)

        // 4. habit_loop: apps opened many times with low intentionality
        insights += habitLoops(usage: usage, nextID: nextID)

        // 5. win: meal windows with no detected social/entertainment use
        insights += phoneFreeMealWins(sessions: sessions, usage: usage, nextID: nextID)

        // 6. notification_noise: apps with very low open rate
        insights += notificationNoiseInsight(events: notificationEvents, nextID: nextID)

        return insights
    }

    // MARK: - Pattern 1: Missed walk moment
    // Trigger: location session with motionType == .walking at a waterfront or park
    //          AND during that same hour window a messaging/social app threshold fired.

    private static func missedWalkMoments(
        sessions: [LocationSession],
        usage: [InferredAppUsage],
        nextID: () -> String
    ) -> [WYMInsight] {

        let scenicTypes: Set<PlaceType> = [.waterfront, .park]
        let thresholdEvents = ScreenTimeStore.loadThresholdEvents()

        return sessions.compactMap { session in
            guard session.motionType == .walking,
                  scenicTypes.contains(session.placeType),
                  session.durationMinutes >= 5
            else { return nil }

            let sessionHours = hoursSpanned(from: session.arrivalDate, to: session.departureDate)

            // Which messaging/social apps had threshold events during the walk?
            let activeApps = thresholdEvents
                .filter { sessionHours.contains($0.windowHour) }
                .filter { $0.category == .social }
                .map { $0.appName }
            let uniqueActiveApps = Array(Set(activeApps))

            guard !uniqueActiveApps.isEmpty else { return nil }

            let appList = uniqueActiveApps.prefix(2).joined(separator: " and ")
            let placeIcon = session.placeType == .waterfront ? "🌊" : "🌳"
            let formatter = DateFormatter()
            formatter.dateFormat = "h:mm a"

            return WYMInsight(
                id:       nextID(),
                type:     "missed_moment",
                severity: "high",
                icon:     placeIcon,
                iconBg:   "#E1F5EE",
                title:    "You walked \(session.placeName.components(separatedBy: ",").first ?? session.placeName) for \(session.durationMinutes) min while using \(appList)",
                subtitle: "Today, \(formatter.string(from: session.arrivalDate)) · \(session.placeName.components(separatedBy: ",").last?.trimmingCharacters(in: .whitespaces) ?? "")",
                detail:   [
                    "Phone was active during most of your \(session.durationMinutes)-minute walk",
                    "\(uniqueActiveApps.joined(separator: ", ")) detected during this window",
                    "This was a \(session.placeType.rawValue) location — worth being present for"
                ],
                tags:     [session.placeType.rawValue, "\(session.durationMinutes) min walk"] + uniqueActiveApps.prefix(1),
                hasMap:   true,
                mapStartLat: session.latitude - 0.001, // approximate start (real: need track points)
                mapStartLon: session.longitude - 0.001,
                mapEndLat:   session.latitude + 0.001,
                mapEndLon:   session.longitude + 0.001,
                barValue:    nil, barColor: nil, barLabel: nil,
                desc:        nil,
                winDesc:     nil,
                action: WYMAction(
                    label:  "Suggest how to be more present",
                    prompt: "Suggest ways I can be more present when walking at \(session.placeName)"
                )
            )
        }
    }

    // MARK: - Pattern 2: Missed golden hour / sunrise
    // Trigger: between 6:00–7:30 AM, a social or entertainment app threshold fired.
    // Golden hour is roughly 30 min after civil sunrise — we approximate with a fixed window.

    private static func missedGoldenHourMoments(
        sessions: [LocationSession],
        usage: [InferredAppUsage],
        nextID: () -> String
    ) -> [WYMInsight] {

        let thresholdEvents = ScreenTimeStore.loadThresholdEvents()
        let goldenHours = [6, 7] // 6 AM and 7 AM windows

        // Group by calendar day to avoid duplicate insights for the same morning
        let calendar = Calendar.current
        var seenDays = Set<String>()

        return thresholdEvents.compactMap { event in
            guard goldenHours.contains(event.windowHour),
                  event.category == .social || event.category == .entertainment
            else { return nil }

            let dayKey = calendar.startOfDay(for: event.firedAt).description
            guard seenDays.insert(dayKey).inserted else { return nil }

            let formatter = DateFormatter()
            formatter.dateFormat = "h:mm a"
            let timeStr = formatter.string(from: event.firedAt)

            let isYesterday = calendar.isDateInYesterday(event.firedAt)
            let dayLabel = isYesterday ? "Yesterday" : "Today"

            return WYMInsight(
                id:       nextID(),
                type:     "missed_moment",
                severity: "high",
                icon:     "🌅",
                iconBg:   "#FAEEDA",
                title:    "Perfect sunrise while you were using \(event.appName)",
                subtitle: "\(dayLabel), \(timeStr) · \(event.minutesThreshold)+ min session",
                detail:   [
                    "Golden hour typically lasts 20–40 min after sunrise",
                    "\(event.appName) usage detected during the 6–8 AM window",
                    "Consider a phone-free morning routine for these hours"
                ],
                tags:     ["golden hour", "6–8 AM", event.appName],
                hasMap:   false,
                mapStartLat: nil, mapStartLon: nil, mapEndLat: nil, mapEndLon: nil,
                barValue:    nil, barColor: nil, barLabel: nil,
                desc:        nil, winDesc:     nil,
                action: WYMAction(
                    label:  "Help me fix my mornings",
                    prompt: "How can I build a morning routine with less \(event.appName) time?"
                )
            )
        }
    }

    // MARK: - Pattern 3: Caught in a loop at meal time
    // Trigger: 12–13h (lunch) or 18–20h (dinner) window with entertainment/social threshold.

    private static func mealTimeSinkholes(
        usage: [InferredAppUsage],
        nextID: () -> String
    ) -> [WYMInsight] {

        let thresholdEvents = ScreenTimeStore.loadThresholdEvents()
        let lunchHours   = Set([12, 13])
        let dinnerHours  = Set([18, 19, 20])

        struct MealHit { let mealName: String; let app: String; let minutes: Int }

        var hits: [MealHit] = []

        for event in thresholdEvents {
            guard event.category == .entertainment || event.category == .social,
                  event.minutesThreshold >= 15
            else { continue }
            if lunchHours.contains(event.windowHour) {
                hits.append(MealHit(mealName: "Lunch", app: event.appName, minutes: event.minutesThreshold))
            } else if dinnerHours.contains(event.windowHour) {
                hits.append(MealHit(mealName: "Dinner", app: event.appName, minutes: event.minutesThreshold))
            }
        }

        // Deduplicate: one insight per meal per app
        var seen = Set<String>()
        return hits.compactMap { hit in
            let key = "\(hit.mealName)-\(hit.app)"
            guard seen.insert(key).inserted else { return nil }
            let icon = hit.mealName == "Lunch" ? "🥪" : "🍽️"
            return WYMInsight(
                id:       nextID(),
                type:     "caught_in_loop",
                severity: nil,
                icon:     icon,
                iconBg:   "#FEF2F2",
                title:    "\(hit.mealName) Break Sinkhole",
                subtitle: nil,
                detail:   nil,
                tags:     nil,
                hasMap:   false,
                mapStartLat: nil, mapStartLon: nil, mapEndLat: nil, mapEndLon: nil,
                barValue: nil, barColor: nil, barLabel: nil,
                desc:     "Spent \(hit.minutes)+ minutes on \(hit.app) during \(hit.mealName.lowercased()).",
                winDesc:  nil,
                action:   nil
            )
        }
    }

    // MARK: - Pattern 4: Habit loop
    // Trigger: an app accumulated threshold events across many hours (= many opens)
    //          with a low intentionality prior.

    private static func habitLoops(
        usage: [InferredAppUsage],
        nextID: () -> String
    ) -> [WYMInsight] {

        return usage.compactMap { u in
            // High habitual use = many active hours + low intentionality
            guard u.activeHours.count >= 4,
                  u.intentionalRatio < 0.5,
                  u.estimatedMinutes >= 30
            else { return nil }

            let dailyHours = fmtMinutes(u.estimatedMinutes)
            let barValue   = min(Int((Double(u.estimatedMinutes) / 120.0) * 100), 100)

            return WYMInsight(
                id:       nextID(),
                type:     "habit_loop",
                severity: "medium",
                icon:     u.app.category.icon,
                iconBg:   "#EEEDFE",
                title:    "\(u.app.name): \(dailyHours) daily — you rarely set out to open it",
                subtitle: "Mostly opened by habit, not intention",
                detail:   [
                    "Active across \(u.activeHours.count) different hours today",
                    "Average session: ~\(u.estimatedAvgSession) min. Intended: 1–2 min.",
                    "\(u.estimatedOpens) estimated opens across the day"
                ],
                tags:     ["\(u.estimatedOpens) opens/day", "\(u.estimatedAvgSession) min avg", "habit loop"],
                hasMap:   false,
                mapStartLat: nil, mapStartLon: nil, mapEndLat: nil, mapEndLon: nil,
                barValue: barValue,
                barColor: u.app.category.colorHex,
                barLabel: "\(dailyHours) / day",
                desc:     nil,
                winDesc:  nil,
                action: WYMAction(
                    label:  "Help me be intentional",
                    prompt: "Suggest a realistic plan to reduce mindless \(u.app.name) usage"
                )
            )
        }
    }

    // MARK: - Pattern 5: Phone-free meal win
    // Trigger: a meal window passed with no social/entertainment threshold events at all.

    private static func phoneFreeMealWins(
        sessions: [LocationSession],
        usage: [InferredAppUsage],
        nextID: () -> String
    ) -> [WYMInsight] {

        let thresholdEvents = ScreenTimeStore.loadThresholdEvents()
        let calendar = Calendar.current

        // Check this week's lunch (12-13h) and dinner (18-20h) windows
        var phoneFreeSlots: [String] = []

        for dayOffset in 0..<7 {
            guard let day = calendar.date(byAdding: .day, value: -dayOffset, to: Date()) else { continue }
            let dayEvents = thresholdEvents.filter { calendar.isDate($0.firedAt, inSameDayAs: day) }

            let lunchBusy  = dayEvents.contains { [12, 13].contains($0.windowHour)       && ($0.category == .social || $0.category == .entertainment) }
            let dinnerBusy = dayEvents.contains { [18, 19, 20].contains($0.windowHour)   && ($0.category == .social || $0.category == .entertainment) }

            let dayName = calendar.isDateInToday(day) ? "Today"
                : calendar.isDateInYesterday(day) ? "Yesterday"
                : dayAbbrev(day)

            if !lunchBusy  { phoneFreeSlots.append("\(dayName) lunch") }
            if !dinnerBusy { phoneFreeSlots.append("\(dayName) dinner") }
        }

        guard phoneFreeSlots.count >= 2 else { return [] }

        let count      = phoneFreeSlots.count
        let examples   = Array(phoneFreeSlots.prefix(3))
        let barValue   = min(Int((Double(count) / 14.0) * 100), 100)

        return [WYMInsight(
            id:       nextID(),
            type:     "win",
            severity: "low",
            icon:     "✅",
            iconBg:   "#E1F5EE",
            title:    "You had \(count) phone-free meal\(count == 1 ? "" : "s") this week",
            subtitle: "Keep it going",
            detail:   [
                examples.joined(separator: ", ") + " — all phone-free",
                "No social or entertainment apps detected during meal hours"
            ],
            tags:     examples,
            hasMap:   false,
            mapStartLat: nil, mapStartLon: nil, mapEndLat: nil, mapEndLon: nil,
            barValue: barValue,
            barColor: "#1D9E75",
            barLabel: "\(count) of 14 meals",
            desc:     nil,
            winDesc:  "You stayed off your phone during \(examples.first ?? "a meal"). Nice work.",
            action: WYMAction(
                label:  "Build on this habit",
                prompt: "How do I build a consistent habit of phone-free meals?"
            )
        )]
    }

    // MARK: - Pattern 6: Notification noise
    // Trigger: an app delivered many notifications this week but almost none were opened.

    private static func notificationNoiseInsight(
        events: [ScreenTimeStore.NotificationEvent],
        nextID: () -> String
    ) -> [WYMInsight] {

        guard !events.isEmpty else { return [] }

        // Group by bundle ID
        var byApp: [String: (delivered: Int, opened: Int)] = [:]
        for e in events {
            var stat = byApp[e.appBundleID] ?? (0, 0)
            stat.delivered += 1
            if e.wasOpened { stat.opened += 1 }
            byApp[e.appBundleID] = stat
        }

        // Apps with >10 deliveries and <15% open rate
        let noisy = byApp
            .filter { $0.value.delivered > 10 }
            .filter { Double($0.value.opened) / Double($0.value.delivered) < 0.15 }
            .sorted { $0.value.delivered > $1.value.delivered }

        guard !noisy.isEmpty else { return [] }

        let totalIgnored = noisy.values.map { $0.delivered - $0.opened }.reduce(0, +)
        let detailLines  = noisy.prefix(3).map { (bundleID, stat) in
            let appName  = bundleID.components(separatedBy: ".").last?.capitalized ?? bundleID
            let openRate = Int(Double(stat.opened) / Double(stat.delivered) * 100)
            return "\(appName): \(stat.delivered) notifications, only \(stat.opened) opened (\(openRate)% open rate)"
        }
        let tags = noisy.prefix(3).map { (bundleID, stat) in
            "\(stat.delivered) \(bundleID.components(separatedBy: ".").last?.capitalized ?? bundleID)"
        }

        return [WYMInsight(
            id:       nextID(),
            type:     "notification_noise",
            severity: "medium",
            icon:     "🔕",
            iconBg:   "#FCEBEB",
            title:    "\(totalIgnored) notifications you never opened this week",
            subtitle: "Across \(noisy.count) app\(noisy.count == 1 ? "" : "s") · possibly unnecessary distractions",
            detail:   detailLines,
            tags:     tags,
            hasMap:   false,
            mapStartLat: nil, mapStartLon: nil, mapEndLat: nil, mapEndLon: nil,
            barValue:    nil, barColor: nil, barLabel: nil,
            desc:        nil, winDesc: nil,
            action: WYMAction(
                label:  "Help me cut the noise",
                prompt: "Which of these notifications should I turn off to reduce distractions?"
            )
        )]
    }

    // MARK: - Helpers

    private static func hoursSpanned(from start: Date, to end: Date) -> Set<Int> {
        let cal   = Calendar.current
        let endDate = end == .distantFuture ? Date() : end
        var result = Set<Int>()
        var cursor = start
        while cursor <= endDate {
            result.insert(cal.component(.hour, from: cursor))
            cursor = cal.date(byAdding: .hour, value: 1, to: cursor) ?? endDate
        }
        return result
    }

    private static func fmtMinutes(_ m: Int) -> String {
        let h = m / 60; let min = m % 60
        if h == 0 { return "\(min)m" }
        if min == 0 { return "\(h)h" }
        return "\(h)h \(min)m"
    }

    private static func dayAbbrev(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "EEE"
        return f.string(from: date)
    }
}

// ── ScreenTime summary builder ────────────────────────────────────────────────
// Builds the `screenTime` object the React app reads (matches mockScreenTime shape).

struct ScreenTimeSummaryBuilder {

    static func buildSummary(usage: [InferredAppUsage], for date: Date = Date()) -> [String: Any] {
        let totalMinutes    = usage.map { $0.estimatedMinutes }.reduce(0, +)
        let mindlessMinutes = usage.filter { $0.intentionalRatio < 0.5 }
                                   .map { $0.estimatedMinutes }.reduce(0, +)
        let digitalPercent  = totalMinutes > 0 ? Int(Double(mindlessMinutes) / Double(totalMinutes) * 100) : 0

        let byApp: [[String: Any]] = usage.map { u in [
            "app":           u.app.name,
            "minutes":       u.estimatedMinutes,
            "opens":         u.estimatedOpens,
            "avgSession":    u.estimatedAvgSession,
            "intentional":   u.intentionalRatio
        ]}

        // Category totals
        var categoryTotals: [AppCategory: Int] = [:]
        for u in usage {
            categoryTotals[u.app.category, default: 0] += u.estimatedMinutes
        }
        let byCategory: [[String: Any]] = categoryTotals.map { cat, mins in [
            "category": cat.rawValue,
            "minutes":  mins,
            "color":    cat.colorHex,
            "icon":     cat.icon
        ]}.sorted { ($0["minutes"] as! Int) > ($1["minutes"] as! Int) }

        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMM d"

        return [
            "yesterday": [
                "date":             formatter.string(from: date),
                "digitalPercent":   digitalPercent,
                "totalMinutes":     totalMinutes,
                "mindlessMinutes":  mindlessMinutes,
            ] as [String: Any],
            "byApp":      byApp,
            "byCategory": byCategory,
            "dailyAverageMinutes": totalMinutes
        ]
    }
}
