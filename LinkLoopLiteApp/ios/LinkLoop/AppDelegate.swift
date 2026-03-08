import Expo
import React
import ReactAppDependencyProvider
import BackgroundTasks

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  /// BGTask identifier for background glucose refresh
  private static let bgGlucoseTaskId = "com.vibecmd.linkloop.glucoseRefresh"

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    // Activate WatchConnectivity after RN starts (deferred to avoid blocking launch)
    DispatchQueue.main.async {
      WatchSessionManager.shared.activate()
    }

    // Register background glucose refresh task
    BGTaskScheduler.shared.register(
      forTaskWithIdentifier: Self.bgGlucoseTaskId,
      using: nil
    ) { task in
      self.handleBackgroundGlucoseRefresh(task: task as! BGAppRefreshTask)
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }

  // Push Watch context every time app comes to foreground
  public override func applicationDidBecomeActive(_ application: UIApplication) {
    super.applicationDidBecomeActive(application)
    WatchSessionManager.shared.pushContextToWatch()
    WatchSessionManager.shared.startGlucosePushTimer()
  }

  public override func applicationWillResignActive(_ application: UIApplication) {
    super.applicationWillResignActive(application)
    // Do one final glucose push before stopping the foreground timer
    WatchSessionManager.shared.pushGlucoseToWatch()
    WatchSessionManager.shared.stopGlucosePushTimer()
  }

  public override func applicationDidEnterBackground(_ application: UIApplication) {
    super.applicationDidEnterBackground(application)
    scheduleBackgroundGlucoseRefresh()
  }

  // MARK: - Background Glucose Refresh

  /// Schedule a background app-refresh task so we can push glucose to the Watch
  /// even when the iPhone app isn't in the foreground.
  private func scheduleBackgroundGlucoseRefresh() {
    let request = BGAppRefreshTaskRequest(identifier: Self.bgGlucoseTaskId)
    // Request earliest: 5 minutes (Apple may delay to ~15 min, but this is the hint)
    request.earliestBeginDate = Date(timeIntervalSinceNow: 5 * 60)
    do {
      try BGTaskScheduler.shared.submit(request)
      print("[AppDelegate] Scheduled background glucose refresh")
    } catch {
      print("[AppDelegate] Could not schedule bg glucose refresh: \(error)")
    }
  }

  /// Called by the system when it's time for a background glucose push.
  private func handleBackgroundGlucoseRefresh(task: BGAppRefreshTask) {
    // Schedule the next refresh before doing work
    scheduleBackgroundGlucoseRefresh()

    // Set an expiration handler
    task.expirationHandler = {
      print("[AppDelegate] Background glucose refresh expired")
      task.setTaskCompleted(success: false)
    }

    // Push glucose to Watch
    WatchSessionManager.shared.pushGlucoseToWatch()

    // Give the network request a few seconds to complete, then mark done
    DispatchQueue.main.asyncAfter(deadline: .now() + 8.0) {
      task.setTaskCompleted(success: true)
      print("[AppDelegate] Background glucose refresh completed")
    }
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
