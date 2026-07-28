import UIKit
import WebKit
import Capacitor

// Locks the WKWebView's own pinch-zoom out at the native/UIScrollView level.
// CSS-side fixes (16px inputs, no user-scalable=no) don't reliably stop
// WKWebView from bumping its scrollView zoomScale when the keyboard opens —
// that auto-zoom is driven by the scroll view itself, not by the page.
//
// A ONE-TIME assignment in viewDidLoad isn't enough: WKWebView re-derives
// minimumZoomScale/maximumZoomScale from the page's viewport meta tag once
// the page actually finishes loading (which happens after viewDidLoad
// returns), silently clobbering whatever we set here first. So instead of
// setting it once, keep re-asserting it for the life of the view — cheap,
// and it wins every time something tries to widen the zoom bounds back out.
class MainViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()

        var accessoryBarPatched = false
        Timer.scheduledTimer(withTimeInterval: 0.3, repeats: true) { [weak self] timer in
            guard let self = self, let scrollView = self.webView?.scrollView else { return }
            scrollView.minimumZoomScale = 1.0
            scrollView.maximumZoomScale = 1.0
            scrollView.bouncesZoom = false
            scrollView.pinchGestureRecognizer?.isEnabled = false
            if scrollView.zoomScale != 1.0 { scrollView.setZoomScale(1.0, animated: false) }
            if !accessoryBarPatched {
                accessoryBarPatched = self.removeKeyboardAccessoryBar()
            }
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
