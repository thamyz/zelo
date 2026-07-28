import UIKit
import WebKit
import Capacitor

// NOTE: an earlier version of this file also locked the WKWebView's native
// UIScrollView pinch-zoom (minimumZoomScale/maximumZoomScale/pinchGesture).
// Turned out to be the wrong lever — it didn't stop the auto-zoom-on-focus
// bug at all (that's driven by WebKit's private focused-input handling, not
// the public pinch-zoom gesture system) and it broke tap-to-dismiss-keyboard
// and introduced an unwanted scrollbar as a side effect. Removed.
class MainViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()

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
