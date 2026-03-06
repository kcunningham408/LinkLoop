import SwiftUI

struct GraphView: View {
    @EnvironmentObject var glucoseManager: GlucoseManager

    var body: some View {
        VStack(spacing: 4) {
            Text("3-Hour Trend")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.gray)

            if glucoseManager.recentReadings.count >= 2 {
                GlucoseSparkline(
                    readings: glucoseManager.recentReadings,
                    lowThreshold: glucoseManager.lowThreshold,
                    highThreshold: glucoseManager.highThreshold
                )
                .frame(height: 100)
                .padding(.horizontal, 4)

                // Stats row
                if let stats = glucoseManager.stats {
                    HStack {
                        if let min = stats.min {
                            StatPill(label: "Lo", value: "\(min)", color: min < glucoseManager.lowThreshold ? .red : .gray)
                        }
                        if let avg = stats.average {
                            StatPill(label: "Avg", value: "\(Int(avg))", color: .blue)
                        }
                        if let max = stats.max {
                            StatPill(label: "Hi", value: "\(max)", color: max > glucoseManager.highThreshold ? .orange : .gray)
                        }
                    }
                }
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "chart.xyaxis.line")
                        .font(.system(size: 32))
                        .foregroundColor(.blue.opacity(0.4))
                    Text("Not enough data")
                        .font(.system(size: 12))
                        .foregroundColor(.gray)
                }
                .frame(height: 100)
            }

            // Time in range
            if let tir = glucoseManager.stats?.timeInRange {
                HStack(spacing: 4) {
                    Circle()
                        .fill(Color.green)
                        .frame(width: 6, height: 6)
                    Text("\(Int(tir))% in range")
                        .font(.system(size: 11))
                        .foregroundColor(.green)
                }
            }
        }
        .padding(.vertical, 4)
        .onAppear {
            Task { await glucoseManager.fetchReadings(hours: 3) }
        }
    }
}

// MARK: - Sparkline
struct GlucoseSparkline: View {
    let readings: [GlucoseReading]
    let lowThreshold: Int
    let highThreshold: Int

    var body: some View {
        GeometryReader { geo in
            let values = readings.map { $0.value }
            let minVal = max((values.min() ?? 40) - 10, 30)
            let maxVal = min((values.max() ?? 300) + 10, 420)
            let range = Double(maxVal - minVal)

            ZStack {
                // Low threshold line
                let lowY = geo.size.height * (1 - CGFloat(Double(lowThreshold - minVal) / range))
                Path { path in
                    path.move(to: CGPoint(x: 0, y: lowY))
                    path.addLine(to: CGPoint(x: geo.size.width, y: lowY))
                }
                .stroke(Color.red.opacity(0.3), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))

                // High threshold line
                let highY = geo.size.height * (1 - CGFloat(Double(highThreshold - minVal) / range))
                Path { path in
                    path.move(to: CGPoint(x: 0, y: highY))
                    path.addLine(to: CGPoint(x: geo.size.width, y: highY))
                }
                .stroke(Color.orange.opacity(0.3), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))

                // In-range zone
                Rectangle()
                    .fill(Color.green.opacity(0.08))
                    .frame(height: max(0, lowY - highY))
                    .offset(y: highY - geo.size.height / 2 + max(0, lowY - highY) / 2)

                // Glucose line
                Path { path in
                    for (index, reading) in readings.enumerated() {
                        let x = geo.size.width * CGFloat(index) / CGFloat(max(readings.count - 1, 1))
                        let y = geo.size.height * (1 - CGFloat(Double(reading.value - minVal) / range))
                        if index == 0 {
                            path.move(to: CGPoint(x: x, y: y))
                        } else {
                            path.addLine(to: CGPoint(x: x, y: y))
                        }
                    }
                }
                .stroke(Color.blue, lineWidth: 2)

                // Current value dot
                if let last = readings.last {
                    let x = geo.size.width
                    let y = geo.size.height * (1 - CGFloat(Double(last.value - minVal) / range))
                    Circle()
                        .fill(glucoseColor(last.value))
                        .frame(width: 6, height: 6)
                        .position(x: x, y: y)
                }
            }
        }
    }

    private func glucoseColor(_ value: Int) -> Color {
        if value < lowThreshold { return .red }
        if value > highThreshold { return .orange }
        return .green
    }
}

// MARK: - Stat Pill
struct StatPill: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 1) {
            Text(label)
                .font(.system(size: 9))
                .foregroundColor(.gray)
            Text(value)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(color)
        }
        .frame(maxWidth: .infinity)
    }
}
