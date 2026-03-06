import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var glucoseManager: GlucoseManager
    @EnvironmentObject var connectivityManager: ConnectivityManager

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                // Connection status
                HStack {
                    Image(systemName: glucoseManager.isConnected ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundColor(glucoseManager.isConnected ? .green : .red)
                    Text(glucoseManager.isConnected ? "Connected" : "Not Connected")
                        .font(.system(size: 13, weight: .semibold))
                }

                // Phone reachability
                HStack {
                    Image(systemName: "iphone")
                        .foregroundColor(connectivityManager.isPhoneReachable ? .blue : .gray)
                    Text(connectivityManager.isPhoneReachable ? "Phone nearby" : "Phone not in range")
                        .font(.system(size: 12))
                        .foregroundColor(.gray)
                }

                Divider()

                // Thresholds
                VStack(spacing: 4) {
                    Text("Thresholds")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.gray)

                    HStack {
                        VStack {
                            Text("Low")
                                .font(.system(size: 10))
                                .foregroundColor(.red)
                            Text("\(glucoseManager.lowThreshold)")
                                .font(.system(size: 16, weight: .bold, design: .rounded))
                                .foregroundColor(.red)
                        }
                        .frame(maxWidth: .infinity)

                        VStack {
                            Text("High")
                                .font(.system(size: 10))
                                .foregroundColor(.orange)
                            Text("\(glucoseManager.highThreshold)")
                                .font(.system(size: 16, weight: .bold, design: .rounded))
                                .foregroundColor(.orange)
                        }
                        .frame(maxWidth: .infinity)
                    }

                    Text("Set thresholds in\niPhone app")
                        .font(.system(size: 10))
                        .foregroundColor(.gray.opacity(0.7))
                        .multilineTextAlignment(.center)
                }

                Divider()

                // Refresh button
                Button(action: {
                    Task { await glucoseManager.refreshAll() }
                }) {
                    HStack {
                        Image(systemName: "arrow.clockwise")
                        Text("Refresh Now")
                            .font(.system(size: 13))
                    }
                }
                .buttonStyle(.bordered)
                .tint(.blue)

                // Sync token button
                if !glucoseManager.isConnected {
                    Button(action: {
                        connectivityManager.requestToken()
                    }) {
                        HStack {
                            Image(systemName: "arrow.triangle.2.circlepath")
                            Text("Sync from iPhone")
                                .font(.system(size: 13))
                        }
                    }
                    .buttonStyle(.bordered)
                    .tint(.green)
                }

                // Error message
                if let error = glucoseManager.errorMessage {
                    Text(error)
                        .font(.system(size: 11))
                        .foregroundColor(.red)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal, 4)
        }
    }
}
