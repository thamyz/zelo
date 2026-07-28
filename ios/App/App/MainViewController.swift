import UIKit
import WebKit
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

        // WKContentView (the thing that supplies the accessory bar) is created
        // lazily once web content actually loads, so it doesn't exist yet at
        // this point — retry for a couple seconds until it shows up.
        var attempts = 0
        Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { [weak self] timer in
            attempts += 1
            let found = self?.removeKeyboardAccessoryBar() ?? false
            if found || attempts > 15 { timer.invalidate() }
        }
    }

    // Strips the up/down/checkmark "form navigation" bar WKWebView adds above
    // the keyboard for text inputs. Purely cosmetic — WebKit's private
    // WKContentView is the thing that supplies that bar, so this swaps its
    // instance to a dynamic subclass whose inputAccessoryView is nil.
    // Returns true once it has found (and patched) the content view.
    @discardableResult
    private func removeKeyboardAccessoryBar() -> Bool {
        guard let webView = webView else { return false }
        var found = false
        for subview in webView.scrollView.subviews {
            guard let contentViewClass = NSClassFromString("WKContentView"),
                  subview.isKind(of: contentViewClass) else { continue }

            let noAccessoryClassName = "\(NSStringFromClass(type(of: subview)))_NoInputAccessory"
            var noAccessoryClass: AnyClass? = NSClassFromString(noAccessoryClassName)
            if noAccessoryClass == nil {
                guard let originalClass = object_getClass(subview),
                      let newClass = objc_allocateClassPair(originalClass, noAccessoryClassName, 0)
                else { continue }
                if let method = class_getInstanceMethod(EmptyAccessoryDonor.self,
                                                          #selector(getter: EmptyAccessoryDonor.inputAccessoryView)) {
                    class_addMethod(newClass, #selector(getter: UIResponder.inputAccessoryView),
                                     method_getImplementation(method), method_getTypeEncoding(method))
                }
                objc_registerClassPair(newClass)
                noAccessoryClass = newClass
            }
            if let noAccessoryClass = noAccessoryClass {
                object_setClass(subview, noAccessoryClass)
                found = true
            }
        }
        return found
    }
}

// Donor method only — never instantiated. Its `inputAccessoryView` getter is
// copied onto WKContentView's dynamic subclass above.
private class EmptyAccessoryDonor: UIView {
    @objc override var inputAccessoryView: UIView? { return nil }
}
