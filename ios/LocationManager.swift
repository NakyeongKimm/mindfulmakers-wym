// LocationManager.swift
// Tracks where the user was and what they were doing (walking/stationary).
// Combines CoreLocation visits, CMMotionActivity, and MKLocalSearch to produce
// rich LocationSession objects that InsightEngine can correlate with screen time.
//
// Required Info.plist keys:
//   NSLocationAlwaysAndWhenInUseUsageDescription
//   NSMotionUsageDescription

import CoreLocation
import CoreMotion
import MapKit

// ── Data models ───────────────────────────────────────────────────────────────

// What the user was physically doing during a location session
enum MotionType: String, Codable {
    case walking   = "walking"
    case running   = "running"
    case stationary = "stationary"
    case driving   = "driving"
    case unknown   = "unknown"
}

// What kind of place this is — used to decide if a missed moment is meaningful
enum PlaceType: String, Codable {
    case waterfront = "waterfront"   // river, lake, harbor → 🌊 moments
    case park       = "park"          // park, trail → outdoor moments
    case restaurant = "restaurant"   // meal context → caught_in_loop detection
    case cafe       = "cafe"
    case home       = "home"
    case unknown    = "unknown"
}

// A complete record of one visit: where, when, how long, what the user was doing
struct LocationSession: Codable {
    let id: String             // UUID
    let placeName: String      // from reverse geocoding
    let placeType: PlaceType
    let latitude: Double
    let longitude: Double
    let arrivalDate: Date
    let departureDate: Date    // distantFuture if still there
    let motionType: MotionType
    var durationMinutes: Int {
        let end = departureDate == .distantFuture ? Date() : departureDate
        return Int(end.timeIntervalSince(arrivalDate) / 60)
    }
}

// Snapshot for generating a MapKit route preview image
struct RouteSnapshot {
    let image: UIImage
    let startCoord: CLLocationCoordinate2D
    let endCoord: CLLocationCoordinate2D
}

// ── Shared App Group storage ───────────────────────────────────────────────────

struct LocationStore {
    private static let groupID = "group.com.yourteam.wym"
    private static var defaults: UserDefaults { UserDefaults(suiteName: groupID)! }

    static func saveSessions(_ sessions: [LocationSession]) {
        let cutoff = Calendar.current.date(byAdding: .day, value: -7, to: Date())!
        let recent = sessions.filter { $0.arrivalDate > cutoff }
        defaults.set(try? JSONEncoder().encode(recent), forKey: "locationSessions")
    }

    static func loadSessions() -> [LocationSession] {
        guard let data = defaults.data(forKey: "locationSessions") else { return [] }
        return (try? JSONDecoder().decode([LocationSession].self, from: data)) ?? []
    }

    static func sessionsJSON() -> String {
        let data = (try? JSONEncoder().encode(loadSessions())) ?? Data()
        return String(data: data, encoding: .utf8) ?? "[]"
    }
}

// ── LocationManager ────────────────────────────────────────────────────────────

class LocationManager: NSObject, ObservableObject {
    private let clManager = CLLocationManager()
    private let geocoder  = CLGeocoder()
    private let motion    = CMMotionActivityManager()

    @Published var currentSession: LocationSession?
    @Published var recentSessions: [LocationSession] = []

    // WebBridge callback — fired on each new/updated session
    var onSessionUpdated: ((LocationSession) -> Void)?

    // Tracks the motion state at the time a CLVisit arrives
    private var lastMotionType: MotionType = .unknown

    override init() {
        super.init()
        clManager.delegate = self
        clManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        recentSessions = LocationStore.loadSessions()
    }

    // MARK: - Permissions & start

    func requestPermission() {
        clManager.requestAlwaysAuthorization()
    }

    // Starts visit monitoring + continuous motion tracking.
    // CLVisit fires when iOS detects the user arrived/departed somewhere.
    // CMMotionActivityManager gives us walking/driving/stationary context.
    func startTracking() {
        guard CLLocationManager.authorizationStatus() == .authorizedAlways else { return }
        clManager.startMonitoringVisits()
        startMotionTracking()
    }

    // MARK: - Motion tracking

    private func startMotionTracking() {
        guard CMMotionActivityManager.isActivityAvailable() else { return }

        motion.startActivityUpdates(to: .main) { [weak self] activity in
            guard let activity else { return }
            if activity.walking        { self?.lastMotionType = .walking }
            else if activity.running   { self?.lastMotionType = .running }
            else if activity.automotive { self?.lastMotionType = .driving }
            else if activity.stationary { self?.lastMotionType = .stationary }
        }
    }

    // MARK: - Place type detection via MKLocalSearch
    // Checks for nearby POIs to classify the location (waterfront, park, restaurant…)

    private func detectPlaceType(at coord: CLLocationCoordinate2D, completion: @escaping (PlaceType) -> Void) {
        let queries: [(String, PlaceType)] = [
            ("river OR lake OR harbor OR esplanade OR waterfront", .waterfront),
            ("park OR trail OR nature reserve",                    .park),
            ("restaurant OR diner OR food",                        .restaurant),
            ("cafe OR coffee",                                     .cafe),
        ]

        // Try each query in order; use the first match
        func tryNext(_ index: Int) {
            guard index < queries.count else { return completion(.unknown) }
            let (query, type) = queries[index]
            let request = MKLocalSearch.Request()
            request.naturalLanguageQuery = query
            request.region = MKCoordinateRegion(
                center: coord,
                latitudinalMeters: 150, longitudinalMeters: 150
            )
            MKLocalSearch(request: request).start { response, _ in
                if let results = response?.mapItems, !results.isEmpty {
                    completion(type)
                } else {
                    tryNext(index + 1)
                }
            }
        }
        tryNext(0)
    }

    // MARK: - Build a LocationSession from a CLVisit

    private func buildSession(from visit: CLVisit, placeName: String, placeType: PlaceType) -> LocationSession {
        return LocationSession(
            id:            UUID().uuidString,
            placeName:     placeName,
            placeType:     placeType,
            latitude:      visit.coordinate.latitude,
            longitude:     visit.coordinate.longitude,
            arrivalDate:   visit.arrivalDate,
            departureDate: visit.departureDate
        )
    }

    // MARK: - MapKit route snapshot
    // Used by InsightEngine to attach a real map image to missed_moment insights.

    func generateRouteSnapshot(
        from start: CLLocationCoordinate2D,
        to end: CLLocationCoordinate2D,
        size: CGSize = CGSize(width: 360, height: 160),
        completion: @escaping (UIImage?) -> Void
    ) {
        let options = MKMapSnapshotter.Options()

        let centerLat  = (start.latitude  + end.latitude)  / 2
        let centerLon  = (start.longitude + end.longitude) / 2
        let spanLat    = max(abs(start.latitude  - end.latitude)  * 2.5, 0.005)
        let spanLon    = max(abs(start.longitude - end.longitude) * 2.5, 0.005)

        options.region = MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: centerLat, longitude: centerLon),
            span:   MKCoordinateSpan(latitudeDelta: spanLat, longitudeDelta: spanLon)
        )
        options.size    = size
        options.mapType = .standard

        MKMapSnapshotter(options: options).start { snapshot, _ in
            guard let snapshot else { return completion(nil) }

            let image = UIGraphicsImageRenderer(size: size).image { _ in
                snapshot.image.draw(at: .zero)

                // Draw start pin (green)
                let startPt = snapshot.point(for: start)
                UIColor.systemGreen.setFill()
                UIBezierPath(ovalIn: CGRect(x: startPt.x - 6, y: startPt.y - 6, width: 12, height: 12)).fill()

                // Draw end pin (red)
                let endPt = snapshot.point(for: end)
                UIColor.systemRed.setFill()
                UIBezierPath(ovalIn: CGRect(x: endPt.x - 6, y: endPt.y - 6, width: 12, height: 12)).fill()
            }
            completion(image)
        }
    }
}

// ── CLLocationManagerDelegate ─────────────────────────────────────────────────

extension LocationManager: CLLocationManagerDelegate {

    // Fired by startMonitoringVisits() when iOS detects an arrival or departure.
    // We capture the current motion type at this moment for the session record.
    func locationManager(_ manager: CLLocationManager, didVisit visit: CLVisit) {
        let coord        = visit.coordinate
        let motionAtVisit = lastMotionType

        // Step 1: reverse geocode → place name
        geocoder.reverseGeocodeLocation(CLLocation(latitude: coord.latitude, longitude: coord.longitude)) { [weak self] placemarks, _ in
            guard let self else { return }

            let placeName = placemarks?.first.map { pm in
                [pm.name, pm.thoroughfare, pm.locality].compactMap { $0 }.joined(separator: ", ")
            } ?? "Unknown location"

            // Step 2: classify the place
            self.detectPlaceType(at: coord) { placeType in

                // Step 3: build and persist the session
                var session = self.buildSession(from: visit, placeName: placeName, placeType: placeType)
                // Inject motion type (stored struct is immutable, rebuild)
                session = LocationSession(
                    id:            session.id,
                    placeName:     session.placeName,
                    placeType:     session.placeType,
                    latitude:      session.latitude,
                    longitude:     session.longitude,
                    arrivalDate:   session.arrivalDate,
                    departureDate: session.departureDate,
                    motionType:    motionAtVisit
                )

                DispatchQueue.main.async {
                    self.recentSessions.removeAll { $0.arrivalDate == session.arrivalDate }
                    self.recentSessions.append(session)
                    LocationStore.saveSessions(self.recentSessions)
                    self.currentSession = session
                    self.onSessionUpdated?(session)
                }
            }
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if manager.authorizationStatus == .authorizedAlways { startTracking() }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Location error: \(error.localizedDescription)")
    }
}
