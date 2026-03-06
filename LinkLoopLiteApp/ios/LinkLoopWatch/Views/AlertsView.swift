import SwiftUI

struct AlertsView: View {
    @EnvironmentObject var glucoseManager: GlucoseManager

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "bell.badge.fill")
                    .foregroundColor(.orange)
                Text("Alerts")
                    .font(.system(size: 14, weight: .semibold))
            }

            if glucoseManager.activeAlertCount > 0 {
                VStack(spacing: 6) {
                    ForEach(0..<min(glucoseManager.activeAlertCount, 3), id: \.self) { i in
                        HStack {
                            Circle()
                                .fill(Color.orange)
                                .frame(width: 8, height: 8)
                            Text("Active alert")
                                .font(.system(size: 12))
                                .foregroundColor(.white)
                            Spacer()
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.orange.opacity(0.15))
                        .cornerRadius(8)
                    }
                }
                .padding(.horizontal, 4)

                Text("Open iPhone for details")
                    .font(.system(size: 10))
                    .foregroundColor(.gray)
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 32))
                        .foregroundColor(.green)
                    Text("No active alerts")
                        .font(.system(size: 13))
                        .foregroundColor(.gray)
                }
                .padding(.top, 16)
            }
        }
        .padding(.vertical, 4)
    }
}
