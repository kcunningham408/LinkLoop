import Foundation

struct GlucoseReading: Codable, Identifiable {
    let id: String?
    let value: Int
    let trend: String?
    let source: String?
    let timestamp: String?
    let createdAt: String?

    var date: Date? {
        let dateString = timestamp ?? createdAt ?? ""
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: dateString) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: dateString)
    }

    var trendArrow: String {
        switch trend?.lowercased() {
        case "rising", "risingfast", "rising_fast":
            return "↑"
        case "risingslightly", "rising_slightly":
            return "↗"
        case "falling", "fallingfast", "falling_fast":
            return "↓"
        case "fallingslightly", "falling_slightly":
            return "↘"
        case "stable", "flat":
            return "→"
        default:
            return "→"
        }
    }

    var minutesAgo: Int {
        guard let date = date else { return 0 }
        return Int(Date().timeIntervalSince(date) / 60)
    }
}

struct GlucoseStats: Codable {
    let average: Double?
    let min: Int?
    let max: Int?
    let count: Int?
    let timeInRange: Double?
    let timeLow: Double?
    let timeHigh: Double?
}

struct GlucoseLatestResponse: Codable {
    let value: Int?
    let trend: String?
    let source: String?
    let timestamp: String?
    let createdAt: String?
}

struct GlucoseStatsResponse: Codable {
    let stats: GlucoseStats?
    let readings: [GlucoseReading]?
}

struct MemberViewResponse: Codable {
    let readings: [GlucoseReading]?
    let latest: GlucoseReading?
    let stats: GlucoseStats?
    let ownerName: String?
}
