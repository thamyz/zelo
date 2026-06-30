// ============================================================================
// ARCHIVED — replaced by 5-screen cinematic onboarding. Not in use.
// Kept for reference / rollback only.
//
// This file is loaded BEFORE script.js purely so the symbols below still
// resolve for a handful of null-safe guards left in the active swipe/tab code
// (tourSwitchingTab, tourSwipeArmed, tourSwipeDir, endTour, cancelSwipeDemo,
// flashSwipeFeedback, runSwipeDemo). None of the legacy flow is ever invoked:
// the active initOnboarding() in script.js drives the new cinematic onboarding
// and never calls startTour(), and the legacy HTML/CSS below were removed from
// index.html / style.css (preserved here only as commented reference).
// ============================================================================

// ----------------------------------------------------------------------------
// LEGACY ONBOARDING — original 3-slide static intro (DISABLED)
// ----------------------------------------------------------------------------
let onboardingSlide = 0;
const ONBOARDING_TOTAL = 3;

let _obTypeTimer = null;
let _obTyping    = false;
let _obTextReady = false;

function _obType(titleEl, descEl, titleText, descText) {
  _obTyping = true;
  _obTextReady = false;
  if (_obTypeTimer) clearTimeout(_obTypeTimer);
  titleEl.textContent = '';
  descEl.textContent  = '';
  let i = 0;
  const total = titleText.length + 1 + descText.length;
  function tick() {
    if (i < titleText.length) {
      titleEl.textContent = titleText.slice(0, ++i);
      navigator.vibrate?.(1);
      _obTypeTimer = setTimeout(tick, 32);
    } else if (i === titleText.length) {
      i++;
      _obTypeTimer = setTimeout(tick, 180);
    } else {
      const di = i - titleText.length - 1;
      if (di < descText.length) {
        descEl.textContent = descText.slice(0, di + 1);
        i++;
        navigator.vibrate?.(1);
        _obTypeTimer = setTimeout(tick, 28);
      } else {
        _obTyping = false;
        _obTextReady = true;
        _obTypeTimer = null;
        navigator.vibrate?.(10);
      }
    }
  }
  tick();
}

function _obRevealAll(titleEl, descEl, titleText, descText) {
  if (_obTypeTimer) { clearTimeout(_obTypeTimer); _obTypeTimer = null; }
  _obTyping = false;
  _obTextReady = true;
  titleEl.textContent = titleText;
  descEl.textContent  = descText;
}

function onboardingTap(e) {
  if (e && e.target.closest('.onboarding-close-btn')) return;
  const slide = document.querySelectorAll('.onboarding-slide')[onboardingSlide];
  if (!slide) { onboardingNext(); return; }
  const titleEl = slide.querySelector('.onboarding-title');
  const descEl  = slide.querySelector('.onboarding-desc');
  if (_obTyping) {
    _obRevealAll(titleEl, descEl,
      titleEl.dataset.full || titleEl.textContent,
      descEl.dataset.full  || descEl.textContent);
  } else if (_obTextReady) {
    onboardingNext();
  }
}

function initOnboarding() {
  const tabBar = document.getElementById('tab-bar');
  if (tabBar) tabBar.style.display = 'none';
  initChatsTab();

  if (localStorage.getItem('zelo_onboarding_done')) {
    const el = document.getElementById('onboarding');
    if (el) el.setAttribute('hidden', '');
    startTour();
    return;
  }

  onboardingSlide = 0;
  showOnboardingSlide(0);
}

function showOnboardingSlide(index) {
  document.querySelectorAll('.onboarding-slide').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });
  document.querySelectorAll('.onboarding-dot').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });
  const fill = document.getElementById('onboarding-progress-fill');
  if (fill) fill.style.width = ((index + 1) / ONBOARDING_TOTAL * 100) + '%';
  const btn = document.querySelector('.onboarding-btn');
  if (btn) btn.textContent = (index === ONBOARDING_TOTAL - 1) ? 'Get Started' : 'Next';
}

function onboardingNext() {
  if (onboardingSlide < ONBOARDING_TOTAL - 1) {
    onboardingSlide++;
    showOnboardingSlide(onboardingSlide);
  } else {
    finishOnboarding();
  }
}

function finishOnboarding() {
  localStorage.setItem('zelo_onboarding_done', '1');
  const overlay = document.getElementById('onboarding');
  overlay.classList.add('hidden');
  setTimeout(() => { overlay.setAttribute('hidden', ''); overlay.classList.remove('hidden'); }, 300);
  startTour();
}


// ----------------------------------------------------------------------------
// LEGACY GUIDED SPOTLIGHT TOUR — 12-step coach-mark journey (DISABLED)
// ----------------------------------------------------------------------------
// ================================================================
// GUIDED SPOTLIGHT TOUR  (one continuous journey: Scan → Home → Chats)
// Every step uses the SAME language: spotlight cutout, dimmed
// background, anchored callout with a pointer arrow. The Scan steps
// keep the real UI live (typing/tapping the target advances). The
// Home / Chats / completion steps are purposeful overviews — the
// background is blocked so a stray swipe can't fire, and the user
// moves on with Next.
//
//   tab       → which app tab the step lives on (engine switches to it)
//   act       → 'input' | 'click' makes the live target auto-advance
//   secondary → calmer visual (lower-priority step)
//   dwell     → ms the step "settles" before it accepts advancing
//   final     → the completion step (button reads "Get Started")
// ================================================================

//   kicker    → small branded label at the top of the card (e.g. "Scan")
//   swipe     → Home step: shows a swipe hint; a real swipe advances
//   tapTarget → a transparent hit sits over the target; tapping it advances
//   round     → spotlight is circular (for the round Scan/FAB buttons)
//   expand    → Situation step: auto-demos the collapse→expand interaction
const TOUR_STEPS = [
  // — SCAN —
  { tab: 'assistant', sel: '#asst-input', kicker: 'Scan', text: 'Paste their message here.' },
  { tab: 'assistant', sel: '#tellzelo-card', kicker: 'Scan', text: 'Add a little context.' },
  { tab: 'assistant', sel: '#upload-row', kicker: 'Scan', text: 'Or just drop a screenshot.', secondary: true },
  { tab: 'assistant', sel: '#asst-generate-btn', kicker: 'Scan', text: 'Hit generate for your reply.' },
  { tab: 'assistant', sel: '#aicoach-card', kicker: 'AI Coach', text: 'Meet AI Coach — tap for personalized advice and reply suggestions.' },
  // — HOME —
  { tab: 'practice',  sel: '#tabbtn-practice', kicker: 'Home', text: 'This is Home — practice with AI matches.' },
  { tab: 'practice',  sel: '#card-deck', kicker: 'Home', text: 'Browse profiles and find someone to chat with.' },
  { tab: 'practice',  sel: '#card-deck', swipeDir: 'right', kicker: 'Home', text: 'Swipe right to like.' },
  { tab: 'practice',  sel: '#card-deck', swipeDir: 'left',  kicker: 'Home', text: 'Now swipe left to pass.' },
  // — CHATS —
  { tab: 'chats',     sel: '#tabbtn-chats', kicker: 'Chats', text: 'This is Chats — where your conversations live.' },
  { tab: 'chats',     sel: '#chats-list', selFallback: '#chats-empty', kicker: 'Chats', text: 'Matches show up here. Jump back in anytime.' },
  // — FINISH —
  { tab: 'assistant', sel: '.scan-fab', round: true, kicker: 'All set', text: "You've got it from here.", last: true },
];

const TOUR_ARM_DEFAULT = 2000;   // fallback dwell if a step omits one

let tourIndex       = 0;
let tourArmed       = false;
let tourArmTimer    = null;
let tourStepBinding = null;
let tourScrollEl    = null;
let tourSwitchingTab = false;
let tourSwipeArmed  = false;
let tourSwipeDir    = null;
let tourDemoTimeout = null;
let _tourTypeTimer  = null;
let _tourTyping     = false;
let _tourTextReady  = false;

function _tourType(text) {
  _tourTyping = true;
  _tourTextReady = false;
  if (_tourTypeTimer) clearTimeout(_tourTypeTimer);
  const el = document.getElementById('tour-text');
  el.textContent = '';
  el.classList.add('tour-text--entering');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.remove('tour-text--entering');
      let i = 0;
      function tick() {
        if (i < text.length) {
          el.textContent = text.slice(0, ++i);
          navigator.vibrate?.(1);
          _tourTypeTimer = setTimeout(tick, 32);
        } else {
          _tourTyping = false;
          _tourTextReady = true;
          _tourTypeTimer = null;
          navigator.vibrate?.(10);
        }
      }
      tick();
    });
  });
}

function _tourRevealAll() {
  if (_tourTypeTimer) { clearTimeout(_tourTypeTimer); _tourTypeTimer = null; }
  _tourTyping = false;
  _tourTextReady = true;
  const el = document.getElementById('tour-text');
  if (el) el.textContent = TOUR_STEPS[tourIndex].text;
}

function tourTooltipTap(e) {
  if (e.target.closest('.tour-close-btn, .tour-back')) return;
  const step = TOUR_STEPS[tourIndex];
  if (!step) return;
  if (_tourTyping) {
    _tourRevealAll();
  } else if (_tourTextReady) {
    goNextStep();
  }
}

function tourBackdropTap(e) {
  tourTooltipTap(e);
}

function startTour() {
  const tabBar = document.getElementById('tab-bar');
  if (tabBar) tabBar.style.display = '';
  const entry = document.getElementById('tour-entry-overlay');
  if (entry) { entry.hidden = false; return; }
  _launchTour();
}

function tourEntryYes() {
  const entry = document.getElementById('tour-entry-overlay');
  if (entry) entry.hidden = true;
  _launchTour();
}

function tourEntryNo() {
  const entry = document.getElementById('tour-entry-overlay');
  if (entry) entry.hidden = true;
  maybeShowScanIntro();
}

function _launchTour() {
  tourIndex = 0;
  const tour = document.getElementById('tour');
  tour.hidden = false;
  renderTourStep(0);
}

// Resolve a step's element, falling back when the primary target is absent or
// collapsed (e.g. an empty Chats list on a brand-new account).
function resolveStepEl(step) {
  let el = document.querySelector(step.sel);
  if ((!el || el.getBoundingClientRect().height < 8) && step.selFallback) {
    const fb = document.querySelector(step.selFallback);
    if (fb) el = fb;
  }
  return el;
}

function renderTourStep(i) {
  const step = TOUR_STEPS[i];

  clearStepBinding();
  unbindTourReposition();
  cancelSwipeDemo();
  cancelSituationDemo();

  // Move to the step's tab without ending the tour, then re-track that tab's
  // scroll container for repositioning.
  if (step.tab && state.activeTab !== step.tab) {
    tourSwitchingTab = true;
    showTab(step.tab);
    tourSwitchingTab = false;
  }
  tourScrollEl = document.getElementById('tab-' + (step.tab || state.activeTab));
  if (tourScrollEl) tourScrollEl.scrollTop = 0;
  bindTourReposition();

  const tour = document.getElementById('tour');

  // Card content + branded header
  document.getElementById('tour-kicker').textContent = step.kicker || 'Zelo';
  _tourType(step.text);
  document.getElementById('tour-back').hidden = (i === 0);
  tour.classList.toggle('tour--secondary', !!step.secondary);
  tour.classList.toggle('tour--final', !!step.last);
  const gsBtn = document.getElementById('tour-get-started');
  if (gsBtn) gsBtn.hidden = !step.last;

  const live = !!step.act || !!step.swipeDir || !!step.expand;
  const backdrop = document.getElementById('tour-backdrop');
  if (backdrop) backdrop.style.pointerEvents = 'auto';
  tourSwipeArmed = !!step.swipeDir;
  tourSwipeDir   = step.swipeDir || null;

  if (step.expand) closeSituation();

  document.getElementById('tour-spotlight').style.borderRadius = step.round ? '50%' : '';
  const hit = document.getElementById('tour-hit');
  hit.hidden = !step.tapTarget;
  hit.dataset.active = step.tapTarget ? '1' : '0';

  const el = resolveStepEl(step);
  if (!el) { endTour(); return; }

  // Bring the target into view, then measure after layout has committed.
  el.scrollIntoView({ block: 'center', behavior: 'auto' });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    positionTour(el, i === 0);                  // snap (no transition) on the first step
    if (step.act) bindStepTarget(el, step.act); // typing/tapping the real element advances
    if (step.swipeDir) runSwipeDemo(step.swipeDir); // the card itself shows the move
    if (step.expand) runSituationDemo();        // show the collapse → expand interaction
  }));
}

function positionTour(el, snap) {
  // All coordinates are relative to #app so the tour stays anchored inside
  // the phone frame on desktop and the full screen on mobile.
  const appRect = document.getElementById('app').getBoundingClientRect();
  const rect    = el.getBoundingClientRect();

  const spotlight = document.getElementById('tour-spotlight');
  const tooltip   = document.getElementById('tour-tooltip');

  // On the first step there is no previous position to glide from, so snap
  // straight to the target instead of sweeping in from the top-left corner.
  if (snap) {
    spotlight.style.transition = 'none';
    tooltip.style.transition   = 'none';
  }

  const pad  = 6;
  const top  = rect.top  - appRect.top;
  const left = rect.left - appRect.left;

  // Spotlight cutout around the element
  spotlight.style.top    = (top  - pad) + 'px';
  spotlight.style.left   = (left - pad) + 'px';
  spotlight.style.width  = (rect.width  + pad * 2) + 'px';
  spotlight.style.height = (rect.height + pad * 2) + 'px';

  // Keep the tap-target proxy aligned with the cutout, when active
  const hit = document.getElementById('tour-hit');
  if (hit && hit.dataset.active === '1') {
    hit.style.top    = (top  - pad) + 'px';
    hit.style.left   = (left - pad) + 'px';
    hit.style.width  = (rect.width  + pad * 2) + 'px';
    hit.style.height = (rect.height + pad * 2) + 'px';
  }

  // Tooltip: below the element unless there isn't room inside the app.
  // Use the CSS max-width (250px) as the assumed width — tipRect.width is
  // measured while the typewriter has cleared the text, so it underestimates
  // the final rendered width and would allow right-edge overflow once text
  // fills in. Similarly pad the height estimate so the placeAbove decision
  // doesn't flip incorrectly when text hasn't typed yet.
  const gap       = 16;
  const margin    = 14;
  const tipRect   = tooltip.getBoundingClientRect();
  const assumedW  = 250;                              // matches CSS max-width
  const assumedH  = Math.max(tipRect.height, 120);   // conservative when empty

  const spaceBelow = appRect.height - (top + rect.height);
  const placeAbove = spaceBelow < assumedH + gap + 24;

  tooltip.classList.toggle('above', placeAbove);

  let tipTop = placeAbove
    ? top - pad - gap - assumedH
    : top + rect.height + pad + gap;

  // Clamp all four edges inside the app
  tipTop  = Math.max(margin, Math.min(tipTop,  appRect.height - assumedH - margin));
  let tipLeft = left;
  tipLeft = Math.max(margin, Math.min(tipLeft, appRect.width  - assumedW - margin));

  tooltip.style.top  = tipTop  + 'px';
  tooltip.style.left = tipLeft + 'px';

  // Restore transitions after the snap so subsequent steps glide.
  if (snap) {
    spotlight.offsetHeight;   // force reflow to lock in the snapped position
    spotlight.style.transition = '';
    tooltip.style.transition   = '';
  }
}

// Wire the live target so typing/tapping it advances — the user is touching
// the real UI, not a slideshow. Guarded by the arm flag so a stray tap as the
// step appears can't skip ahead.
function bindStepTarget(el, evt) {
  const handler = () => { goNextStep(); };
  el.addEventListener(evt, handler);
  tourStepBinding = { el, evt, handler };
}

function clearStepBinding() {
  if (!tourStepBinding) return;
  const { el, evt, handler } = tourStepBinding;
  el.removeEventListener(evt, handler);
  tourStepBinding = null;
}

// The Next/Done button doubles as the "settling" indicator: a subtle fill
// sweeps across it, and only once full does the step accept advancing. No
// numbers, no countdown — it just looks like the button is settling in.
function armTourButton(dwell) {
  tourArmed = false;
  clearTimeout(tourArmTimer);

  // Stretch the fill to the full dwell so the button visibly settles in over
  // ~2s. Premium easing (not linear) makes it feel intentional, not a timer.
  const fill = document.getElementById('tour-next-fill');
  fill.style.animation = 'none';
  fill.offsetHeight;                 // reflow cancels the previous run
  fill.style.animation = `tourFill ${dwell}ms cubic-bezier(0.33, 0, 0.2, 1) forwards`;

  tourArmTimer = setTimeout(() => { tourArmed = true; }, dwell);
}

// Forward progression. tourAdvance is the arm-gated path (Next button, target
// tap, input); goNextStep is the unguarded mover the guided swipe uses.
function tourAdvance() {
  if (!tourArmed) return;
  goNextStep();
}

function goNextStep() {
  _tourRevealAll();
  clearStepBinding();
  if (tourIndex >= TOUR_STEPS.length - 1) {
    endTour();
  } else {
    tourIndex++;
    renderTourStep(tourIndex);
  }
}

function tourBack() {
  if (tourIndex <= 0) return;
  _tourRevealAll();
  clearStepBinding();
  tourIndex--;
  renderTourStep(tourIndex);
}

// Completion: collapse the cutout to a point (its shadow dims everything) and
// center the branded card — no element to anchor to.
function positionFinal() {
  const appRect   = document.getElementById('app').getBoundingClientRect();
  const spotlight = document.getElementById('tour-spotlight');
  const tooltip   = document.getElementById('tour-tooltip');

  spotlight.style.width  = '0';
  spotlight.style.height = '0';
  spotlight.style.top    = (appRect.height / 2) + 'px';
  spotlight.style.left   = (appRect.width  / 2) + 'px';

  const tipRect = tooltip.getBoundingClientRect();
  tooltip.classList.remove('above');
  tooltip.style.left = Math.round((appRect.width  - tipRect.width)  / 2) + 'px';
  tooltip.style.top  = Math.round((appRect.height - tipRect.height) / 2) + 'px';
}

// The CARD is the instructor: gently slide the top card the way the user should
// swipe, surface its like/pass stamp + a big heart/X, then let it spring back to
// center. No arrows — the motion itself shows what the gesture does.
function runSwipeDemo(direction) {
  const top = document.querySelector('#card-deck [data-stack="0"]');
  if (!top) return;

  const dx    = direction === 'right' ? 96 : -96;
  const rot   = direction === 'right' ? 9  : -9;
  const stamp = top.querySelector(direction === 'right' ? '.swipe-stamp--like' : '.swipe-stamp--nope');

  top.style.transition = 'transform 0.55s cubic-bezier(0.33, 0, 0.2, 1)';
  top.style.transform  = `translate(${dx}px, 0) rotate(${rot}deg)`;
  if (stamp) stamp.style.opacity = '1';
  flashSwipeFeedback(direction);

  tourDemoTimeout = setTimeout(() => {
    top.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    top.style.transform  = '';
    if (stamp) stamp.style.opacity = '0';
  }, 720);
}

function cancelSwipeDemo() {
  clearTimeout(tourDemoTimeout);
  tourDemoTimeout = null;
  const top = document.querySelector('#card-deck [data-stack="0"]');
  if (top) {
    top.style.transition = '';
    top.style.transform  = '';
    top.querySelectorAll('.swipe-stamp').forEach(s => s.style.opacity = '0');
  }
}

// Situation step: start collapsed, then auto-expand so the user SEES the
// tap-to-open interaction. The spotlight glides to the taller, expanded row.
let tourSituationTimeout = null;
function runSituationDemo() {
  clearTimeout(tourSituationTimeout);
  tourSituationTimeout = setTimeout(() => {
    openSituation();
    tourSituationTimeout = setTimeout(() => {
      const el = document.getElementById('situation');
      if (el && !document.getElementById('tour').hidden) positionTour(el, false); // animate growth
    }, 360);
  }, 700);
}

function cancelSituationDemo() {
  clearTimeout(tourSituationTimeout);
  tourSituationTimeout = null;
}

// Big heart / X that pops over the card on a guided swipe — confirms meaning
// through motion (green like, red pass) without extra words.
function flashSwipeFeedback(direction) {
  const fb = document.getElementById('tour-swipe-feedback');
  if (!fb) return;
  const appRect = document.getElementById('app').getBoundingClientRect();
  const deck    = document.getElementById('card-deck') || document.getElementById('app');
  const r       = deck.getBoundingClientRect();
  fb.textContent = direction === 'right' ? '♥' : '✕';
  fb.className   = 'tour-swipe-feedback ' + (direction === 'right' ? 'like' : 'nope');
  fb.style.left  = (r.left - appRect.left + r.width / 2) + 'px';
  fb.style.top   = (r.top  - appRect.top  + r.height / 2) + 'px';
  fb.hidden = false;
  fb.style.animation = 'none';
  fb.offsetHeight;                 // restart the pop each time
  fb.style.animation = '';
  clearTimeout(fb._hideTimer);
  fb._hideTimer = setTimeout(() => { fb.hidden = true; }, 650);
}

function endTour() {
  if (_tourTypeTimer) { clearTimeout(_tourTypeTimer); _tourTypeTimer = null; }
  _tourTyping = false;
  clearStepBinding();
  clearTimeout(tourArmTimer);
  unbindTourReposition();
  cancelSwipeDemo();
  cancelSituationDemo();
  tourSwipeArmed = false;
  tourSwipeDir   = null;
  const tour = document.getElementById('tour');
  tour.hidden = true;
  tour.classList.remove('tour--secondary', 'tour--final');
  const hit = document.getElementById('tour-hit');
  if (hit) { hit.hidden = true; hit.dataset.active = '0'; }
  maybeShowScanIntro();
}

// Keep the current step glued to its target while the window resizes or the
// Scan content scrolls. Snap (no transition) so the spotlight tracks 1:1.
function repositionTour() {
  const tour = document.getElementById('tour');
  if (!tour || tour.hidden) return;
  const el = resolveStepEl(TOUR_STEPS[tourIndex]);
  if (el) positionTour(el, true);
}

function bindTourReposition() {
  window.addEventListener('resize', repositionTour);
  if (tourScrollEl) tourScrollEl.addEventListener('scroll', repositionTour, { passive: true });
}

function unbindTourReposition() {
  window.removeEventListener('resize', repositionTour);
  if (tourScrollEl) tourScrollEl.removeEventListener('scroll', repositionTour);
}


// ----------------------------------------------------------------------------
// LEGACY HTML — removed from index.html (tour + tour-entry + 3-slide onboarding)
// ----------------------------------------------------------------------------
//       <!-- ============================================================
//            GUIDED SPOTLIGHT TOUR  (Scan)
//            ============================================================ -->
//       <div class="tour" id="tour" hidden>
//         <div class="tour-backdrop" id="tour-backdrop" onclick="tourBackdropTap(event)"></div>
//         <div class="tour-spotlight" id="tour-spotlight"></div>
//         <!-- transparent tap-target over a highlighted control (e.g. Scan button) -->
//         <button class="tour-hit" id="tour-hit" data-active="0" onclick="tourAdvance()" hidden aria-label="Continue"></button>
//         <!-- big heart / X that pops on a guided swipe -->
//         <div class="tour-swipe-feedback" id="tour-swipe-feedback" hidden></div>
//         <div class="tour-tooltip" id="tour-tooltip" onclick="tourTooltipTap(event)">
//           <button class="tour-close-x" onclick="event.stopPropagation(); endTour()" aria-label="Close tour">✕</button>
//           <span class="tour-kicker" id="tour-kicker">Zelo</span>
//           <p class="tour-text" id="tour-text"></p>
//           <div class="tour-controls">
//             <button class="tour-back" id="tour-back" onclick="event.stopPropagation(); tourBack()">Back</button>
//             <button class="tour-get-started" id="tour-get-started" onclick="event.stopPropagation(); endTour()" hidden>Get Started</button>
//           </div>
//         </div>
//       </div>
// 
// 
// 
//       <!-- ============================================================
//            TOUR ENTRY POPUP — "New to Zelo?" shown every launch
//            ============================================================ -->
//       <div class="tour-entry-overlay" id="tour-entry-overlay" hidden>
//         <div class="tour-entry-card">
//           <span class="tour-entry-icon" aria-hidden="true">
//             <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
//               <path d="M12 2.5l1.9 5.7a3 3 0 0 0 1.9 1.9L21.5 12l-5.7 1.9a3 3 0 0 0-1.9 1.9L12 21.5l-1.9-5.7a3 3 0 0 0-1.9-1.9L2.5 12l5.7-1.9a3 3 0 0 0 1.9-1.9z"/>
//             </svg>
//           </span>
//           <h2 class="tour-entry-title">New to Zelo?</h2>
//           <p class="tour-entry-sub">Want a quick tour?</p>
//           <div class="tour-entry-btns">
//             <button class="tour-entry-yes" onclick="tourEntryYes()">Yes, show me</button>
//             <button class="tour-entry-no" onclick="tourEntryNo()">No thanks</button>
//           </div>
//         </div>
//       </div>
// 
//       <!-- ============================================================
//            ONBOARDING (first launch only — simple, no animation)
//            ============================================================ -->
//       <div class="onboarding" id="onboarding">
//         <div class="onboarding-content">
// 
//           <div class="onboarding-progress" id="onboarding-progress-bar">
//             <div class="onboarding-progress-fill" id="onboarding-progress-fill"></div>
//           </div>
// 
//           <div class="onboarding-wordmark">Zelo</div>
// 
//           <div class="onboarding-slide active" data-slide="0">
//             <div class="onboarding-icon" style="background:radial-gradient(circle,rgba(236,72,153,0.14) 0%,transparent 65%)">
//               <svg width="64" height="64" viewBox="0 0 24 24" fill="none"
//                    stroke="#ec4899" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
//                 <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
//                 <circle cx="8.5" cy="10" r="0.8" fill="#ec4899" stroke="none"/>
//                 <circle cx="12"  cy="10" r="0.8" fill="#ec4899" stroke="none"/>
//                 <circle cx="15.5" cy="10" r="0.8" fill="#ec4899" stroke="none"/>
//               </svg>
//             </div>
//             <h2 class="onboarding-title">Get reply suggestions</h2>
//             <p class="onboarding-desc">Never get left on read again.</p>
//           </div>
// 
//           <div class="onboarding-slide" data-slide="1">
//             <div class="onboarding-icon" style="background:radial-gradient(circle,rgba(244,63,94,0.12) 0%,transparent 65%)">
//               <svg width="64" height="64" viewBox="0 0 24 24" fill="none"
//                    stroke="#f43f5e" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
//                 <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" fill="rgba(244,63,94,0.06)"/>
//                 <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>
//               </svg>
//             </div>
//             <h2 class="onboarding-title">Practice conversations</h2>
//             <p class="onboarding-desc">Rehearse real chats, zero pressure.</p>
//           </div>
// 
//           <div class="onboarding-slide" data-slide="2">
//             <div class="onboarding-icon" style="background:radial-gradient(circle,rgba(245,158,11,0.14) 0%,transparent 65%)">
//               <svg width="64" height="64" viewBox="0 0 24 24" fill="none"
//                    stroke="#d97706" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
//                 <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
//                 <polyline points="16 7 22 7 22 13"/>
//               </svg>
//             </div>
//             <h2 class="onboarding-title">Improve your texting</h2>
//             <p class="onboarding-desc">Go from overthinking to effortless.</p>
//           </div>
// 
//           <div class="onboarding-dots">
//             <span class="onboarding-dot active" data-dot="0"></span>
//             <span class="onboarding-dot" data-dot="1"></span>
//             <span class="onboarding-dot" data-dot="2"></span>
//           </div>
// 
//           <button class="onboarding-btn" onclick="onboardingNext()" style="touch-action:manipulation;margin-top:20px">Next</button>
// 
//         </div>
//       </div>

// ----------------------------------------------------------------------------
// LEGACY CSS A — removed from style.css (spotlight tour + 3-slide onboarding)
// ----------------------------------------------------------------------------
// /* ================================================================
//    GUIDED SPOTLIGHT TOUR  (Scan)
//    ================================================================ */
// .tour {
//   /* Anchored inside #app (position:relative + overflow:hidden), so the dim
//      layer and tooltip are clipped to the phone frame — never the page. */
//   position: absolute;
//   inset: 0;
//   z-index: 950;
//   pointer-events: none;   /* let the spotlit element stay interactive;
//                              only the tooltip (below) captures taps */
// }
// 
// .tour[hidden] { display: none; }
// 
// .tour-backdrop {
//   position: absolute;
//   inset: 0;
//   pointer-events: none;
// }
// 
// /* The cutout: a transparent box whose massive shadow dims everything else */
// .tour-spotlight {
//   position: absolute;
//   top: 0; left: 0;
//   width: 0; height: 0;
//   border-radius: var(--r-md);
//   pointer-events: none;
//   box-shadow: 0 0 0 9999px rgba(28, 25, 23, 0.7);
//   transition: top 0.35s cubic-bezier(0.4, 0, 0.2, 1),
//               left 0.35s cubic-bezier(0.4, 0, 0.2, 1),
//               width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
//               height 0.35s cubic-bezier(0.4, 0, 0.2, 1);
// }
// 
// /* Accent ring with a soft pulse — anchored to the cutout */
// .tour-spotlight::after {
//   content: "";
//   position: absolute;
//   inset: -3px;
//   border: 3px solid var(--accent);
//   border-radius: inherit;
//   animation: tourPulse 1.8s ease-in-out infinite;
// }
// 
// @keyframes tourPulse {
//   0%   { box-shadow: 0 0 0 0 rgba(236, 72, 153, 0.4); }
//   70%  { box-shadow: 0 0 0 9px rgba(236, 72, 153, 0); }
//   100% { box-shadow: 0 0 0 0 rgba(236, 72, 153, 0); }
// }
// 
// .tour-tooltip {
//   position: absolute;
//   width: max-content;
//   max-width: 250px;
//   background: var(--s1);
//   border-radius: var(--r-md);
//   padding: 14px 14px 10px;
//   box-shadow: 0 16px 40px rgba(28, 25, 23, 0.32);
//   pointer-events: auto;
//   transition: top 0.35s cubic-bezier(0.4, 0, 0.2, 1),
//               left 0.35s cubic-bezier(0.4, 0, 0.2, 1);
//   animation: modalPop 0.24s cubic-bezier(0.175, 0.885, 0.32, 1.275);
// }
// 
// .tour-close-x {
//   position: absolute;
//   top: 8px;
//   right: 8px;
//   width: 22px;
//   height: 22px;
//   display: flex;
//   align-items: center;
//   justify-content: center;
//   font-size: 0.7rem;
//   color: var(--text-3);
//   background: none;
//   border: none;
//   cursor: pointer;
//   border-radius: 50%;
//   line-height: 1;
// }
// .tour-close-x:hover { color: var(--text); }
// 
// /* Branded header — small pink kicker that ties the card to the Zelo wordmark */
// .tour-kicker {
//   display: block;
//   font-size: 0.62rem;
//   font-weight: 800;
//   letter-spacing: 0.12em;
//   text-transform: uppercase;
//   color: var(--accent);
//   margin-bottom: 5px;
// }
// 
// .tour-text {
//   font-size: 0.92rem;
//   font-weight: 500;
//   line-height: 1.45;
//   color: var(--text);
//   margin-bottom: 12px;
//   transition: transform 0.22s ease-out, opacity 0.22s ease-out;
// }
// 
// .tour-text--entering {
//   transform: translateX(-8px);
//   opacity: 0;
// }
// 
// .tour-close-btn {
//   display: none !important;
// }
// 
// .tour-get-started {
//   background: #ec4899;
//   color: #fff;
//   border: none;
//   border-radius: 20px;
//   padding: 8px 20px;
//   font-size: 14px;
//   font-weight: 600;
//   cursor: pointer;
//   letter-spacing: 0.01em;
//   -webkit-tap-highlight-color: transparent;
//   margin-left: auto;
// }
// 
// .tour-get-started[hidden] { display: none !important; }
// 
// .tour-controls {
//   display: flex;
//   align-items: center;
//   gap: 12px;
//   justify-content: flex-start;
// }
// 
// 
// .tour-back {
//   margin-right: auto;          /* push Next to the right; Back sits at the left */
//   font-size: 0.78rem;
//   font-weight: 600;
//   color: var(--text-3);
//   background: none;
//   padding: 6px 2px;
//   transition: color 0.12s;
// }
// 
// .tour-back:hover { color: var(--text-2); }
// 
// .tour-back[hidden] { display: none; }
// 
// .tour-next {
//   position: relative;
//   overflow: hidden;
//   font-size: 0.85rem;
//   font-weight: 700;
//   color: #fff;
//   background: var(--accent);
//   border-radius: var(--r-sm);
//   padding: 9px 22px;
//   box-shadow: 0 4px 14px rgba(236, 72, 153, 0.25);
//   transition: transform 0.1s;
// }
// 
// .tour-next:active { transform: scale(0.97); }
// 
// /* Settling fill — sweeps across the button as the step arms. Visual only;
//    the button is always tappable, the fill just makes it feel like it's
//    settling in rather than forcing a wait. */
// .tour-next-fill {
//   position: absolute;
//   inset: 0;
//   background: var(--accent-deep);
//   transform-origin: left center;
//   transform: scaleX(0);
//   /* animation (with per-step duration) is applied in JS via armTourButton */
// }
// 
// @keyframes tourFill {
//   from { transform: scaleX(0); }
//   to   { transform: scaleX(1); }
// }
// 
// .tour-next-label {
//   position: relative;   /* sits above the fill */
//   z-index: 1;
//   white-space: nowrap;  /* keep "Get Started" on one line */
// }
// 
// /* Secondary step (screenshot upload) — calmer than the core workflow steps:
//    no pulsing ring, thinner accent, muted instruction. Communicates "optional"
//    visually so Message / Context / Generate read as the priority. */
// .tour--secondary .tour-spotlight::after {
//   border-width: 2px;
//   opacity: 0.55;
//   animation: none;
// }
// 
// 
// /* Transparent tap-target over a highlighted control (e.g. the Scan button).
//    Sits above the dim so the real button underneath can't be triggered twice. */
// .tour-hit {
//   position: absolute;
//   background: transparent;
//   border-radius: 50%;
//   pointer-events: auto;
//   cursor: pointer;
//   z-index: 2;
// }
// 
// .tour-hit[hidden] { display: none; }
// 
// /* Swipe feedback — a big heart (like) or X (pass) that pops over the card as
//    the guided card demo / real swipe happens. Motion + colour carry the meaning. */
// .tour-swipe-feedback {
//   position: absolute;
//   z-index: 3;
//   pointer-events: none;
//   font-size: 5rem;
//   font-weight: 800;
//   line-height: 1;
//   transform: translate(-50%, -50%);
//   animation: tourFbPop 0.65s ease-out forwards;
// }
// 
// .tour-swipe-feedback.like { color: var(--green); }
// .tour-swipe-feedback.nope { color: var(--red); }
// .tour-swipe-feedback[hidden] { display: none; }
// 
// @keyframes tourFbPop {
//   0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
//   35%  { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
//   100% { opacity: 0; transform: translate(-50%, -50%) scale(1.35); }
// }
// 
// /* Completion: full dim (cutout collapsed to a point), centered card, no ring */
// .tour--final .tour-spotlight::after { display: none; }
// 
// 
// /* ================================================================
//    ONBOARDING OVERLAY
//    ================================================================ */
// 
// .onboarding {
//   position: absolute;
//   inset: 0;
//   z-index: 999;
//   background: var(--bg);
//   display: flex;
//   flex-direction: column;
//   align-items: center;
//   justify-content: center;
//   padding: 0 32px;
//   transition: opacity 0.3s ease;
//   user-select: none;
//   -webkit-user-select: none;
// }
// 
// .onboarding-close-btn {
//   position: absolute;
//   top: 18px;
//   right: 20px;
//   background: none;
//   border: none;
//   font-size: 1.1rem;
//   color: var(--text-3);
//   padding: 8px;
//   cursor: pointer;
//   line-height: 1;
//   touch-action: manipulation;
// }
// 
// /* Progress bar is visible — button-driven navigation */
// 
// .onboarding-tap-hint {
//   margin-top: 40px;
//   font-size: 0.78rem;
//   color: var(--text-3);
//   letter-spacing: 0.03em;
// }
// 
// .onboarding.hidden {
//   opacity: 0;
//   pointer-events: none;
// }
// 
// .onboarding-content {
//   position: relative;
//   width: 100%;
//   max-width: 340px;
//   display: flex;
//   flex-direction: column;
//   align-items: center;
//   gap: 0;
// }
// 
// /* Thin progress line — visual momentum only, never gates navigation */
// .onboarding-progress {
//   width: 100%;
//   height: 3px;
//   border-radius: 99px;
//   background: var(--border-2);
//   overflow: hidden;
//   margin-bottom: 30px;
// }
// 
// .onboarding-progress-fill {
//   width: 0;            /* JS sets to (slide+1)/total — animates from here */
//   height: 100%;
//   border-radius: 99px;
//   background: var(--accent);
//   transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
// }
// 
// /* Individual slide — hidden by default, shown when .active */
// .onboarding-slide {
//   display: none;
//   flex-direction: column;
//   align-items: center;
//   text-align: center;
//   width: 100%;
// }
// 
// .onboarding-slide.active {
//   display: flex;
//   animation: obSlideIn 0.28s ease;
// }
// 
// @keyframes obSlideIn {
//   from { opacity: 0; transform: translateY(14px); }
//   to   { opacity: 1; transform: translateY(0); }
// }
// 
// /* Icon container */
// .onboarding-icon {
//   width: 168px;
//   height: 168px;
//   border-radius: 50%;
//   display: flex;
//   align-items: center;
//   justify-content: center;
//   margin-bottom: 36px;
//   animation: obFloat 4s ease-in-out infinite;
// }
// 
// /* Gentle, premium float so the screens feel alive, not empty */
// @keyframes obFloat {
//   0%, 100% { transform: translateY(0)    scale(1);    }
//   50%      { transform: translateY(-8px) scale(1.03); }
// }
// 
// /* Re-trigger the float each time a slide animates in */
// .onboarding-slide.active .onboarding-icon {
//   animation: obIconIn 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards,
//              obFloat 4s ease-in-out 0.45s infinite;
// }
// 
// @keyframes obIconIn {
//   from { opacity: 0; transform: scale(0.7); }
//   to   { opacity: 1; transform: scale(1);   }
// }
// 
// /* Wordmark inside onboarding */
// .onboarding-wordmark {
//   font-size: 2.6rem;
//   font-weight: 800;
//   letter-spacing: -1px;
//   color: var(--accent);
//   margin-bottom: 36px;
// }
// 
// .onboarding-title {
//   font-size: 1.7rem;
//   font-weight: 800;
//   letter-spacing: -0.5px;
//   color: var(--text);
//   line-height: 1.15;
//   margin-bottom: 12px;
// }
// 
// .onboarding-desc {
//   font-size: 0.92rem;
//   color: var(--text-2);
//   line-height: 1.6;
//   max-width: 260px;
// }
// 
// /* Dots */
// .onboarding-dots {
//   display: flex;
//   gap: 7px;
//   margin-top: 36px;
//   margin-bottom: 32px;
// }
// 
// .onboarding-dot {
//   width: 6px;
//   height: 6px;
//   border-radius: 50%;
//   background: var(--border-2);
//   transition: background 0.2s, width 0.2s;
// }
// 
// .onboarding-dot.active {
//   background: var(--text);
//   width: 18px;
//   border-radius: 3px;
// }
// 
// /* Button */
// .onboarding-btn {
//   width: 100%;
//   padding: 16px;
//   background: var(--accent);
//   color: #fff;
//   font-size: 0.95rem;
//   font-weight: 700;
//   border-radius: var(--r-md);
//   letter-spacing: 0.01em;
//   box-shadow: 0 4px 16px rgba(236, 72, 153, 0.25);
//   transition: background 0.15s, transform 0.1s;
// }
// 
// .onboarding-btn:hover  { background: var(--accent-deep); }
// .onboarding-btn:active { transform: scale(0.99); }

// ----------------------------------------------------------------------------
// LEGACY CSS C — removed from style.css (instructions overlay + tour-entry popup)
// ----------------------------------------------------------------------------
// /* ================================================================
//    INSTRUCTIONS OVERLAY (shown every launch — typewriter animation)
//    ================================================================ */
// 
// .instructions {
//   position: absolute;
//   inset: 0;
//   z-index: 999;
//   background: var(--bg);
//   display: flex;
//   flex-direction: column;
//   align-items: center;
//   justify-content: center;
//   padding: 0 32px;
//   transition: opacity 0.3s ease;
//   cursor: pointer;
//   user-select: none;
//   -webkit-user-select: none;
// }
// 
// .instructions.hidden {
//   opacity: 0;
//   pointer-events: none;
// }
// 
// .instructions-content {
//   position: relative;
//   width: 100%;
//   max-width: 340px;
//   display: flex;
//   flex-direction: column;
//   align-items: center;
//   gap: 0;
// }
// 
// .instructions-slide {
//   display: none;
//   flex-direction: column;
//   align-items: center;
//   text-align: center;
//   width: 100%;
// }
// 
// .instructions-slide.active {
//   display: flex;
//   animation: obSlideIn 0.28s ease;
// }
// 
// .instructions-slide.active .onboarding-icon {
//   animation: obIconIn 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards,
//              obFloat 4s ease-in-out 0.45s infinite;
// }
// 
// .instructions-title {
//   font-size: 1.7rem;
//   font-weight: 800;
//   letter-spacing: -0.5px;
//   color: var(--text);
//   line-height: 1.15;
//   margin-bottom: 12px;
//   min-height: 1.2em;
// }
// 
// .instructions-desc {
//   font-size: 0.92rem;
//   color: var(--text-2);
//   line-height: 1.6;
//   max-width: 260px;
//   min-height: 1.6em;
// }
// 
// .instructions-close-btn {
//   position: absolute;
//   top: 18px;
//   right: 20px;
//   background: none;
//   border: none;
//   font-size: 1.1rem;
//   color: var(--text-3);
//   padding: 8px;
//   cursor: pointer;
//   line-height: 1;
//   touch-action: manipulation;
// }
// 
// .instructions-back-btn {
//   margin-top: 20px;
//   font-size: 0.82rem;
//   color: var(--text-3);
//   background: none;
//   border: none;
//   cursor: pointer;
//   padding: 8px 12px;
//   touch-action: manipulation;
// }
// 
// .instructions-dot {
//   width: 6px;
//   height: 6px;
//   border-radius: 50%;
//   background: var(--border-2);
//   transition: background 0.2s, width 0.2s;
// }
// 
// .instructions-dot.active {
//   background: var(--text);
//   width: 18px;
//   border-radius: 3px;
// }
// 
// /* Ensure hidden attribute wins over display:flex on overlay elements */
// .onboarding[hidden],
// .instructions[hidden],
// .tour-entry-overlay[hidden] { display: none !important; }
// 
// /* ============================================================
//    TOUR ENTRY POPUP — "New to Zelo?" shown every launch
//    ============================================================ */
// .tour-entry-overlay {
//   position: absolute;
//   inset: 0;
//   z-index: 998;
//   background: rgba(0,0,0,0.45);
//   display: flex;
//   align-items: center;
//   justify-content: center;
// }
// 
// .tour-entry-card {
//   background: var(--bg);
//   border-radius: 20px;
//   padding: 32px 28px 28px;
//   width: calc(100% - 48px);
//   max-width: 300px;
//   display: flex;
//   flex-direction: column;
//   align-items: center;
//   gap: 6px;
//   text-align: center;
//   box-shadow: 0 8px 40px rgba(0,0,0,0.18);
// }
// 
// .tour-entry-icon {
//   color: var(--accent);
//   margin-bottom: 6px;
// }
// 
// .tour-entry-title {
//   font-size: 1.25rem;
//   font-weight: 800;
//   color: var(--text);
//   margin: 0;
// }
// 
// .tour-entry-sub {
//   font-size: 0.9rem;
//   color: var(--text-2);
//   margin: 0 0 10px;
// }
// 
// .tour-entry-btns {
//   display: flex;
//   flex-direction: column;
//   gap: 10px;
//   width: 100%;
//   margin-top: 4px;
// }
// 
// .tour-entry-yes {
//   background: var(--accent);
//   color: #fff;
//   border: none;
//   border-radius: 99px;
//   padding: 14px 24px;
//   font-size: 0.95rem;
//   font-weight: 700;
//   cursor: pointer;
//   width: 100%;
//   -webkit-tap-highlight-color: transparent;
// }
// 
// .tour-entry-no {
//   background: none;
//   border: none;
//   color: var(--text-3);
//   font-size: 0.88rem;
//   cursor: pointer;
//   padding: 8px;
//   -webkit-tap-highlight-color: transparent;
// }
