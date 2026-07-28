import UIKit
import Capacitor

// Locks the WKWebView's own pinch-zoom out at the native/UIScrollView level.
// CSS-side fixes (16px inputs, no user-scalable=no) don't reliably stop
// WKWebView from bumping its scrollView zoomScale when the keyboard opens —
// that auto-zoom is driven by the scroll view itself, not by the page.
class MainViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        webView?.scrollView.minimumZoomScale = 1.0
        webView?.scrollView.maximumZoomScale = 1.0
        webView?.scrollView.bouncesZoom = false
        webView?.scrollView.pinchGestureRecognizer?.isEnabled = false
    }
}
