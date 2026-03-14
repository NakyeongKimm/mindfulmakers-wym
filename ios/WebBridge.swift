// WebBridge.swift
// Hosts the React app in a WKWebView and bridges native data into it.
//
// On launch the bridge:
//   1. Loads all persisted data (LocationStore, ScreenTimeStore)
//   2. Runs InsightEngine to generate WYMInsight objects
//   3. Sends a single "initialData" message to the React app
//      with the same shape as mockScreenTime / mockInsights
//
// The React app can also request fresh data at any time via:
//   window.webkit.messageHandlers.wym.postMessage({ type: "..." })

import SwiftUI
import WebKit
import CoreLocation

// ── JS → Native request types ─────────────────────────────────────────────────

enum NativeRequest: String {
    case fetchInitialData    // React asks for full data payload on mount
    case fetchLocation       // React asks for current lat/lon/name
    case fetchVisits         // React asks for recent LocationSession list
    case applyRule           // React's Rules screen toggled a rule ON
    case removeRestrictions  // React's Rules screen toggled a rule OFF
}

// ── SwiftUI wrapper ───────────────────────────────────────────────────────────

struct WYMWebView: UIViewRepresentable {
    let locationManager: LocationManager
    let restrictionManager: AppRestrictionManager

    func makeCoordinator() -> Coordinator {
        Coordinator(locationManager: locationManager, restrictionManager: restrictionManager)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(context.coordinator, name: "wym")

        let webView = WKWebView(frame: .zero, configuration: config)
        context.coordinator.webView = webView

        // Push new location/visit data to React whenever it arrives
        locationManager.onSessionUpdated = { session in
            context.coordinator.pushFreshInsights()
        }

        // Load app
        #if DEBUG
        webView.load(URLRequest(url: URL(string: "http://localhost:3000")!))
        #else
        if let url = Bundle.main.url(forResource: "index", withExtension: "html",
                                     subdirectory: "build") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        #endif

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}
}

// ── Coordinator: JS ↔ Native messaging ───────────────────────────────────────

class Coordinator: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?
    let locationManager: LocationManager
    let restrictionManager: AppRestrictionManager

    init(locationManager: LocationManager, restrictionManager: AppRestrictionManager) {
        self.locationManager    = locationManager
        self.restrictionManager = restrictionManager
    }

    // Receive message from JS:
    //   window.webkit.messageHandlers.wym.postMessage({ type: "fetchInitialData" })
    func userContentController(_ controller: WKUserContentController,
                                didReceive message: WKScriptMessage) {
        guard let body     = message.body as? [String: Any],
              let typeStr  = body["type"] as? String,
              let request  = NativeRequest(rawValue: typeStr)
        else { return }

        switch request {
        case .fetchInitialData:
            sendInitialData()

        case .fetchLocation:
            locationManager.fetchCurrentLocation()
            // Response is async — arrives via locationManager.onSessionUpdated → pushFreshInsights()

        case .fetchVisits:
            let sessions = LocationStore.loadSessions()
            if let data  = try? JSONEncoder().encode(sessions),
               let json  = String(data: data, encoding: .utf8) {
                sendRaw(type: "visitsUpdate", rawPayload: json)
            }

        case .applyRule:
            // body["selection"] would carry a serialized FamilyActivitySelection token
            // Full implementation: decode token, call restrictionManager.blockApps(selection:)
            sendPayload(type: "ruleApplied", payload: ["success": true])

        case .removeRestrictions:
            restrictionManager.removeRestrictions()
            sendPayload(type: "restrictionsRemoved", payload: ["success": true])
        }
    }

    // MARK: - Build and send the full data payload

    // Sends the complete screenTime + insights JSON that replaces all mock data in React.
    // Called on first load and whenever new location data arrives.
    func sendInitialData() {
        let sessions          = LocationStore.loadSessions()
        let thresholdEvents   = ScreenTimeStore.loadThresholdEvents()
        let notifEvents       = ScreenTimeStore.loadNotificationEvents()
        let usage             = inferDailyUsage(from: thresholdEvents, for: Date())

        let insights          = InsightEngine.generateInsights(
            sessions:              sessions,
            usage:                 usage,
            notificationEvents:    notifEvents
        )
        let screenTimeSummary = ScreenTimeSummaryBuilder.buildSummary(usage: usage)

        guard let insightsData = try? JSONEncoder().encode(insights),
              let insightsJSON = String(data: insightsData, encoding: .utf8)
        else { return }

        // screenTimeSummary is already a [String: Any] — serialize manually
        guard let summaryData = try? JSONSerialization.data(withJSONObject: screenTimeSummary),
              let summaryJSON = String(data: summaryData, encoding: .utf8)
        else { return }

        // Single message carrying both blobs — React destructures in nativeBridge.js
        let combinedJS = """
        if (window.WYMBridge?.onMessage) {
            window.WYMBridge.onMessage({
                type: 'initialData',
                payload: {
                    screenTime: \(summaryJSON),
                    insights:   \(insightsJSON)
                }
            });
        }
        """
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(combinedJS, completionHandler: nil)
        }
    }

    // Called when a new LocationSession arrives — regenerates insights with fresh data
    func pushFreshInsights() {
        sendInitialData()
    }

    // MARK: - For map-backed insights, generate a MapKit snapshot and send as base64

    func sendMapSnapshot(for insight: WYMInsight) {
        guard insight.hasMap == true,
              let startLat = insight.mapStartLat, let startLon = insight.mapStartLon,
              let endLat   = insight.mapEndLat,   let endLon   = insight.mapEndLon
        else { return }

        let start = CLLocationCoordinate2D(latitude: startLat, longitude: startLon)
        let end   = CLLocationCoordinate2D(latitude: endLat,   longitude: endLon)

        locationManager.generateRouteSnapshot(from: start, to: end) { [weak self] image in
            guard let image,
                  let pngData = image.pngData()
            else { return }

            let base64 = pngData.base64EncodedString()
            self?.sendRaw(
                type:       "mapSnapshot",
                rawPayload: "{ \"insightId\": \"\(insight.id)\", \"base64\": \"\(base64)\" }"
            )
        }
    }

    // MARK: - Low-level send helpers

    func sendPayload(type: String, payload: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8)
        else { return }
        sendRaw(type: type, rawPayload: json)
    }

    func sendRaw(type: String, rawPayload: String) {
        let js = """
        if (window.WYMBridge?.onMessage) {
            window.WYMBridge.onMessage({ type: '\(type)', payload: \(rawPayload) });
        }
        """
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    // One-shot location fetch response (used by fetchLocation request)
    func fetchCurrentLocation() {
        locationManager.fetchCurrentLocation()
        // CLLocationManagerDelegate will call onSessionUpdated → pushFreshInsights
    }
}

// ── ContentView ───────────────────────────────────────────────────────────────

struct ContentView: View {
    @StateObject private var locationManager   = LocationManager()
    @StateObject private var authManager       = ScreenTimeAuthManager()
    @StateObject private var screenTimeMonitor = ScreenTimeMonitor()
    private let restrictionManager             = AppRestrictionManager()

    @State private var appSelection = FamilyActivitySelection()

    var body: some View {
        WYMWebView(locationManager: locationManager, restrictionManager: restrictionManager)
            .ignoresSafeArea()
            .task {
                locationManager.requestPermission()
                await authManager.requestAuthorization()
                if authManager.isAuthorized {
                    screenTimeMonitor.startDailyMonitoring(selection: appSelection)
                }
            }
    }
}
