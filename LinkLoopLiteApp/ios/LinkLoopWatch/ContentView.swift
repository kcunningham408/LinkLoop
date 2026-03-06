import SwiftUI

struct ContentView: View {
    @EnvironmentObject var glucoseManager: GlucoseManager

    var body: some View {
        TabView {
            GlucoseView()
            GraphView()
            AlertsView()
            SettingsView()
        }
        .tabViewStyle(.verticalPage)
    }
}
