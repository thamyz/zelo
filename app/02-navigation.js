// ================================================================
// 02-navigation.js — moving between tabs and screens
//
// showTab(name) swaps the three bottom tabs; pushScreen(name)/popScreen()
// overlay a full screen on top of whichever tab is active. Also the sliding
// glass indicator under the tab bar and its drag-across-the-bar gesture.
//
// Part of script.js, split by concern. scripts/build.sh joins app/ back
// into script.js, which is what the app actually loads — see that file
// for why. The number in the filename is the load order.
// Map of every module: app/README.md
// ================================================================

// NAVIGATION — two modes
//   showTab(name)    → switch between Assistant / Practice tabs
//   pushScreen(name) → overlay a full screen (profile, chat)
//   popScreen()      → return to whichever tab was active
// ================================================================

// Slides the frosted-glass pill (#tab-glass-pill) behind whichever of
// Practice/Chats is active, sized/positioned from that button's own live
// rect rather than hardcoded offsets. Scan keeps its own FAB treatment, so
// the pill just fades out for it instead of trying to wrap a circle.
// The indicator's resting height. A constant rather than pill.offsetHeight,
// so the value can never drift from whatever the element happens to measure
// at the moment it is read.
const TAB_PILL_REST_H = 52;

let _tabPillPlaced = false;

function updateTabGlassPill(name) {
  const pill = document.getElementById('tab-glass-pill');
  const bar = document.getElementById('tab-bar');
  if (!pill || !bar) return;
  // Scan ('assistant') used to be excluded here along with every non-tab
  // name, so the indicator vanished whenever Scan was selected. It now
  // tracks Scan too; anything that isn't a real tab button still hides it.
  const btn = document.getElementById('tabbtn-' + name);
  if (!btn) {
    pill.style.opacity = '0';
    return;
  }
  const barRect = _rectA(bar);
  const btnRect = _rectA(btn);
  const inset = 10;
  // Scan is the centre FAB, which would cover all but a sliver of the
  // indicator — so it keeps its shape and still travels to Scan's position,
  // but fades out on the way in and back in on the way out. The movement is
  // what reads: the glass goes to the middle, and later comes back out of
  // the middle towards whichever tab you picked, with nothing left sitting
  // awkwardly behind the button.
  const hideHere = !!btn.querySelector('.scan-fab');

  const w = btnRect.width - inset * 2;
  const h = TAB_PILL_REST_H;
  const x = btnRect.left - barRect.left + inset;

  const apply = () => {
    pill.style.width = w + 'px';
    pill.style.height = h + 'px';
    pill.style.transform = 'translateX(' + x + 'px)';
    pill.style.opacity = hideHere ? '0' : '1';
  };

  // The indicator rests at translateX(0) until it is first positioned. Now
  // that it also tracks Scan — which is the tab the app launches on — that
  // first placement would otherwise animate, sliding in from the bar's left
  // edge on every launch. Place it instantly the first time, then re-arm
  // the transition for real tab switches (the standard pattern in this
  // file: kill the transition, change, reflow, restore next frame).
  if (!_tabPillPlaced) {
    _tabPillPlaced = true;
    pill.style.transition = 'none';
    apply();
    void pill.offsetWidth;
    requestAnimationFrame(() => { pill.style.transition = ''; });
    return;
  }

  apply();
}
// ---- Drag across the tab bar -------------------------------------------------
// Press and drag (or hold, then drag) anywhere on the bar and the glass
// indicator follows the finger, stretching slightly like liquid, and glides
// to the nearest tab on release, which is then opened. A plain tap is
// untouched (the buttons' own onclick). The indicator dissolves as it passes
// under the Scan button, the same way it does when Scan is selected.
const TAB_DRAG_ORDER = ['practice', 'assistant', 'chats'];
let _tabDrag = null;

function _tabCenters() {
  const bar = document.getElementById('tab-bar');
  const br = _rectA(bar);
  return TAB_DRAG_ORDER.map(n => {
    const r = _rectA(document.getElementById('tabbtn-' + n));
    return r.left - br.left + r.width / 2;
  });
}

function _tabDragFrame() {
  const d = _tabDrag;
  if (!d || !d.moved) return;
  // Glide toward the finger rather than snapping to it, so picking the
  // indicator up never jumps, and quick flicks still read as fluid.
  d.x += (d.target - d.x) * 0.32;
  const w = d.w;
  d.pill.style.transform = `translateX(${d.x - w / 2}px) scale(1.1, 0.95)`;
  // Fade as it crosses Scan (centre of the bar).
  const scanC = d.centers[1];
  const near = Math.min(1, Math.abs(d.x - scanC) / (d.centers[2] - scanC) / 0.55);
  d.pill.style.opacity = String(Math.max(0, near));
  // Live "which tab would open" preview.
  let best = 0, bd = 1e9;
  d.centers.forEach((c, i) => { const dd = Math.abs(c - d.x); if (dd < bd) { bd = dd; best = i; } });
  if (best !== d.hot) {
    d.hot = best;
    TAB_DRAG_ORDER.forEach((n, i) => document.getElementById('tabbtn-' + n).classList.toggle('tab-btn--hot', i === best));
    _cineHaptic('LIGHT');
  }
  d.raf = requestAnimationFrame(_tabDragFrame);
}

function _tabDragEnd(commit) {
  const d = _tabDrag;
  if (!d) return;
  _tabDrag = null;
  cancelAnimationFrame(d.raf);
  const bar = document.getElementById('tab-bar');
  bar.classList.remove('tab-bar--dragging');
  TAB_DRAG_ORDER.forEach(n => document.getElementById('tabbtn-' + n).classList.remove('tab-btn--hot'));
  if (!d.moved) return;
  d.pill.style.transition = '';          // glide home with the normal transition
  const name = TAB_DRAG_ORDER[commit ? d.hot : TAB_DRAG_ORDER.indexOf(state.activeTab)] || state.activeTab;
  window.__tabDragClickBlockUntil = Date.now() + 400;   // the lift-off must not also fire a button click
  if (name === state.activeTab) updateTabGlassPill(name); else showTab(name);
}

function _initTabBarDrag() {
  const bar = document.getElementById('tab-bar');
  if (!bar || bar._dragWired) return;
  bar._dragWired = true;
  bar.addEventListener('touchstart', (e) => {
    const pill = document.getElementById('tab-glass-pill');
    const t = e.touches[0];
    _tabDrag = { sx: t.clientX, moved: false, pill, x: 0, target: 0, w: 0, centers: null, hot: -1, raf: 0 };
  }, { passive: true });
  bar.addEventListener('touchmove', (e) => {
    const d = _tabDrag; if (!d) return;
    const t = e.touches[0];
    if (!d.moved) {
      if (Math.abs(t.clientX - d.sx) < 8) return;
      d.moved = true;
      d.centers = _tabCenters();
      d.w = parseFloat(d.pill.style.width) || 64;
      // Start from where the indicator currently is (it is hidden on Scan, so
      // use that tab's centre in that case) — no jump on pick-up.
      const cur = d.centers[Math.max(0, TAB_DRAG_ORDER.indexOf(state.activeTab))];
      d.x = cur; d.target = cur;
      d.pill.style.transition = 'opacity 0.12s ease, width 0.25s ease, height 0.25s ease';
      bar.classList.add('tab-bar--dragging');
      _cineHaptic('LIGHT');
      d.raf = requestAnimationFrame(_tabDragFrame);
    }
    const br = bar.getBoundingClientRect();
    d.target = Math.min(d.centers[2], Math.max(d.centers[0], t.clientX - br.left));
    e.preventDefault();
  }, { passive: false });
  bar.addEventListener('touchend', () => _tabDragEnd(true));
  bar.addEventListener('touchcancel', () => _tabDragEnd(false));
  // Swallow the click that follows a drag.
  bar.addEventListener('click', (e) => {
    if (Date.now() < (window.__tabDragClickBlockUntil || 0)) { e.stopPropagation(); e.preventDefault(); }
  }, true);
}
document.addEventListener('DOMContentLoaded', _initTabBarDrag);

window.addEventListener('resize', () => updateTabGlassPill(state.activeTab));

// Populates any <img data-src="..."> inside a screen/tab the moment it
// actually becomes active — not before. On cold launch (fresh install/
// update, nothing cached yet), every <img src="..."> in this file used to
// start downloading immediately regardless of which of the app's ~39
// screens it belonged to, because browsers' preload scanner fetches a real
// src attribute on sight and does NOT wait to find out the element is
// actually inside a hidden/display:none screen — confirmed by measuring
// under throttled conditions: 150+ unrelated icon requests (settings,
// badges, leaderboard, screens never opened yet) were saturating bandwidth
// and delaying script.js itself by over 15s. `loading="lazy"` alone did
// NOT fix this — its own deferral heuristic needs a real layout position to
// judge distance from viewport, which a display:none element doesn't have,
// so browsers fetch it eagerly anyway rather than risk never loading it.
// Stripping src down to data-src removes the browser's ability to eagerly
// fetch these at all; this is the one shared choke point every screen/tab
// transition already runs through (showTab/pushScreen/popScreen), so a
// single hook here covers all of them.
function _revealLazyImages(el) {
  if (!el) return;
  el.querySelectorAll('img[data-src]').forEach(img => {
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
  });
}

// Safety net for _revealLazyImages(): this app has dozens of different
// "show a screen/overlay/sheet" functions beyond just showTab()/
// pushScreen()/popScreen() (History, the paywall, crash/session-expired
// fallbacks, sheet toggles, etc.) — hand-auditing every one of them across
// a file this size to make sure each calls _revealLazyImages() is exactly
// the kind of thing that's easy to miss once and silently ship a
// permanently-blank icon somewhere. This observes every data-src image up
// front; the moment ANY of them actually gets a real layout box within/near
// the viewport — which structurally can only happen once its containing
// screen stops being display:none, regardless of which code path did that
// — it reveals itself. Unlike the native loading="lazy" attribute (which
// eagerly fetches at parse time when it can't yet judge a hidden element's
// distance from the viewport — the exact failure mode measured here),
// there is no src on these elements yet for the browser to jump the gun
// on, so this is reliable rather than best-effort.
const _lazyImgObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const img = entry.target;
    if (img.dataset.src) {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    }
    _lazyImgObserver.unobserve(img);
  });
}, { rootMargin: '200px' });

function _armLazyImageObserver() {
  document.querySelectorAll('img[data-src]').forEach(img => _lazyImgObserver.observe(img));
}

function showTab(name) {
  // Locked (subscription ended): Home stays visible, every other tab is the paywall.
  if (name !== 'assistant' && subscriptionExpired()) { state.activeTab = 'assistant'; showLockedScreen(); return; }
  // Chats is never gated at the tab level — anonymous users with zero chat
  // history land on the tab's own empty state (see renderChatsList()) same
  // as Practice (Home); the auth check only happens when they actually try
  // to act (see homeModeSelect()).

  // History overlay keeps the tab bar visible — close it on any tab nav
  closeHistory();

  // Cancel any chat timer if leaving
  cancelPendingReply();

  // The tour drives its own tab switches; only end it when the user navigates
  // away on their own (e.g. tapping a tab mid-tour).
  // The guided tour lives in archive/legacy-onboarding.js and is not loaded in
  // the shipped bundle, so every one of its globals needs a typeof guard.
  const tour = document.getElementById('tour');
  if (tour && !tour.hidden && typeof tourSwitchingTab !== 'undefined' && !tourSwitchingTab
      && typeof endTour === 'function') endTour();

  // Hide all screens and tabs
  document.querySelectorAll(".tab, .screen").forEach(el => el.classList.remove("active"));

  // Show the tab
  const tabEl = document.getElementById("tab-" + name);
  tabEl.classList.add("active");
  _revealLazyImages(tabEl);

  // Update tab bar buttons
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.getElementById("tabbtn-" + name).classList.add("active");
  updateTabGlassPill(name);

  // Show tab bar
  document.getElementById("tab-bar").classList.remove("hidden");

  state.activeTab    = name;
  state.activeScreen = null;
  state.screenStack  = [];

  // Practice (Home) tab: first visit shows the tutorial (welcome screen →
  // swipe-right/swipe-left/photo-nav lessons — replaces the old "who do
  // you want to practice with" mode popup entirely); after that the deck
  // loads directly, no account required.
  if (name === 'practice') {
    _syncPracticeOnboardingChrome();
    if (!localStorage.getItem('zelo_mode_selected')) {
      startPracticeTutorial();
    } else {
      initSwipeDeck();
    }
  }
  if (name === 'chats') {
    renderChatsList();
  }
  if (name === 'assistant') {
    maybeShowScanIntro();
    refreshScanLimitBanner();
    refreshScanWhoCards();
    checkGenerateReady();
  }
}

function pushScreen(name) {
  // Locked: only Settings and the Streak screens open; anything else is the paywall.
  if (subscriptionExpired() && !_lockedAllows(name)) { showLockedScreen(); return; }
  // The AI Coach chat sheet isn't a stacked screen: it keeps its own classes and a
  // full-screen backdrop. Pushing a screen over it (Your Reply from "View full
  // chat", for one) used to leave that backdrop sitting on top, invisibly, so every
  // tap hit it instead of the new screen's buttons. Close it first.
  if (_aiCoachChatSheetOpen && name !== 'ai-coach') closeAiCoachChatSheet();
  // Hide all tabs and screens
  document.querySelectorAll(".tab, .screen").forEach(el => el.classList.remove("active"));

  // Show the screen (covers everything including tab bar)
  const screenEl = document.getElementById("screen-" + name);
  screenEl.classList.add("active");
  _revealLazyImages(screenEl);

  // Hide tab bar
  document.getElementById("tab-bar").classList.add("hidden");

  // Remember what screen (if any) was showing before this one, so popScreen()
  // can return to it instead of always falling back to the base tab. Skip
  // the push if we're already on this screen — otherwise re-entering the
  // same screen (e.g. openDashboard() called while Account is already
  // showing) piles up redundant stack entries that corrupt later "back"s.
  if (state.activeScreen && state.activeScreen !== name) {
    state.screenStack.push(state.activeScreen);
  }
  state.activeScreen = name;
}

function popScreen() {
  const prevScreen = state.screenStack.pop();
  if (prevScreen) {
    document.querySelectorAll(".tab, .screen").forEach(el => el.classList.remove("active"));
    const screenEl = document.getElementById("screen-" + prevScreen);
    screenEl.classList.add("active");
    _revealLazyImages(screenEl);
    document.getElementById("tab-bar").classList.add("hidden");
    state.activeScreen = prevScreen;
  } else {
    // Nothing to unwind to — return to whichever tab was last active
    state.activeScreen = null;
    showTab(state.activeTab);
  }
}


// ================================================================
