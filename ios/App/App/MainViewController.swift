import UIKit
import WebKit
import Capacitor

// Receives the web app's "I'm painted and ready" signal (script.js's
// _signalNativeReady -> webkit.messageHandlers.zeloReady). A separate class
// so WKUserContentController's strong reference to its handler doesn't
// retain the view controller.
private final class LaunchReadyHandler: NSObject, WKScriptMessageHandler {
    private let onReady: () -> Void
    init(_ onReady: @escaping () -> Void) { self.onReady = onReady }
    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) { onReady() }
}

// Receives the chat composer's emoji button (script.js openEmojiKeyboard ->
// webkit.messageHandlers.zeloEmoji). Separate class for the same retain
// reason as LaunchReadyHandler.
private final class EmojiKeyboardHandler: NSObject, WKScriptMessageHandler {
    private let onMessage: () -> Void
    init(_ onMessage: @escaping () -> Void) { self.onMessage = onMessage }
    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) { onMessage() }
}

class MainViewController: CAPBridgeViewController {
    private var launchOverlay: UIView?

    override func viewDidLoad() {
        super.viewDidLoad()
        MainViewController.removeKeyboardAccessoryBarOnce()
        MainViewController.installEmojiKeyboardHookOnce()
        applyLaunchBackgroundColor()
        installLaunchOverlay()
        webView?.configuration.userContentController.add(
            EmojiKeyboardHandler { [weak self] in self?.showEmojiKeyboard() },
            name: "zeloEmoji")
    }

    // The iOS launch screen (LaunchScreen.storyboard: centered app icon on
    // the brand background) is only on screen until this view controller's
    // first frame — after that, the WKWebView is blank until index.html has
    // actually loaded and painted, which used to read as a dead dark screen
    // for a second or two. This keeps the SAME icon, same size, same spot,
    // on top of the web view through that gap so it looks like one
    // continuous launch screen, then fades it out once script.js reports
    // it has painted (with a hard timeout so a page that never reports
    // in can't leave the icon up forever).
    private func installLaunchOverlay() {
        let overlay = UIView(frame: view.bounds)
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        overlay.backgroundColor = launchBackgroundColor()
        overlay.isUserInteractionEnabled = false

        let icon = UIImageView(image: UIImage(named: "LaunchIcon"))
        icon.frame = CGRect(x: 0, y: 0, width: 120, height: 120)
        icon.center = CGPoint(x: overlay.bounds.midX, y: overlay.bounds.midY)
        icon.autoresizingMask = [.flexibleLeftMargin, .flexibleRightMargin, .flexibleTopMargin, .flexibleBottomMargin]
        overlay.addSubview(icon)

        view.addSubview(overlay)
        launchOverlay = overlay

        webView?.configuration.userContentController.add(
            LaunchReadyHandler { [weak self] in self?.dismissLaunchOverlay() },
            name: "zeloReady")
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { [weak self] in
            self?.dismissLaunchOverlay()
        }
    }

    private func dismissLaunchOverlay() {
        guard let overlay = launchOverlay else { return }
        launchOverlay = nil
        UIView.animate(withDuration: 0.25, animations: { overlay.alpha = 0 },
                       completion: { _ in overlay.removeFromSuperview() })
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        if traitCollection.userInterfaceStyle != previousTraitCollection?.userInterfaceStyle {
            applyLaunchBackgroundColor()
        }
    }

    // Capacitor's own `backgroundColor` config option only ever accepts one
    // fixed hex string — there's no way to make that itself follow the
    // system Light/Dark setting. A hardcoded white there was tried first and
    // was wrong: on a dark-mode device it meant the WKWebView's own
    // background (separate from the LaunchScreen storyboard, whose own
    // background is the adaptive `LaunchBackground` color set) rendered white
    // regardless, until style.css's own dark-mode rules finished loading and
    // painted over it — the exact "always white first" bug this replaces.
    // These two hex values are style.css's own --bg token for each mode
    // (light: #ffffff, dark: #15130f — see the `:root` / `prefers-color-scheme`
    // block there) so this never drifts out of sync with what the web
    // content itself will paint a moment later.
    //
    // This still can't know about an in-app Light/Dark override (Settings >
    // Personalization > Appearance) that disagrees with the OS setting —
    // that's stored in the WKWebView's own localStorage, which doesn't exist
    // yet at this point in native launch. Following the OS setting is the
    // correct default for the vast majority of users who never touch that
    // override; the JS side's own inline <script> in index.html's <head>
    // (already there before this) re-applies the in-app override the moment
    // the web content itself paints, same as it always did.
    private func launchBackgroundColor() -> UIColor {
        traitCollection.userInterfaceStyle == .dark
            ? UIColor(red: 0x15/255.0, green: 0x13/255.0, blue: 0x0f/255.0, alpha: 1)
            : UIColor.white
    }

    private func applyLaunchBackgroundColor() {
        let color = launchBackgroundColor()
        launchOverlay?.backgroundColor = color
        view.backgroundColor = color
        webView?.backgroundColor = color
        webView?.scrollView.backgroundColor = color
        webView?.isOpaque = true
        // underPageBackgroundColor (iOS 15.4+) is the specific color WKWebView
        // paints BEFORE the page itself has anything to show — .backgroundColor
        // alone doesn't cover this gap. Missing this was the actual cause of a
        // brief white flash observed on a real device in dark mode right as
        // native launch handed off to the web content, even with the above
        // three lines already in place.
        if #available(iOS 15.4, *) {
            webView?.underPageBackgroundColor = color
        }
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

    // MARK: Emoji keyboard
    //
    // A web page can't pick which keyboard iOS shows — only the user can, with
    // the globe/smiley key. Natively, a text view CAN: iOS asks the focused
    // responder for its `textInputMode`, and answering with the emoji mode
    // brings up the emoji page. The focused responder for a web <input> is
    // WebKit's own WKContentView, so — same technique as the accessory-bar
    // patch above — its `textInputMode` (and `textInputContextIdentifier`,
    // which iOS needs non-nil before it honours a custom mode) are patched
    // once on the class. While `emojiKeyboardOn` is false they call straight
    // through to the original, so every other field behaves exactly as before.
    //
    // The web <input> stays focused the whole time, so emoji go straight into
    // it as ordinary typing (its `input` event fires, the send button appears)
    // and the keyboard-avoidance nudge in script.js keeps the composer up.
    // The flag is only on for a moment around the switch; after that iOS's own
    // "last used keyboard" memory takes over, so tapping ABC returns to letters
    // normally and the next focus doesn't get stuck on emoji.
    private static var emojiKeyboardOn = false
    private static var didSwizzleEmoji = false

    private static func emojiInputMode() -> UITextInputMode? {
        UITextInputMode.activeInputModes.first { $0.primaryLanguage == "emoji" }
    }

    private static func installEmojiKeyboardHookOnce() {
        guard !didSwizzleEmoji, let cls = NSClassFromString("WKContentView") else { return }
        didSwizzleEmoji = true
        typealias ObjGetter = @convention(c) (AnyObject, Selector) -> AnyObject?

        let modeSel = #selector(getter: UIResponder.textInputMode)
        if let method = class_getInstanceMethod(cls, modeSel) {
            let original = unsafeBitCast(method_getImplementation(method), to: ObjGetter.self)
            let block: @convention(block) (AnyObject) -> AnyObject? = { obj in
                if MainViewController.emojiKeyboardOn, let emoji = MainViewController.emojiInputMode() { return emoji }
                return original(obj, modeSel)
            }
            class_replaceMethod(cls, modeSel, imp_implementationWithBlock(block), method_getTypeEncoding(method))
        }

        let idSel = #selector(getter: UIResponder.textInputContextIdentifier)
        if let method = class_getInstanceMethod(cls, idSel) {
            let original = unsafeBitCast(method_getImplementation(method), to: ObjGetter.self)
            let block: @convention(block) (AnyObject) -> AnyObject? = { obj in
                if MainViewController.emojiKeyboardOn { return "zelo.emoji" as NSString }
                return original(obj, idSel)
            }
            class_replaceMethod(cls, idSel, imp_implementationWithBlock(block), method_getTypeEncoding(method))
        }
    }

    // The web view's focused WKContentView, if a field is focused.
    private func focusedWebContentView() -> UIView? {
        guard let scroll = webView?.scrollView else { return nil }
        for sub in scroll.subviews where NSStringFromClass(type(of: sub)).contains("WKContentView") {
            if sub.isFirstResponder { return sub }
        }
        return nil
    }

    private func showEmojiKeyboard() {
        guard MainViewController.emojiInputMode() != nil else {
            // The emoji keyboard is turned off in Settings > General > Keyboard.
            webView?.evaluateJavaScript("window._zeloEmojiUnavailable && window._zeloEmojiUnavailable()")
            return
        }
        MainViewController.emojiKeyboardOn = true
        // JS focuses the field in the same tap that sent this message, and the
        // keyboard may or may not already be up — reload now (keyboard already
        // open) and again shortly after (keyboard still opening).
        focusedWebContentView()?.reloadInputViews()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
            self?.focusedWebContentView()?.reloadInputViews()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            MainViewController.emojiKeyboardOn = false
        }
    }
}
