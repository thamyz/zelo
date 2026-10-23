// ================================================================
// 07-practice-ui.js — the first-run practice screens
//
// The practice tutorial, the typed "confirm your profile" conversation, and
// the profile-detail sheet opened from a card’s (i) button.
//
// Part of script.js, split by concern. scripts/build.sh joins app/ back
// into script.js, which is what the app actually loads — see that file
// for why. The number in the filename is the load order.
// Map of every module: app/README.md
// ================================================================

// PRACTICE TAB TUTORIAL — replaces the old "who do you want to practice
// with" mode popup as the first-visit experience. 4 steps: welcome screen
// (practiceTutorialStart/Skip) → swipe-right lesson → swipe-left lesson →
// a 1.5s pause → photo-nav lesson (tap-to-dismiss, no real swipe needed
// since cards don't have multiple photos yet). Reuses the real deck and
// real commitSwipe() throughout — a tutorial swipe is a real swipe, just
// intercepted at the very end (see the _practiceTutorialActive check
// inside commitSwipe) so it advances the lesson instead of the normal
// match-overlay/renderDeck continuation.
// ================================================================

let _practiceTutorialActive = false;
let _practiceTutorialStep   = 0; // 2 = swipe right, 3 = swipe left, 4 = photo nav

// The Practice header's profile and settings buttons open screens
// (Account, Home settings) that make no sense mid-onboarding — and a tap
// there would pull the user out of the tutorial. They are hidden until the
// tutorial is finished. `zelo_mode_selected` is the single source of truth
// for "has finished" (set by _finishPracticeTutorial), so this derives the
// state from it instead of tracking a second flag that could drift.
// ---- "Find your type" quest bar (Practice tab) ------------------------------
// Replaces the old "Today's Top Match / Handpicked for you" heading, which
// promised curation there is no data behind. Counts real likes (right swipes
// outside the tutorial) towards QUEST_LIKES_GOAL, shows progress in a ring,
// celebrates once when it is reached, then goes away for good.
// NOTE: nothing is actually learned from the likes yet — it is a goal bar,
// not a recommender. See CLAUDE.md 2026-10-11l.
const QUEST_LIKES_GOAL = 10;
const QUEST_LIKES_KEY  = 'zelo_quest_likes';
const QUEST_DONE_KEY   = 'zelo_quest_done';
let _questHideTimer = null;

function _questLikes() { return Math.max(0, parseInt(localStorage.getItem(QUEST_LIKES_KEY) || '0', 10) || 0); }

function _renderQuestBar() {
  const bar = document.getElementById('quest-bar');
  if (!bar) return;
  const n = Math.min(_questLikes(), QUEST_LIKES_GOAL);
  const done = n >= QUEST_LIKES_GOAL;
  if (done && localStorage.getItem(QUEST_DONE_KEY)) { bar.hidden = true; return; }
  bar.hidden = false;
  bar.classList.toggle('quest-bar--done', done);
  const left = QUEST_LIKES_GOAL - n;
  document.getElementById('quest-title').textContent = done ? 'You’re all set' : 'Finding your type';
  document.getElementById('quest-sub').textContent = done
    ? `You’ve liked ${QUEST_LIKES_GOAL} people`
    : `Like ${left} more ${left === 1 ? 'person' : 'people'} to get started`;
  const ring = document.getElementById('quest-ring-fill');
  if (ring) ring.style.strokeDashoffset = String(125.66 * (1 - n / QUEST_LIKES_GOAL));
  if (done && !_questHideTimer) {
    // Shown once as a win, then it fades away and never comes back.
    _questHideTimer = setTimeout(() => {
      localStorage.setItem(QUEST_DONE_KEY, '1');
      bar.classList.add('quest-bar--out');
      setTimeout(() => { bar.hidden = true; bar.classList.remove('quest-bar--out'); _questHideTimer = null; }, 450);
    }, 4000);
  }
}

// Counts people, not swipes: liking the same person twice (or any double-fired
// handler) can never count twice.
const QUEST_LIKED_KEY = 'zelo_quest_liked';
function _questCountLike(profileId) {
  if (localStorage.getItem(QUEST_DONE_KEY)) return;
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem(QUEST_LIKED_KEY) || '[]'); } catch (_) {}
  const key = profileId || ('anon' + ids.length);
  if (ids.includes(key)) return;
  ids.push(key);
  localStorage.setItem(QUEST_LIKED_KEY, JSON.stringify(ids));
  localStorage.setItem(QUEST_LIKES_KEY, String(ids.length));
  _renderQuestBar();
}

function _syncPracticeOnboardingChrome() {
  const tab = document.getElementById('tab-practice');
  if (!tab) return;
  tab.classList.toggle('tab--onboarding', !localStorage.getItem('zelo_mode_selected'));
  _renderQuestBar();
}

function startPracticeTutorial() {
  _syncPracticeOnboardingChrome();
  const el = document.getElementById('practice-tutorial-welcome');
  if (el) el.hidden = false;
}

function practiceTutorialSkip() {
  const el = document.getElementById('practice-tutorial-welcome');
  if (el) el.hidden = true;
  _finishPracticeTutorial();
}

function practiceTutorialStart() {
  const el = document.getElementById('practice-tutorial-welcome');
  if (el) el.hidden = true;
  // Active BEFORE the deck renders: tutorial cards are built bare (photo only).
  _practiceTutorialActive = true;
  initSwipeDeck({ fresh: true, ignoreSkipped: true, tutorial: true });
  _practiceTutorialStep   = 2;
  _showPracticeTutorialStep();
}

function _practiceTutorialTopPhoto() {
  const card = document.querySelector('#card-deck .swipe-card[data-stack="0"]');
  return card ? card.querySelector('.swipe-card-photo') : null;
}

function _showPracticeTutorialStep() {
  const photo = _practiceTutorialTopPhoto();
  if (!photo) { _finishPracticeTutorial(); return; } // ran out of demo profiles — bail cleanly
  // The photo-count bar is only introduced by the photo lesson.
  document.getElementById('card-deck')?.classList.toggle('ptw-show-progress', _practiceTutorialStep >= 4);
  photo.querySelectorAll('.ptw-swipe-overlay, .ptw-photo-nav-overlay').forEach(n => n.remove());
  photo.classList.remove('ptw-dim');

  if (_practiceTutorialStep === 2) {
    photo.classList.add('ptw-dim');
    photo.insertAdjacentHTML('beforeend', `
      <div class="ptw-swipe-overlay">
        <img class="ptw-swipe-hand" src="assets/icons/onboarding/tutorial-swipe-right.png" alt="" />
        <p class="ptw-swipe-title">Slide right to like</p>
        <p class="ptw-swipe-sub">It will only be a Match if you both Like each other. Try it out!</p>
      </div>`);
  } else if (_practiceTutorialStep === 3) {
    photo.classList.add('ptw-dim');
    photo.insertAdjacentHTML('beforeend', `
      <div class="ptw-swipe-overlay">
        <img class="ptw-swipe-hand ptw-swipe-hand--left" src="assets/icons/onboarding/tutorial-swipe-left.png" alt="" />
        <p class="ptw-swipe-title">Slide left to pass</p>
        <p class="ptw-swipe-sub">If you don't Like them, simply pass. No one has to know you said Nope.</p>
      </div>`);
  } else if (_practiceTutorialStep === 4) {
    photo.insertAdjacentHTML('beforeend', `
      <div class="ptw-photo-nav-overlay" onclick="_practiceTutorialPhotoTap(event)">
        <div class="ptw-photo-divider"></div>
        <div class="ptw-photo-zone ptw-photo-zone--last">
          <img src="assets/icons/onboarding/tutorial-last-photo.png" alt="" />
          <span>Last photo</span>
        </div>
        <div class="ptw-photo-zone ptw-photo-zone--next">
          <img src="assets/icons/onboarding/tutorial-next-photo.png" alt="" />
          <span>Next photo</span>
        </div>
      </div>`);
  }
}

// Runs in two phases around the fly-off, because the two things it can do
// want opposite timing. Swapping one lesson's TEXT for the next should feel
// instant, so that happens as the throw begins ('start'). Handing off to the
// confirm-profile sheet is a screen change, not a lesson swap — arriving
// while the card is still flying reads as the sheet barging in — so that
// waits for the throw to finish ('end').
// Returns true from 'start' when there is still 'end' work to do.
function _handlePracticeTutorialSwipe(direction, phase) {
  // The deck already advanced when the throw began (commitSwipe).
  const expected = _practiceTutorialStep === 2 ? 'right' : 'left';

  if (phase === 'start') {
    if (direction !== expected) {
      // Wrong way: the lesson repeats on the SAME card. commitSwipe already
      // advanced the deck, so step back one and rebuild under the card that is
      // still flying out — its photo slot is remembered, so it comes back as it was.
      state.swipeIndex = Math.max(0, state.swipeIndex - 1);
      renderDeck({ keep: document.querySelector('#card-deck .swipe-card--flying') });
      _showPracticeTutorialStep();
      return false;
    }
    if (_practiceTutorialStep === 2) {
      _practiceTutorialStep = 3;
      _showPracticeTutorialStep();
      return false;
    }
    return _practiceTutorialStep === 3; // confirm-profile, once the card is gone
  }

  const photo = _practiceTutorialTopPhoto();
  photo?.classList.remove('ptw-dim');
  photo?.querySelectorAll('.ptw-swipe-overlay').forEach(n => n.remove());
  _pcOpen();
}

// ---- "Let's confirm your profile" + "Edit Details" — slotted between the
// swipe-left lesson and the photo-nav lesson (see _handlePracticeTutorialSwipe
// above). Reads/writes the SAME localStorage fields the main app onboarding
// (Step 1, and the new "who are you attracted to" step) already uses —
// zelo_display_name / zelo_user_age / zelo_profile_photo / zelo_practice_mode
// — so an edit made here is the same edit made anywhere else in the app, not
// a separate, disconnected copy.
// "Practice with" has four answers: women / men / nonbinary (non-binary people) /
// both (Everyone). Who the user IS (zelo_onb_gender: male / female / other / none)
// is a separate question; the deck combines the two (see initSwipeDeck). A stored
// 'other' is the old "LGBTQ+ women" choice — that library is now routed by the
// pair instead, so it is read as 'women'.
const PRACTICE_WHO_LABELS = { women: 'Women', men: 'Men', nonbinary: 'Non-binary people', both: 'Everyone' };
function _practiceMode() {
  const m = localStorage.getItem('zelo_practice_mode') || 'women';
  if (m === 'other') { localStorage.setItem('zelo_practice_mode', 'women'); return 'women'; }
  return PRACTICE_WHO_LABELS[m] ? m : 'women';
}
function _pedAttractedLabel(mode) {
  return PRACTICE_WHO_LABELS[mode === 'other' ? 'women' : mode] || 'Women';
}
const GENDER_LABELS = { male: 'Man', female: 'Woman', other: 'Non-binary', none: 'Prefer not to say' };

function _practiceRenderConfirmProfile() {
  document.getElementById('pcp-name').textContent = localStorage.getItem('zelo_display_name') || 'John';
  document.getElementById('pcp-age').textContent  = localStorage.getItem('zelo_user_age') || '22';
  document.getElementById('pcp-attracted').textContent = _pedAttractedLabel(_practiceMode());
  // The user's own real photo if they've set one; otherwise the plain grey
  // placeholder icon — not a stock/demo headshot standing in for them.
  const data = localStorage.getItem('zelo_profile_photo');
  const img  = document.getElementById('pcp-avatar-img');
  const ph   = document.getElementById('pcp-avatar-ph');
  if (data) {
    if (img) { img.src = data; img.hidden = false; }
    if (ph)  ph.hidden = true;
  } else {
    if (img) { img.hidden = true; img.removeAttribute('src'); }
    if (ph)  ph.hidden = false;
  }
}

// Drag the "Let's confirm your profile" sheet down to dismiss it. There is
// no cancel path for this step — the only ways out are Continue and Edit
// details — so a dismissal resolves the same way Continue does, rather than
// leaving the tutorial with nothing on screen.
function attachPracticeConfirmDragToClose() {
  _attachPracticeSheetDrag('pcp-sheet-card', practiceConfirmProfileContinue);
  // Edit Details uses the same sheet; dragging it down is its back button —
  // every field there saves itself on pick, so there is no draft to discard.
  _attachPracticeSheetDrag('ped-sheet-card', practiceCloseEditDetails);
}

function _attachPracticeSheetDrag(cardId, onDismiss) {
  const card = document.getElementById(cardId);
  if (!card) return;

  let startY = 0, dragging = false, dy = 0;

  function onStart(clientY) {
    startY = clientY; dragging = true; dy = 0;
    card.style.transition = 'none';
  }
  function onMove(clientY) {
    if (!dragging) return;
    dy = Math.max(0, clientY - startY);
    card.style.transform = `translateY(${dy}px)`;
  }
  function onEnd() {
    if (!dragging) return;
    dragging = false;
    // Same 110px threshold as the profile-detail and AI Coach sheets.
    if (dy > 110) {
      card.style.transition = '';
      card.style.transform = '';
      onDismiss();
    } else {
      card.style.transition = 'transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275)';
      card.style.transform = '';
      setTimeout(() => { card.style.transition = ''; }, 320);
    }
    dy = 0;
  }

  card.addEventListener('touchstart', e => onStart(e.touches[0].clientY), { passive: true });
  card.addEventListener('touchmove',  e => onMove(e.touches[0].clientY),  { passive: true });
  card.addEventListener('touchend',   onEnd);
  card.addEventListener('touchcancel', onEnd);
}


// ================================================================
// PRACTICE TUTORIAL — typed "confirm your profile" conversation
// ================================================================
// Full screen, same typewriter feel as the onboarding intro (and it reuses
// that screen's .cine-convo* styles), but with its own small engine because
// the intro's helpers are wired to its own element ids. Replaces the old
// confirm-profile sheet: that sheet only echoed what had just been typed, and
// carried a profile photo that nothing in the app uses.
//
// Script: congrats → "let's confirm your profile" → what we know (name, age;
// asks how they identify, since the conversation route skips that step) →
// two preferences: who to practice with, and what age range → hand back to
// the tutorial. Everything is written to the same keys Settings reads.
const PC = {
  // Same pace as the onboarding intro (CONVO) — it was 26/12/380 and read faster.
  // Getters, not copies: CONVO is declared further down this file, so reading it
  // while PC is being built would hit its temporal dead zone at load time.
  get charMs() { return CONVO.charMs; }, get spaceMs() { return CONVO.spaceMs; },
  get afterLineMs() { return CONVO.afterLineMs; }, choiceStaggerMs: 85,
  choiceSettleMs: 340, pickBeatMs: 260, liftMs: 420,
  startAt: 0.30, restAt: 0.58,
};
let _pcActive = false, _pcTimers = [], _pcTyping = false, _pcSkip = false;
let _pcTopPx = 0, _pcRecapEl = null, _pcTapResolve = null;

const _PC_SEX_WORD = { female: 'a woman', male: 'a man', other: 'non-binary', none: '' };
const _PC_AGE_OPTS = [
  { value: '18-24', label: '18–24' }, { value: '25-30', label: '25–30' },
  { value: '31-39', label: '31–39' }, { value: 'any',   label: 'Any age' },
];

function _pcWait(ms) { return new Promise(res => { _pcTimers.push(setTimeout(res, ms)); }); }
function _pcClearTimers() { _pcTimers.forEach(clearTimeout); _pcTimers = []; }

function _pcRelift() {
  const stage = document.getElementById('pc-stage');
  const wrap  = document.getElementById('pc-convo');
  if (!stage || !wrap) return;
  const bottom = _pcTopPx + stage.scrollHeight;
  const lift = Math.max(0, Math.round(bottom - wrap.clientHeight * PC.restAt));
  stage.style.setProperty('--convo-lift', `-${lift}px`);
}

async function _pcType(text, opts = {}) {
  const lines = document.getElementById('pc-lines');
  if (!lines || !_pcActive) return null;
  lines.querySelectorAll('.cine-convo-line').forEach(el => el.classList.add('cine-convo-line--past'));
  const el = document.createElement('p');
  el.className = 'cine-convo-line cine-convo-caret' + (opts.accent ? ' cine-convo-line--accent' : '');
  lines.appendChild(el);
  _pcRelift();
  _pcTyping = true; _pcSkip = false;
  for (let i = 0; i < text.length && _pcActive; i++) {
    if (_pcSkip) { el.textContent = text; break; }
    const ch = text[i];
    el.textContent += ch;
    _convoTick(ch);
    _pcRelift();
    await _pcWait(ch === ' ' ? PC.spaceMs : PC.charMs);
  }
  el.classList.remove('cine-convo-caret');
  _pcRelift();
  _pcTyping = false; _pcSkip = false;
  if (!opts.noBeat) await _pcWait(PC.afterLineMs);
  return el;
}

// A tap while a line is typing finishes that line at once (one tap, one line).
function pcTap(e) {
  if (e && e.target.closest('.cine-convo-choices')) return;
  if (_pcTyping) { _pcSkip = true; return; }
  if (_pcTapResolve) { const r = _pcTapResolve; _pcTapResolve = null; r(); }
}

// Shows the choices one after another from the top and resolves with the
// picked option. `selected` pre-highlights an earlier/default answer. With
// `canBack`, the back button is shown and resolves { back: true } instead.
let _pcBackFn = null;
function _pcSetBack(on) {
  const b = document.getElementById('pc-back');
  if (b) b.hidden = !on;
}
function pcBack() { if (_pcBackFn) { _cineHaptic('LIGHT'); _pcBackFn(); } }

function _pcChoose(opts, selected, canBack) {
  return new Promise(resolve => {
    const wrap = document.getElementById('pc-choices');
    wrap.innerHTML = ''; wrap.hidden = false;
    const close = () => {
      wrap.hidden = true; wrap.innerHTML = ''; delete wrap.dataset.locked;
      _pcBackFn = null; _pcSetBack(false);
      _pcRelift();
    };
    opts.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cine-convo-choice' + (o.sub ? ' cine-convo-choice--sub' : '') + (o.value === selected ? ' selected' : '');
      b.textContent = o.label;
      b.onclick = async (ev) => {
        ev.stopPropagation();
        if (wrap.dataset.locked) return;
        wrap.dataset.locked = '1';
        _pcBackFn = null; _pcSetBack(false);
        _cineHaptic('LIGHT');
        wrap.querySelectorAll('.cine-convo-choice').forEach(x => x.classList.toggle('selected', x === b));
        await _pcWait(PC.pickBeatMs);
        close();
        resolve(o);
      };
      wrap.appendChild(b);
      _pcTimers.push(setTimeout(() => {
        b.classList.add('cine-convo-choice--in');
        _pcTimers.push(setTimeout(() => {
          b.classList.remove('cine-convo-choice--in');
          b.classList.add('cine-convo-choice--shown');
        }, PC.choiceSettleMs + 40));
      }, PC.choiceStaggerMs * i));
    });
    if (canBack) {
      _pcBackFn = () => {
        if (wrap.dataset.locked) return;
        wrap.dataset.locked = '1';
        close();
        resolve({ back: true });
      };
      _pcSetBack(true);
    }
    _pcRelift();
  });
}

function _pcRecapText() {
  const name = localStorage.getItem('zelo_display_name') || 'John';
  const age  = localStorage.getItem('zelo_user_age');
  const sex  = _PC_SEX_WORD[localStorage.getItem('zelo_onb_gender')];
  return `${name}, ${age || '—'}${sex ? ', ' + sex : ''}.`;
}

function _pcCurrentAgeValue() {
  const preset = localStorage.getItem('zelo_age_range');
  if (preset && AGE_FILTER_PRESET_RANGES[preset]) return preset;
  return _ageFilterRange() ? null : 'any';
}

function _pcApplyAge(value) {
  const key = ['zelo_age_filter_min', 'zelo_age_filter_max'];
  if (value === 'any') {
    localStorage.removeItem('zelo_age_range');
    key.forEach(k => localStorage.removeItem(k));
  } else {
    const [lo, hi] = AGE_FILTER_PRESET_RANGES[value];
    localStorage.setItem('zelo_age_range', value);
    localStorage.setItem('zelo_age_filter_min', String(lo));
    localStorage.setItem('zelo_age_filter_max', String(hi));
  }
}

// Applies the two answers to the deck WITHOUT changing the card the user has
// been looking at (the conversation covers the screen, but they remember it).
// The card on top is pinned if it still fits the new preferences; the rest of
// the deck is rebuilt around it, minus the two demo cards.
function _pcRebuildDeck() {
  const held = state.swipeProfiles[state.swipeIndex];
  initSwipeDeck({ fresh: true, pin: held && held.id, exclude: PRACTICE_TUTORIAL_CARDS.map(c => c.id) });
}

// Removes one step's typed lines (bottom first, same motion as the final
// clear-out) so that step can be asked again from its choices.
async function _pcRemoveLines(els) {
  for (let i = els.length - 1; i >= 0; i--) {
    els[i].classList.add('cine-convo-line--out');
    await _pcWait(CONVO.clearStaggerMs);
  }
  await _pcWait(CONVO.clearOutMs);
  els.forEach(e => e.remove());
  _pcRelift();
  // The line above is the newest again, so it reads as current, not past.
  const last = document.querySelector('#pc-lines .cine-convo-line:last-child');
  last?.classList.remove('cine-convo-line--past');
}

// The questions, in order. Each types its own lines once (kept in `lines` so a
// Back can remove them) and then shows choices; going back removes the later
// step's lines and re-shows the earlier step's choices with its answer
// highlighted — the earlier question is not typed again.
function _pcBuildSteps(needGender) {
  const mode = () => _practiceMode();
  return [
    { id: 'gender', skip: () => !needGender, lines: [],
      type: async (st) => { st.lines.push(await _pcType('How do you identify?', { noBeat: true })); },
      choose: (canBack) => _pcChoose([
        { value: 'male', label: 'Man' }, { value: 'female', label: 'Woman' },
        { value: 'other', label: 'Non-binary' }, { value: 'none', label: 'Prefer not to say' },
      ], localStorage.getItem('zelo_onb_gender') || 'male', canBack),
      apply: (o) => {
        cineAnswers.gender = o.value;
        localStorage.setItem('zelo_onb_gender', o.value);
        try { ZeloRecords.queueOnboarding(cineAnswers); } catch (_) {}
      } },
    { id: 'recap', lines: [],
      type: async (st) => { _pcRecapEl = await _pcType(`Got it: ${_pcRecapText()}`, { accent: true, noBeat: true }); st.lines.push(_pcRecapEl); },
      choose: (canBack) => _pcRecapChoices(canBack),
      apply: () => {} },
    { id: 'who', lines: [],
      type: async (st) => {
        st.lines.push(await _pcType('Two quick things, so your matches actually fit you.'));
        st.lines.push(await _pcType('Who do you want to practice talking to?', { noBeat: true }));
      },
      choose: (canBack) => _pcChoose([
        { value: 'women', label: 'Women' }, { value: 'men', label: 'Men' },
        { value: 'nonbinary', label: 'Non-binary people' }, { value: 'both', label: 'Everyone' },
      ], mode(), canBack),
      apply: (o) => {
        localStorage.setItem('zelo_practice_mode', o.value);
        cineAnswers.attracted = o.value;   // in-memory only (onboarding nav state)
      } },
    { id: 'age', lines: [],
      type: async (st) => { st.lines.push(await _pcType('And what age range feels right for them?', { noBeat: true })); },
      choose: (canBack) => _pcChoose(_PC_AGE_OPTS, _pcCurrentAgeValue(), canBack),
      apply: (o) => _pcApplyAge(o.value) },
  ];
}

async function _pcOpen() {
  const wrap = document.getElementById('pc-convo');
  if (!wrap || _pcActive) return;
  _pcActive = true;
  _pcClearTimers();
  document.getElementById('pc-lines').innerHTML = '';
  const choices = document.getElementById('pc-choices');
  choices.innerHTML = ''; choices.hidden = true;
  _pcSetBack(false); _pcBackFn = null;
  wrap.classList.remove('cine-convo--out');
  wrap.hidden = false;
  const stage = document.getElementById('pc-stage');
  stage.style.removeProperty('--convo-lift');
  _pcTopPx = Math.round(wrap.clientHeight * PC.startAt);
  stage.style.setProperty('--convo-top', _pcTopPx + 'px');
  try {
    await _pcType('Nice. You’ve got swiping down.', { accent: true });
    await _pcType('Now let’s confirm your profile.');
    const name = localStorage.getItem('zelo_display_name') || 'John';
    const age  = localStorage.getItem('zelo_user_age');
    await _pcType(age ? `So far, I know you as ${name}, ${age}.` : `So far, I know you as ${name}.`);

    const needGender = !(localStorage.getItem('zelo_onb_gender') in _PC_SEX_WORD);
    const steps = _pcBuildSteps(needGender);
    const live = (i) => !(steps[i].skip && steps[i].skip());
    const prevOf = (i) => { for (let j = i - 1; j >= 0; j--) if (live(j)) return j; return -1; };
    let i = 0;
    while (i < steps.length) {
      if (!live(i)) { i++; continue; }
      const st = steps[i];
      if (!st.lines.length) await st.type(st);
      if (!_pcActive) return;
      const res = await st.choose(prevOf(i) >= 0);
      if (!_pcActive) return;
      if (res && res.back) {
        const j = prevOf(i);
        await _pcRemoveLines(st.lines);
        st.lines = [];
        i = j;
        continue;
      }
      st.apply(res);
      i++;
    }
    _pcRebuildDeck();
    await _pcType(`All set, ${localStorage.getItem('zelo_display_name') || 'John'}. Let’s meet your first match.`, { accent: true });
    await _pcWait(300);
    await _pcFinish();
  } catch (e) { /* torn down mid-script */ }
}

// "That's me" moves on; "Change something" opens Edit Details and comes back
// through _pcAfterEdit(), which refreshes the recap and asks again.
async function _pcRecapChoices(canBack) {
  const pick = await _pcChoose([
    { value: 'ok', label: 'That’s me' },
    { value: 'edit', label: 'Change something', sub: true },
  ], null, canBack);
  if (pick.back || pick.value !== 'edit') return pick;
  const wrap = document.getElementById('pc-convo');
  wrap.hidden = true;
  _practiceRenderEditDetails();
  document.getElementById('practice-edit-details').hidden = false;
  await new Promise(res => { _pcEditResolve = res; });
  return _pcRecapChoices(canBack);
}
let _pcEditResolve = null;
function _pcAfterEdit() {
  if (_pcRecapEl) _pcRecapEl.textContent = `Got it: ${_pcRecapText()}`;
  document.getElementById('pc-convo').hidden = false;
  _pcRelift();
  const r = _pcEditResolve; _pcEditResolve = null;
  if (r) r();
}

// Empties the stack bottom-first, fades out over the deck, and hands back to
// the tutorial's next lesson.
async function _pcFinish() {
  const lines = [...document.querySelectorAll('#pc-lines .cine-convo-line')];
  for (let i = lines.length - 1; i >= 0; i--) {
    lines[i].classList.add('cine-convo-line--out');
    await _pcWait(CONVO.clearStaggerMs);
  }
  await _pcWait(CONVO.clearOutMs);
  const wrap = document.getElementById('pc-convo');
  wrap.classList.add('cine-convo--out');
  await _pcWait(220);
  _pcTeardown();
  if (!_practiceTutorialActive) return;
  _practiceTutorialStep = 4;
  _showPracticeTutorialStep();
}

function _pcTeardown() {
  _pcActive = false; _pcTyping = false; _pcSkip = false;
  _pcClearTimers();
  _pcTapResolve = null; _pcEditResolve = null; _pcRecapEl = null; _pcBackFn = null; _pcSetBack(false);
  const wrap = document.getElementById('pc-convo');
  if (wrap) { wrap.hidden = true; wrap.classList.remove('cine-convo--out'); }
  const lines = document.getElementById('pc-lines'); if (lines) lines.innerHTML = '';
  const ch = document.getElementById('pc-choices'); if (ch) { ch.innerHTML = ''; ch.hidden = true; delete ch.dataset.locked; }
}

function practiceConfirmProfileContinue() {
  const el = document.getElementById('practice-confirm-profile');
  if (el) el.hidden = true;
  if (!_practiceTutorialActive) return; // user backed out via Edit Details/Settings mid-way
  _practiceTutorialStep = 4;
  _showPracticeTutorialStep();
}

function practiceOpenEditDetails() {
  document.getElementById('practice-confirm-profile').hidden = true;
  _practiceRenderEditDetails();
  document.getElementById('practice-edit-details').hidden = false;
}

// Both "back" and "Save Changes" return the same way — every field here
// saves itself immediately when picked (see pedConfirmName/pedPickAttracted/
// cineOpenAgeSheet/pedPhotoSelected), so there's no separate draft/commit
// step to distinguish between "saved" and "cancelled".
function _practiceReturnToConfirmProfile() {
  document.getElementById('practice-edit-details').hidden = true;
  if (_pcActive) { _pcAfterEdit(); return; }
  _practiceRenderConfirmProfile();
  document.getElementById('practice-confirm-profile').hidden = false;
}
function practiceCloseEditDetails() { _practiceReturnToConfirmProfile(); }
function practiceSaveEditDetails()  { _practiceReturnToConfirmProfile(); }

function _practiceRenderEditDetails() {
  document.getElementById('ped-name-val').textContent = localStorage.getItem('zelo_display_name') || 'John';
  document.getElementById('ped-age-val').textContent  = localStorage.getItem('zelo_user_age') || '22';
  document.getElementById('ped-attracted-val').textContent = _pedAttractedLabel(_practiceMode());
  const _gv = document.getElementById('ped-gender-val'); if (_gv) _gv.textContent = GENDER_LABELS[localStorage.getItem('zelo_onb_gender')] || 'Not set';
  _pedRenderPhoto();
}

// ---- Photo — parallel to cinePickPhoto/cinePhotoSelected/cineRenderPhoto
// (Step 1 of the main onboarding), targeting this screen's own avatar
// elements instead. Same zelo_profile_photo key, so either editor sees the
// other's change.
function pedPickPhoto() { document.getElementById('ped-photo-input')?.click(); }
function pedPhotoSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    localStorage.setItem('zelo_profile_photo', reader.result);
    _pedRenderPhoto();
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}
function _pedRenderPhoto() {
  const data = localStorage.getItem('zelo_profile_photo');
  const img  = document.getElementById('ped-avatar-img');
  const ph   = document.getElementById('ped-avatar-ph');
  const del  = document.getElementById('ped-avatar-del');
  if (data) {
    if (img) { img.src = data; img.hidden = false; }
    if (ph)  ph.hidden = true;
  } else {
    if (img) { img.hidden = true; img.removeAttribute('src'); }
    if (ph)  ph.hidden = false;
  }
  if (del) del.hidden = !data;
}

// stopPropagation so tapping the X never also triggers the avatar's own
// onclick (sits underneath it) and immediately reopens the picker — same
// reasoning as cineRemovePhoto (Step 1).
function pedRemovePhoto(e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  localStorage.removeItem('zelo_profile_photo');
  _pedRenderPhoto();
}

// ---- Name — small bottom sheet (own, not Step 1's inline field — Step 1
// isn't a modal, so there's nothing to reuse there beyond the validation).
function pedOpenNameSheet() {
  const input = document.getElementById('ped-name-input');
  if (input) input.value = localStorage.getItem('zelo_display_name') || '';
  document.getElementById('ped-name-sheet').hidden = false;
  input?.focus();
}
function pedCloseNameSheet() { document.getElementById('ped-name-sheet').hidden = true; }
function pedConfirmName() {
  const input = document.getElementById('ped-name-input');
  const trimmed = (input?.value || '').trim();
  if (cineNameValid(trimmed)) {
    localStorage.setItem('zelo_display_name', trimmed);
    document.getElementById('ped-name-val').textContent = trimmed;
  }
  pedCloseNameSheet();
}

// ---- Attracted to — small bottom sheet, same 3 options/colors as the main
// onboarding's own "who are you attracted to" step, writing to the same
// zelo_practice_mode key.
function pedOpenAttractedSheet() {
  const current = _practiceMode();
  document.querySelectorAll('#ped-opts-attracted .cine-opt').forEach((b) => {
    b.classList.toggle('selected', b.dataset.val === current);
  });
  document.getElementById('ped-attracted-sheet').hidden = false;
}
function pedCloseAttractedSheet() { document.getElementById('ped-attracted-sheet').hidden = true; }

// ---- "I am" — who the user is. Only used to pick which library fits them
// (see initSwipeDeck); never shown to anyone and not uploaded.
function pedOpenGenderSheet() {
  const cur = localStorage.getItem('zelo_onb_gender');
  document.querySelectorAll('#ped-opts-gender .cine-opt').forEach(b => b.classList.toggle('selected', b.dataset.val === cur));
  document.getElementById('ped-gender-sheet').hidden = false;
}
function pedCloseGenderSheet() { document.getElementById('ped-gender-sheet').hidden = true; }
function pedPickGender(value) {
  localStorage.setItem('zelo_onb_gender', value);
  cineAnswers.gender = value;
  try { ZeloRecords.queueOnboarding(cineAnswers); } catch (_) {}
  _invalidateDeck();
  const gv = document.getElementById('ped-gender-val'); if (gv) gv.textContent = GENDER_LABELS[value] || 'Not set';
  pedCloseGenderSheet();
}
function pedPickAttracted(value, el) {
  localStorage.setItem('zelo_practice_mode', value);
  _invalidateDeck();
  document.getElementById('ped-attracted-val').textContent = _pedAttractedLabel(value);
  if (el && el.parentElement) {
    el.parentElement.querySelectorAll('.cine-opt').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
  }
  pedCloseAttractedSheet();
}

function _practiceTutorialPhotoTap(e) {
  e.stopPropagation();
  _finishPracticeTutorial();
}

function _finishPracticeTutorial() {
  _practiceTutorialActive = false;
  _practiceTutorialStep   = 0;
  localStorage.setItem('zelo_mode_selected', '1');
  _syncPracticeOnboardingChrome();   // buttons come back now it's done
  const photo = _practiceTutorialTopPhoto();
  photo?.querySelectorAll('.ptw-swipe-overlay, .ptw-photo-nav-overlay').forEach(n => n.remove());
  photo?.classList.remove('ptw-dim');

  // The cards the user has been looking at are kept: the name and buttons just
  // fade in on them. Rebuilding the deck here swapped the card under the user.
  const bare = document.querySelectorAll('#card-deck .swipe-card--bare');
  bare.forEach(c => c.classList.remove('swipe-card--bare'));
  // practiceTutorialSkip() can reach here without ever going through
  // practiceTutorialStart() (which is what normally loads the deck) —
  // without this, skipping straight from the welcome screen leaves
  // #card-deck permanently empty.
  if (!bare.length) initSwipeDeck();
}


// ================================================================
// BUTTON HANDLERS
// ================================================================

function onSkipBtn() {
  if (_swipeLock) return;
  const topCard = document.querySelector('#card-deck [data-stack="0"]');
  if (!topCard) return;
  disableSwipeButtons();
  commitSwipe(topCard, 'left');
}

// Rewind: brings back the last person you skipped (and the one before that,
// on repeated taps, back to your last like). The card comes back in from
// the left, the way it left, and is taken off the Skipped Profiles list.
function onRewindBtn() {
  if (_swipeLock || _practiceTutorialActive) return;
  const hist = state.skipHistory || [];
  if (!hist.length) return;
  const idx = hist.pop();
  const profile = state.swipeProfiles[idx];
  if (!profile) return;
  _removeSkippedProfile(profile.id);
  state.swipeIndex = idx;
  renderDeck();
  const top = document.querySelector('#card-deck [data-stack="0"]');
  if (top) {
    top.classList.add('swipe-card--rewind');
    setTimeout(() => top.classList.remove('swipe-card--rewind'), 520);   // one-shot (2026-10-09j)
  }
  navigator.vibrate?.(8);
  _cineHaptic('LIGHT');
}

function onLikeBtn() {
  if (_swipeLock) return;
  const topCard = document.querySelector('#card-deck [data-stack="0"]');
  if (!topCard) return;
  disableSwipeButtons();
  commitSwipe(topCard, 'right');
}

function disableSwipeButtons() {
  const skip = document.getElementById('btn-skip');
  const like = document.getElementById('btn-like');
  if (skip) skip.disabled = true;
  if (like) like.disabled = true;
}

function enableSwipeButtons() {
  const skip = document.getElementById('btn-skip');
  const like = document.getElementById('btn-like');
  if (skip) skip.disabled = false;
  if (like) like.disabled = false;
}


// ================================================================
// PROFILE DETAIL — full-screen, modal-style page opened by tapping the
// swipe card (not dragging it). Shows everything the card shows plus the
// Open/Neutral mode pills, and moves Skip/I'm Interested down here.
// The Home tab stays rendered (and active) behind the dim backdrop —
// this does NOT use pushScreen()/the .screen takeover system.
// ================================================================

function openProfileDetail() {
  const profile = state.swipeProfiles[state.swipeIndex];
  if (!profile) return;

  const modal = document.getElementById('profile-detail-modal');
  if (!modal) return;

  // Populate gradient photo area
  const photo = document.getElementById('pd-photo');
  photo.style.background = `linear-gradient(145deg, ${profile.gradientColors[0]}, ${profile.gradientColors[1]})`;
  // Real photo when the profile has one; the initial-on-gradient stays as
  // the fallback. The gradient is left underneath either way, so a slow or
  // failed image load never shows a bare box.
  photo.innerHTML = (profile.photos && profile.photos.length)
    ? `<img src="${profile.photos[0]}" alt="" aria-hidden="true" onerror="this.remove()">`
    : `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:4rem;font-weight:700;color:rgba(255,255,255,0.9);">${profile.initial}</span>`;
  photo.style.position = 'relative';

  // Populate text fields
  document.getElementById('pd-name').textContent = profile.name;
  document.getElementById('pd-age').textContent  = profile.age;
  document.getElementById('pd-occ').textContent  = profile.occupation;
  // About her / interests / in short, written per persona (personas-about.js).
  // Falls back to her bio and interests if a profile has no entry.
  const about = (typeof PERSONA_ABOUT !== 'undefined' && PERSONA_ABOUT[profile.id]) || null;
  document.getElementById('pd-bio').textContent = about ? about.about : profile.bio;
  const topics = about ? about.topics : (profile.interests || []).map(t => ['✨', t]);
  document.getElementById('pd-tags').innerHTML = topics.map(([e, t]) =>
    `<span class="pd-topic"><span aria-hidden="true">${e}</span>${_escapeHtml(t)}</span>`).join('');
  const shortCard = document.getElementById('pd-short-card');
  shortCard.hidden = !about;
  if (about) document.getElementById('pd-short').textContent = about.short;

  // Tap backdrop to close
  modal.onclick = e => { if (e.target === modal) closeProfileDetail(); };

  modal.removeAttribute('hidden');
}

function closeProfileDetail() {
  const modal = document.getElementById('profile-detail-modal');
  if (modal) modal.setAttribute('hidden', '');
}

// Combined touch-gesture handler, attached to each of the three tabs
// (Home / Scan / Chats): vertical rubber-band overscroll feel (existing) +
// horizontal swipe-to-navigate between adjacent tabs (Home <-> Scan <->
// Chats), rendered as a full-screen page-slide — both the current and
// destination .tab elements are visible and move together 1:1 with the
// finger, like paging between photos in iOS Photos/Instagram Stories, not
// a small edge peek. One handler per tab decides the gesture's axis once
// (on the first move past a small deadzone) and locks into either
// vertical-rubber-band or horizontal-nav for the rest of that touch — they
// never run simultaneously or fight each other.
const TAB_SWIPE_ORDER = ['practice', 'assistant', 'chats'];

// Shared single-container slide-track helpers — used by both the tab
// carousel and the screen-back gesture below. A live element (never a
// clone) is temporarily reparented into a shared flex track as a sibling
// of whatever it should slide alongside, and only the TRACK's own
// transform is ever animated. Two independently-transformed elements —
// even algebraically kept in sync — can still live on separate compositor
// layers that don't necessarily paint in lockstep on real hardware; one
// element moving as a single unit has no such failure mode.
