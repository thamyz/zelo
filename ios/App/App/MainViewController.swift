import UIKit
import WebKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        MainViewController.removeKeyboardAccessoryBarOnce()
    }

    // Strips the up/down/checkmark "form navigation" bar WKWebView shows
    // above the keyboard for text inputs.
    //
    // This is a redo of an earlier attempt that got reverted: that version
    // used object_setClass() to reassign each WKContentView *instance* onto
    // a newly-allocated subclass just to override this one getter — that
    // changes the object's actual runtime identity, which is almost
    // certainly what broke tap-to-dismiss-keyboard and caused a stray
    // scrollbar last time (WebKit's own internal handling for that view may
    // rely on identity checks, or the instance may already have been
    // isa-swizzled by something else, e.g. KVO).
    //
    // This version never touches any instance's class. It patches the
    // *implementation* of inputAccessoryView directly on the shared
    // WKContentView class itself, once, class_replaceMethod (not
    // method_setImplementation on whatever class_getInstanceMethod happens
    // to find) so it's added directly on WKContentView even if WKContentView
    // doesn't define its own copy — never touching a superclass's shared
    // implementation. Nothing about resignFirstResponder,
    // becomeFirstResponder, or any other responder-chain method is touched.
    private static var didSwizzle = false
    private static func removeKeyboardAccessoryBarOnce() {
        guard !didSwizzle else { return }
        guard let contentViewClass = NSClassFromString("WKContentView") else { return }
        let selector: Selector = #selector(getter: UIResponder.inputAccessoryView)
        let block: @convention(block) (AnyObject) -> UIView? = { _ in nil }
        let implementation = imp_implementationWithBlock(block)
        class_replaceMethod(contentViewClass, selector, implementation, "@@:")
        didSwizzle = true
    }
}
