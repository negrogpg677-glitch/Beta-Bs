import UIKit
import WebKit
import AudioToolbox

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        window = UIWindow(frame: UIScreen.main.bounds)
        window?.rootViewController = GameViewController()
        window?.makeKeyAndVisible()
        UIApplication.shared.isIdleTimerDisabled = true // écran toujours allumé en jeu
        return true
    }
}

/// Hôte du jeu : WKWebView plein écran qui charge le dossier « www » embarqué.
class GameViewController: UIViewController, WKScriptMessageHandler {
    var web: WKWebView!
    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.userContentController.add(self, name: "bridge")
        // pont natif : vibrations (navigator.vibrate n'existe pas sur iOS)
        cfg.userContentController.addUserScript(WKUserScript(source: "window.IOSBridge={vibrate:function(ms){window.webkit.messageHandlers.bridge.postMessage({t:'vibrate',ms:ms});}};", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web = WKWebView(frame: view.bounds, configuration: cfg)
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.isOpaque = false
        web.backgroundColor = .black
        view.addSubview(web)
        if let dir = Bundle.main.url(forResource: "www", withExtension: nil) {
            web.loadFileURL(dir.appendingPathComponent("index.html"), allowingReadAccessTo: dir)
        }
        NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.web.evaluateJavaScript("window.G&&G.onPause&&G.onPause()", completionHandler: nil) }
        NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.web.evaluateJavaScript("window.G&&G.onResume&&G.onResume()", completionHandler: nil) }
    }

    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let d = message.body as? [String: Any], (d["t"] as? String) == "vibrate" else { return }
        let ms = (d["ms"] as? Double) ?? 20
        let gen = UIImpactFeedbackGenerator(style: ms > 30 ? .heavy : .light)
        gen.impactOccurred()
    }
}
