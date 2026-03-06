import SwiftUI

@main
struct LinkLoopWatchApp: App {
    @StateObject private var glucoseManager = GlucoseManager()
    @StateObject private var connectivityManager = ConnectivityManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(glucoseManager)
                .environmentObject(connectivityManager)
                .onAppear {
                    connectivityManager.onTokenReceived = { token in
                        glucoseManager.setAuthToken(token)
                    }
                    connectivityManager.onThresholdsReceived = { low, high in
                        glucoseManager.lowThreshold = low
                        glucoseManager.highThreshold = high
                    }
                    connectivityManager.onRoleReceived = { role, linkedOwnerId in
                        glucoseManager.setRole(role, linkedOwnerId: linkedOwnerId)
                    }
                    connectivityManager.activate()

                    // Safety net: re-check context after a short delay
                    // in case activationDidComplete fired before callbacks were wired
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                        if !glucoseManager.isConnected {
                            connectivityManager.recheckContext()
                        }
                    }
                }
        }
    }
}
