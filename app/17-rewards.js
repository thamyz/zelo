// ================================================================
// 17-rewards.js — everything that rewards the user for coming back
//
// Leaderboard, Refer Friends (real server-issued codes), Your Journey,
// XP and levels, Mission Control and the Milestones badge system.
//
// Part of script.js, split by concern. scripts/build.sh joins app/ back
// into script.js, which is what the app actually loads — see that file
// for why. The number in the filename is the load order.
// Map of every module: app/README.md
// ================================================================

// FEATURE 9 — LEADERBOARD
// Paid only. Entry from dashboard. Mocked static data.
// ================================================================

function getDisplayName() {
  let name = localStorage.getItem('zelo_display_name');
  if (!name) {
    name = 'Player #' + String(Math.floor(1000 + Math.random() * 9000));
    localStorage.setItem('zelo_display_name', name);
  }
  return name;
}

function saveDisplayName(name) {
  localStorage.setItem('zelo_display_name', name.trim() || getDisplayName());
}

// ================================================================
// REFER FRIENDS — see screen-refer-friends in index.html.
// ================================================================
// A real, server-issued 5-character code (profiles.referral_code), not invented client-side — a
// different account can actually resolve it back to this one at redemption time. See
// services/records.js getMyReferralCode() / supabase/migrations/20261019150000_referral_codes.sql.
// Shown/copied/shared as just the bare code (e.g. "XK9P2") — no domain, no https://. The landing page
// still exists at zelofficial.com/join/CODE (for the rich link preview in the image shares and for
// navigator.share's url field, which needs a real absolute URL to work), but nothing user-facing shows
// that domain — redemption itself only ever needs the code, typed into the app directly (step 8).
const REFERRAL_DOMAIN = 'zelofficial.com/join/';
async function getReferralCode() {
  let code = await ZeloRecords.getMyReferralCode();
  // No code usually means the account has no profile row to hold it (the server refuses to hand out a
  // code it could not save). Create the row, then ask once more.
  if (!code && typeof AUTH !== 'undefined' && AUTH.ensureProfile && await AUTH.ensureProfile()) {
    code = await ZeloRecords.getMyReferralCode();
  }
  return code || null;
}
async function _referralFullUrl() {
  const code = await getReferralCode();
  return code ? 'https://' + REFERRAL_DOMAIN + code : null;
}

function openReferFriends() {
  const go = async () => {
    pushScreen('refer-friends');
    const el = document.getElementById('refer-link-text');
    el.textContent = 'Loading…';
    const code = await getReferralCode();
    el.textContent = code || "Couldn't load your code. Try again in a moment.";
  };
  if (typeof AUTH !== 'undefined' && AUTH.signedIn && !AUTH.signedIn()) { AUTH.requireAuth('refer-friends', go); return; }
  go();
}
function closeReferFriends() { popScreen(); }

async function copyReferralLink() {
  const code = await getReferralCode();
  if (!code) { showChatToast("Couldn't load your code. Try again in a moment."); return; }
  navigator.clipboard?.writeText(code).then(() => {
    ZeloAnalytics.track('referral_link_shared', { via: 'copy' });
    showCopyToast('Referral code copied to clipboard');
  }).catch(() => {});
}

// The ONE share entry point (just "Share with friends" now — no custom per-app icon row). The real
// native share sheet (UIActivityViewController, MainViewController.swift) already shows every
// installed app's own real icon (Messages, WhatsApp, Instagram, Mail, whatever) — nothing to draw or
// fake here, the OS does it. navigator.share() is the fallback when the native handler isn't available
// (e.g. testing outside the iOS app) — it works, but iOS shows a generic link icon in its own preview
// rather than Zelo's, since that preview reflects the shared URL, not which app initiated the share.
async function shareReferral() {
  const code = await getReferralCode();
  if (!code) { showChatToast("Couldn't load your code. Try again in a moment."); return; }
  ZeloAnalytics.track('referral_link_shared', { via: 'native_share' });
  const url = await _referralFullUrl();   // needs a real absolute URL
  const text = `Join me on Zelo! Use my code: ${code}`;
  const handlers = window.webkit && window.webkit.messageHandlers;
  if (handlers && handlers.zeloShareGeneric) {
    handlers.zeloShareGeneric.postMessage({ text, url });
    return;
  }
  if (navigator.share) {
    navigator.share({ title: 'Zelo', text, url }).catch(() => {});
  } else {
    copyReferralLink();
  }
}

let lbTimeFilter = 'weekly';
let lbCategory   = 'messages';

function openLeaderboard() {
  // DEV — restore paid gate before release
  // if (!isPaidUser()) {
  //   flashLimitToast('Leaderboard is a paid feature.');
  //   return;
  // }
  lbTimeFilter = 'weekly';
  lbCategory   = 'messages';
  renderLeaderboard();
  pushScreen('leaderboard');
}

function setLbTimeFilter(f) { lbTimeFilter = f; renderLeaderboard(); }
function setLbCategory(c)   { lbCategory   = c; renderLeaderboard(); }

// Leaderboard settings sheet — skeleton only. Toggles flip their own
// switch visually; nothing is persisted or wired to real behavior yet
// (same build-architecture-first convention as the rest of this screen).
// ── Leaderboard settings ────────────────────────────────────────
// These used to be three checkboxes wired to a function that only vibrated:
// nothing persisted, nothing changed, and two of them read as privacy
// controls ("Show me on leaderboard", "Display as anonymous"). They are real
// now. Anonymous is ON by default, which is what the Privacy Policy already
// states ("By default you appear ... as an anonymized Player #[number]").
const LB_SETTINGS_KEY = 'zelo_lb_settings';
const LB_PLAYER_NO_KEY = 'zelo_lb_player_no';
const LB_SETTINGS_DEFAULTS = { show: true, anon: true, notify: false };

function lbSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(LB_SETTINGS_KEY) || '{}');
    return { ...LB_SETTINGS_DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) };
  } catch (e) { return { ...LB_SETTINGS_DEFAULTS }; }
}

function _lbSaveSettings(next) {
  try { localStorage.setItem(LB_SETTINGS_KEY, JSON.stringify(next)); } catch (e) {}
}

// Stable per device so the anonymous handle doesn't change under the user
// between sessions.
function lbPlayerNumber() {
  let n = localStorage.getItem(LB_PLAYER_NO_KEY);
  if (!n) {
    n = String(1000 + Math.floor(Math.random() * 9000));
    try { localStorage.setItem(LB_PLAYER_NO_KEY, n); } catch (e) {}
  }
  return n;
}

// The name to show for THIS user on the board.
function lbDisplayName() {
  return lbSettings().anon ? 'Player #' + lbPlayerNumber() : getDisplayName();
}

function openLeaderboardSettings() {
  const sheet = document.getElementById('lb-settings-sheet');
  if (!sheet) return;
  const cfg = lbSettings();
  sheet.querySelectorAll('[data-lb-setting]').forEach(input => {
    input.checked = !!cfg[input.dataset.lbSetting];
  });
  sheet.hidden = false;
}
function closeLeaderboardSettings() {
  const sheet = document.getElementById('lb-settings-sheet');
  if (sheet) sheet.hidden = true;
}
function toggleLbSetting(el) {
  navigator.vibrate?.(4);
  const key = el && el.dataset ? el.dataset.lbSetting : null;
  if (!key) return;
  const next = lbSettings();
  next[key] = !!el.checked;
  _lbSaveSettings(next);
  renderLeaderboard();   // the change has to be visible immediately
}

// Shared rank lookup — used by the full leaderboard screen and by the
// Account page's compact leaderboard card, so both always agree.
function getMyLeaderboardEntry() {
  const data   = getLbData(lbTimeFilter, lbCategory);
  const myName = lbDisplayName();
  return data.find(e => e.name === myName) || { rank: data.length + 1, name: myName, score: 0 };
}

const LB_UNITS = { streak: 'days', messages: 'messages', level: 'levels' };

const LB_CAT_NAMES = { streak: 'Longest Streak', messages: 'Most Messages', level: 'Most Level' };
const LB_PERIOD_NOW = { weekly: 'this week', monthly: 'this month', alltime: 'yet' };

// Time left in the current week (Monday start) or month, from the real clock. All-time has no end.
function _lbTimerInfo(filter) {
  const now = new Date();
  let end;
  if (filter === 'weekly') { end = new Date(now); end.setHours(0, 0, 0, 0); end.setDate(end.getDate() + ((8 - end.getDay()) % 7 || 7)); }
  else if (filter === 'monthly') end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  else return null;
  let ms = Math.max(0, end - now);
  const d = Math.floor(ms / 86400000); ms -= d * 86400000;
  const hrs = Math.floor(ms / 3600000); ms -= hrs * 3600000;
  const m = Math.floor(ms / 60000);
  return { label: filter === 'weekly' ? 'This week ends in' : 'This month ends in', value: (d ? d + 'd ' : '') + hrs + 'h ' + m + 'm' };
}

function renderLeaderboard() {
  const data       = getLbData(lbTimeFilter, lbCategory);
  const myName     = lbDisplayName();
  const myEntry    = getMyLeaderboardEntry();
  const unit       = LB_UNITS[lbCategory] || 'points';

  // Time filter tabs
  ['weekly','monthly','alltime'].forEach(f => {
    const btn = document.getElementById('lb-time-' + f);
    if (btn) btn.classList.toggle('active', f === lbTimeFilter);
  });
  // Category tabs
  ['streak','messages','level'].forEach(c => {
    const btn = document.getElementById('lb-cat-' + c);
    if (btn) btn.classList.toggle('active', c === lbCategory);
  });

  const timer = document.getElementById('lb-timer');
  const ti = _lbTimerInfo(lbTimeFilter);
  if (timer) {
    timer.hidden = !ti;
    if (ti) {
      const l = document.getElementById('lb-timer-label'), v = document.getElementById('lb-timer-value');
      if (l) l.textContent = ti.label;
      if (v) v.textContent = ti.value;
    }
  }

  // Nobody ranked: say so, and hide every part that needs people.
  const empty = data.length === 0;
  const emptyEl = document.getElementById('lb-empty');
  if (emptyEl) emptyEl.hidden = !empty;
  const emptyText = document.getElementById('lb-empty-text');
  if (emptyText) {
    emptyText.textContent = lbTimeFilter === 'alltime'
      ? 'Nobody is on the ' + LB_CAT_NAMES[lbCategory] + ' board yet. Be the first.'
      : 'Nobody is on the ' + LB_CAT_NAMES[lbCategory] + ' board ' + LB_PERIOD_NOW[lbTimeFilter] + '. Be the first.';
  }
  const podiumWrap = document.querySelector('.lb-podium-wrap');
  if (podiumWrap) podiumWrap.hidden = empty;
  const listEl0 = document.getElementById('lb-list');
  if (listEl0) listEl0.hidden = empty;
  const pinEl0 = document.getElementById('lb-my-rank');
  if (pinEl0) pinEl0.hidden = empty;
  const motivEl0 = document.getElementById('lb-motivation');
  if (empty) { if (motivEl0) motivEl0.hidden = true; return; }

  // Podium (top 3) — pedestal/crown art is the cropped, blank
  // hero-podium-blank.png (no baked-in badge/text, see index.html). The
  // rank number is a big, softly-blended watermark baked into the
  // pedestal background (.lb-podium-rank-bg); name/score/unit are a
  // tight text cluster overlapping it, not spread down toward the base.
  const podium = document.getElementById('lb-podium');
  if (podium && data.length >= 3) {
    const order = [data[1], data[0], data[2]]; // left=2nd, center=1st, right=3rd
    const rankWord = { 1: 'first', 2: 'second', 3: 'third' };
    podium.innerHTML = order.map(e => {
      const r = rankWord[e.rank];
      return `
        <div class="lb-podium-rank-bg lb-podium-rank-bg--${r}">${e.rank}</div>
        <div class="lb-podium-name lb-podium-name--${r}">${_escapeHtml(e.name)}</div>
        <div class="lb-podium-score lb-podium-score--${r}">${e.score}</div>
        <div class="lb-podium-unit lb-podium-unit--${r}">${unit}</div>`;
    }).join('');
  }

  // Distance to the next rank up.
  const motivEl = document.getElementById('lb-motivation');
  if (motivEl) {
    const myIdxInData = data.findIndex(e => e.name === myEntry.name);
    const aheadIdx = myIdxInData >= 0 ? myIdxInData - 1 : data.length - 1;
    const ahead = aheadIdx >= 0 ? data[aheadIdx] : null;
    if (ahead && ahead.score > myEntry.score) {
      motivEl.textContent = `${ahead.score - myEntry.score} ${unit} to reach #${ahead.rank}`;
      motivEl.hidden = false;
    } else {
      motivEl.hidden = true;
    }
  }

  // List (rank 4+)
  const listEl = document.getElementById('lb-list');
  if (listEl) {
    listEl.innerHTML = data.slice(3).map(e => `
      <div class="lb-list-row${e.name === myName ? ' lb-list-row--me' : ''}">
        <span class="lb-list-rank">${e.rank}</span>
        <div class="lb-list-avatar"></div>
        <span class="lb-list-name">${_escapeHtml(e.name)}</span>
        <span class="lb-list-score">${e.score}</span>
        <span class="lb-list-badge">${e.rank === 1 ? '👑' : e.rank <= 10 ? '🥇' : '🥉'}</span>
      </div>`).join('');
  }

  // Pinned own rank — hidden entirely when "Show me on leaderboard" is off.
  const pinEl = document.getElementById('lb-my-rank');
  if (pinEl) {
    if (!lbSettings().show) {
      pinEl.hidden = true;
      pinEl.innerHTML = '';
    } else {
      pinEl.hidden = false;
      pinEl.innerHTML = `
        <span class="lb-list-rank">#${myEntry.rank}</span>
        <div class="lb-list-avatar"></div>
        <span class="lb-list-name">${_escapeHtml(myEntry.name)} (you)</span>
        <span class="lb-list-score">${myEntry.score}</span>`;
    }
  }
}

function getLbData(timeFilter, category) {
  return (LEADERBOARD_DATA[category] || {})[timeFilter] || [];
}

// ================================================================
// YOUR JOURNEY  (Streak & Badges — opened from the Streak widget card)
// All values are hardcoded dummy data, same convention as the widget
// cards themselves (7-day streak, etc.) — no Supabase calls.
// ================================================================

// 7-slot week strip — reset to a fresh 0-day streak: nothing done yet,
// today still upcoming (not yet checked in).
const JOURNEY_WEEK = ['upcoming', 'upcoming', 'upcoming', 'upcoming', 'today', 'upcoming', 'upcoming'];

// Streak hero + badge row are static real-cropped-image markup now (see
// index.html) — this page specifically uses cropped reference art rather
// than the inline-SVG icon system the Milestones pages use, per explicit
// direction. Nothing to render here anymore.
function openJourney() {
  ZeloActivity.render();
  const countEl = document.querySelector('.journey-badges-count');
  if (countEl) countEl.textContent = `${getTotalUnlockedCount()}/${MILESTONE_BADGES.length} unlocked`;
  pushScreen('journey');
}

function closeJourney() { popScreen(); }


// ================================================================
// XP / LEVEL SYSTEM
// Real, persisted, currently wired to 3 concrete trigger points that
// already exist elsewhere in this file — sendMessage() (message sent, any
// chat), recordScan() (a real scan completed), startChat() (a brand-new
// conversation, not reopening one from history). Everything else in the
// full gamification spec (daily quests, referral-signup XP, revival
// detection, weekly leaderboard rank bonus) has no real trigger to hook
// into yet — this is the honest subset that's actually backed by real
// usage right now, not a mock waiting to be swapped later.
//
// Level curve (verified against the spec's own cumulative-XP numbers):
// tier rates apply to the LEVEL YOU'RE LEAVING, e.g. every step from
// level 1..5 costs 200 XP each (5 steps to clear the 1-5 tier = 1,000,
// landing on level 6) — this is the only rate assignment that reproduces
// all five "cumulative XP" figures in the spec (1000/3000/6500/11300/12800)
// exactly, so it's not a guess.
// ================================================================
const XP_MAX_LEVEL = 20;
const XP_LEVEL_RATES = [
  { minLevel: 1,  maxLevel: 5,  rate: 200  },
  { minLevel: 6,  maxLevel: 10, rate: 400  },
  { minLevel: 11, maxLevel: 15, rate: 700  },
  { minLevel: 16, maxLevel: 19, rate: 1200 },
  { minLevel: 20, maxLevel: 20, rate: 1500 },
];
function _xpRateForLevel(level) {
  const tier = XP_LEVEL_RATES.find(t => level >= t.minLevel && level <= t.maxLevel);
  return tier ? tier.rate : XP_LEVEL_RATES[XP_LEVEL_RATES.length - 1].rate;
}
// XP_LEVEL_THRESHOLDS[L] = cumulative XP needed to BE at level L.
// Index 21 exists only so level 20's own progress bar has a ceiling to
// fill toward (spec's "20 (max) — 1,500 XP").
const XP_LEVEL_THRESHOLDS = (() => {
  const arr = [null, 0];
  for (let lvl = 1; lvl <= XP_MAX_LEVEL; lvl++) arr[lvl + 1] = arr[lvl] + _xpRateForLevel(lvl);
  return arr;
})();

const XP_TIERS = [
  { minLevel: 1,  maxLevel: 5,  icon: 'level-tier-sprout',  label: '1 - 5',    title: 'Sprout',  rateLabel: '200 XP/level'   },
  { minLevel: 6,  maxLevel: 10, icon: 'level-tier-planet',  label: '6 - 10',   title: 'Orbiter', rateLabel: '400 XP/level'   },
  { minLevel: 11, maxLevel: 15, icon: 'level-tier-star',    label: '11 - 15',  title: 'Star',    rateLabel: '700 XP/level'   },
  { minLevel: 16, maxLevel: 19, icon: 'level-tier-crystal', label: '16 - 19',  title: 'Crystal', rateLabel: '1,200 XP/level' },
  { minLevel: 20, maxLevel: 20, icon: 'level-tier-crown',   label: '20 (max)', title: 'Crown',   rateLabel: '1,500 XP'       },
];
function getTierForLevel(level) {
  return XP_TIERS.find(t => level >= t.minLevel && level <= t.maxLevel) || XP_TIERS[0];
}

function getLevelForXP(xp) {
  let level = 1;
  for (let lvl = 2; lvl <= XP_MAX_LEVEL; lvl++) {
    if (xp >= XP_LEVEL_THRESHOLDS[lvl]) level = lvl; else break;
  }
  return level;
}
// { level, into, span, pct } — into/span is progress toward the NEXT
// level (or, at level 20, toward the spec's final 1,500-XP "fully maxed"
// ceiling — there's no level 21, just a bar that keeps filling).
function getLevelProgress(xp) {
  const level = getLevelForXP(xp);
  const floor = XP_LEVEL_THRESHOLDS[level];
  const ceil  = XP_LEVEL_THRESHOLDS[level + 1];
  const into  = Math.max(0, xp - floor);
  const span  = Math.max(1, ceil - floor);
  return { level, into, span, pct: Math.min(1, into / span), maxed: level === XP_MAX_LEVEL && xp >= ceil };
}

let _xp = Number(localStorage.getItem('zelo_xp') || 0);
function getXP() { return _xp; }
function setXP(xp) {
  _xp = Math.max(0, xp);
  localStorage.setItem('zelo_xp', String(_xp));
}

// Per-source daily caps — see the "1. XP Sources" table. Referral-sent/
// referral-signup, daily quests, and weekly rank bonus are deliberately
// not here; see the comment on this whole section for why.
const XP_SOURCES = {
  message:      { xp: 2,  dailyCap: 20, label: 'Message sent!' },
  scan:         { xp: 5,  dailyCap: 10, label: 'Scan complete!' },
  conversation: { xp: 10, dailyCap: 5,  label: 'New conversation!' },
};

function _xpDailyState() {
  let s;
  try { s = JSON.parse(localStorage.getItem('zelo_xp_daily') || '{}'); } catch { s = {}; }
  if (s.date !== todayKey()) s = { date: todayKey() };
  return s;
}
function _saveXpDailyState(s) { localStorage.setItem('zelo_xp_daily', JSON.stringify(s)); }

// Awards XP for a source in XP_SOURCES, respecting its daily cap. Returns
// the amount actually awarded (0 if today's cap for that source is
// already used up) — callers don't need to pre-check anything themselves.
function awardXP(source) {
  if (subscriptionExpired()) return 0; // locked: nothing earns XP (or moves the streak/levels)
  const spec = XP_SOURCES[source];
  if (!spec) return 0;
  const daily = _xpDailyState();
  const used = daily[source] || 0;
  if (spec.dailyCap != null && used >= spec.dailyCap) return 0;
  daily[source] = used + 1;
  _saveXpDailyState(daily);
  renderDailyMissions();   // the only thing that can move a mission is an award

  const before = getXP();
  const beforeLevel = getLevelForXP(before);
  setXP(before + spec.xp);
  const afterLevel = getLevelForXP(getXP());
  ZeloAnalytics.track('xp_earned', { source, amount: spec.xp });
  if (afterLevel > beforeLevel) ZeloAnalytics.track('level_up', { level: afterLevel });

  showXPPanel(spec.xp, spec.label, before);
  // Sequenced, not simultaneous — both panels sit in the same spot
  // on-screen, so a level-up crossed by this award waits for the XP
  // panel's own visible window to finish before taking its place.
  if (afterLevel > beforeLevel) setTimeout(() => showLevelUpPanel(afterLevel, beforeLevel), 1900);
  // Mission Control's level card only exists in the DOM while that screen
  // is the active one — cheap to just always try, no-ops otherwise.
  if (state.activeScreen === 'mission-control') renderMissionLevelCard();
  return spec.xp;
}

// ---- XP gain / Level-up panels — see the .xp-panel comment in style.css
// for the shared markup/CSS both of these drive. ----
// Both panels sit above the Zelo header (position:fixed, safe-area-aware
// top), same convention as .streak-notif — see that CSS comment. That
// deliberately sidesteps needing any per-screen offset: a screen-specific
// pixel value here previously had to guess how tall each screen's own
// header renders once the real device's safe-area inset is added in
// (headless testing never renders a notch, so any such value calibrated
// there is only correct on hardware with zero safe-area-inset-top) —
// positioning above the header entirely removes that guess.
let _xpPanelTimer = null;
let _xpCountUpFrame = null;

// Animates the progress bar/text from `fromInto` up to `toInto` (out of
// `span`), ticking a light haptic every few counted points so the buzz
// tracks the number actually moving rather than firing once flat. Distinct
// from the single on-popup buzz in showXPPanel — this one repeats for the
// duration of the count-up.
function _xpPanelCountUp(fromInto, toInto, span, level) {
  const fillEl = document.getElementById('xp-panel-bar-fill');
  const textEl = document.getElementById('xp-panel-bar-text');
  if (!fillEl || !textEl) return;
  cancelAnimationFrame(_xpCountUpFrame);
  const isMax = level >= XP_MAX_LEVEL && toInto >= span;
  const duration = 700;
  const start = performance.now();
  let lastTick = fromInto;
  const render = (into) => {
    fillEl.style.width = Math.round(Math.min(1, into / span) * 100) + '%';
    textEl.textContent = (isMax && into >= toInto)
      ? `${getXP().toLocaleString()} XP — MAX`
      : `${into.toLocaleString()} / ${span.toLocaleString()} XP`;
  };
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const into = Math.round(fromInto + (toInto - fromInto) * eased);
    render(into);
    if (into - lastTick >= 4) { lastTick = into; navigator.vibrate?.(1); _cineHaptic('LIGHT'); }
    if (t < 1) { _xpCountUpFrame = requestAnimationFrame(frame); }
    else { render(toInto); }
  }
  _xpCountUpFrame = requestAnimationFrame(frame);
}

function showXPPanel(amount, sourceLabel, beforeXP) {
  const panel = document.getElementById('xp-panel');
  if (!panel) return;
  document.getElementById('xp-panel-title').textContent = `+${amount} XP`;
  document.getElementById('xp-panel-sub').textContent = sourceLabel || 'Nice!';

  const after = getLevelProgress(getXP());
  const before = beforeXP != null ? getLevelProgress(beforeXP) : after;
  // If this award crossed a level, the old bar doesn't visually carry over
  // (it belonged to a different, now-finished level) — start the count-up
  // from empty instead of animating across two different bars' worth of span.
  const startInto = before.level === after.level ? before.into : 0;

  document.getElementById('xp-panel-bar-fill').style.width = Math.round(Math.min(1, startInto / after.span) * 100) + '%';
  document.getElementById('xp-panel-bar-text').textContent = `${startInto.toLocaleString()} / ${after.span.toLocaleString()} XP`;

  panel.hidden = false;
  clearTimeout(_xpPanelTimer);
  requestAnimationFrame(() => panel.classList.add('visible'));
  navigator.vibrate?.(4); _cineHaptic('LIGHT'); // single buzz to confirm the popup itself
  setTimeout(() => _xpPanelCountUp(startInto, after.into, after.span, after.level), 260);
  _xpPanelTimer = setTimeout(hideXPPanel, 2600);
}
function hideXPPanel() {
  const panel = document.getElementById('xp-panel');
  if (!panel || panel.hidden) return;
  clearTimeout(_xpPanelTimer);
  cancelAnimationFrame(_xpCountUpFrame);
  panel.classList.remove('visible');
  setTimeout(() => { panel.hidden = true; }, 340);
}

let _levelUpPanelTimers = [];
function showLevelUpPanel(newLevel, beforeLevel) {
  const panel = document.getElementById('levelup-panel');
  if (!panel) return;
  _levelUpPanelTimers.forEach(clearTimeout);
  _levelUpPanelTimers = [];
  const oldLevel = beforeLevel != null ? beforeLevel : Math.max(1, newLevel - 1);

  document.getElementById('levelup-panel-sub').textContent = `You're now Level ${newLevel} 🔥`;
  // Static, matching the reference's own fixed line — not tier-derived
  // (an earlier version tried "Keep going, sprout master." for tier 1,
  // which reads worse than just keeping the reference's actual copy).
  document.getElementById('levelup-panel-tertiary').textContent = 'Keep going, rizz master.';

  // Starting state: icon shows the OLD level's tier icon, same "before"
  // beat as showStreakNotif() — see that function for the reference
  // pattern this reuses (streakNotifNumOut/In keyframes, just driving an
  // <img> pair instead of two number spans).
  const oldTier = getTierForLevel(oldLevel);
  document.getElementById('levelup-icon-old').src = `assets/icons/xp-levels/${oldTier.icon}.png`;
  document.getElementById('levelup-icon-roll').classList.remove('xp-panel-icon-roll--rolling');

  panel.hidden = false;
  requestAnimationFrame(() => panel.classList.add('visible'));
  navigator.vibrate?.(4); _cineHaptic('LIGHT'); // single buzz to confirm the popup itself

  // Roll to the new (star) icon shortly after appearing, same beat as the
  // streak notif's own dot-check-then-roll sequence.
  _levelUpPanelTimers.push(setTimeout(() => {
    document.getElementById('levelup-icon-roll').classList.add('xp-panel-icon-roll--rolling');
    navigator.vibrate?.(12); _cineHaptic('MEDIUM');
  }, 500));

  _levelUpPanelTimers.push(setTimeout(hideLevelUpPanel, 3200));
}
function hideLevelUpPanel() {
  const panel = document.getElementById('levelup-panel');
  if (!panel || panel.hidden) return;
  _levelUpPanelTimers.forEach(clearTimeout);
  panel.classList.remove('visible');
  setTimeout(() => { panel.hidden = true; }, 340);
}

// ================================================================
// MISSION CONTROL  (opened from the Activity widget card)
// The level card is the one real piece here — see the XP/LEVEL SYSTEM
// block above. "This Week" stats and Daily Missions stay mocked (no
// real per-day activity log or quest-selection system exists yet).
// ================================================================

function renderMissionLevelCard() {
  const xp = getXP();
  const { level, into, span, pct } = getLevelProgress(xp);
  const tier = getTierForLevel(level);
  document.getElementById('mission-level-tier-icon').src = `assets/icons/xp-levels/${tier.icon}.png`;
  document.getElementById('mission-level-num').textContent = level;
  document.getElementById('mission-level-title').textContent = tier.title;
  document.getElementById('mission-xp-fill').style.width = Math.round(pct * 100) + '%';
  document.getElementById('mission-xp-text').textContent =
    level >= XP_MAX_LEVEL && pct >= 1 ? `${xp.toLocaleString()} XP — MAX` : `${into.toLocaleString()} / ${span.toLocaleString()} XP`;
}

function openMissionControl() {
  renderMissionLevelCard();
  renderDailyMissions();
  pushScreen('mission-control');
}

// ---- Daily Missions ------------------------------------------------------
// Rendered from the SAME per-day counters awardXP() already keeps
// (_xpDailyState), so a row can only ever tick when XP was genuinely awarded
// for it — the progress and the XP badge cannot drift apart. Each target is
// chosen so the row's stated XP is exactly what completing it pays out:
//   conversation  1 x 10 XP = +10    (awardXP('conversation'), startChat)
//   message      10 x  2 XP = +20    (awardXP('message'), sendMessage)
//   scan          2 x  5 XP = +10    (awardXP('scan'), recordScan)
// Every target sits under that source's own daily cap (5 / 20 / 10), so a cap
// can never make a mission unreachable.
const DAILY_MISSIONS = {
  conversation: { target: 1  },
  message:      { target: 10 },
  scan:         { target: 2  },
};

function renderDailyMissions() {
  const daily = _xpDailyState();
  document.querySelectorAll('.mission-row[data-mission]').forEach(row => {
    const spec = DAILY_MISSIONS[row.dataset.mission];
    if (!spec) return;
    const done  = Math.min(daily[row.dataset.mission] || 0, spec.target);
    const state = done >= spec.target ? 'done' : done > 0 ? 'partial' : 'todo';

    const progress = row.querySelector('.mission-row-progress');
    if (progress) progress.textContent = done + '/' + spec.target;

    const check = row.querySelector('.mission-row-check');
    if (check) {
      check.classList.remove('mission-row-check--done', 'mission-row-check--partial', 'mission-row-check--todo');
      check.classList.add('mission-row-check--' + state);
      // The tick is invisible on the grey todo chip and white on the filled ones.
      const tick = check.querySelector('svg');
      if (tick) tick.setAttribute('stroke', state === 'todo' ? '#c9c0b6' : '#fff');
    }

    // A finished mission has nowhere left to send anyone.
    const go = row.querySelector('.mission-row-go');
    if (go) go.hidden = state === 'done';

    row.classList.toggle('mission-row--done', state === 'done');
  });
}

// Row 3's destination. Scan is the centre tab, internally 'assistant'.
function missionGoToScan() {
  closeMissionControl();
  showTab('assistant');
}

function closeMissionControl() { popScreen(); }

// "Keep it going"/"Revive a dead conversation" missions are both about an
// EXISTING conversation, not starting a new one — so unlike "Start a
// conversation" (always -> Practice's swipe deck), these send the user to
// their real chat list when they already have one, and only fall back to
// Practice when there's nothing to go back to yet.
function missionGoToChatOrPractice() {
  closeMissionControl();
  showTab(chatStore.length > 0 ? 'chats' : 'practice');
}

// ================================================================
// ---- "How to Level Up" info modal — replaces the old leaderboard
// shortcut in Mission Control's top-right corner ----
function openLevelUpInfo() {
  document.getElementById('levelup-modal-overlay').hidden = false;
}
function closeLevelUpInfo() {
  document.getElementById('levelup-modal-overlay').hidden = true;
}


// ================================================================
// MILESTONES  (Achievement badge system)
// Hub (screen-milestones): day-streak and badge totals, then one section
// per category with its badges 3 across. Tapping a badge opens the badge
// sheet; its Share button opens the share sheet. Data lives in
// MILESTONE_CATEGORIES / MILESTONE_BADGES (data.js). Each badge's `icon`
// names its art in assets/icons/milestones/ — the -dark sibling is swapped
// in automatically by ICONS_WITH_DARK_VARIANT.
// ================================================================

const MILESTONE_ART_DIR = 'assets/icons/milestones/';

function milestoneArtSrc(name) { return `${MILESTONE_ART_DIR}${name}.png`; }

// Numbers are drawn from the digit glyph art, not the system font.
function milestoneDigitsHTML(value) {
  return String(value).split('').map(ch =>
    `<img class="ms-digit" src="${MILESTONE_ART_DIR}digit-${ch}.png" alt="${ch}">`
  ).join('');
}

function getMilestoneCategory(catId) {
  return MILESTONE_CATEGORIES.find(c => c.id === catId) || null;
}
function getCategoryBadges(catId) {
  return MILESTONE_BADGES.filter(b => b.category === catId);
}
// "Zelo Legend" (dynamic:'all-badges') is unlocked once every OTHER
// badge is — not by its own static progress/target, so it can't
// self-reference into an infinite loop.
function isBadgeUnlocked(badge) {
  if (badge.dynamic === 'all-badges') {
    return MILESTONE_BADGES.filter(b => b.id !== badge.id).every(isBadgeUnlocked);
  }
  return badge.progress >= badge.target;
}
function getCategoryUnlockedCount(catId) {
  return getCategoryBadges(catId).filter(isBadgeUnlocked).length;
}
function getTotalUnlockedCount() {
  return MILESTONE_BADGES.filter(isBadgeUnlocked).length;
}

function openMilestones() {
  renderMilestonesHub();
  pushScreen('milestones');
}

function renderMilestonesHub() {
  const totalUnlocked = getTotalUnlockedCount();
  const total = MILESTONE_BADGES.length;

  const streak = ZeloActivity.streakInfo();
  document.getElementById('milestones-streak-digits').innerHTML = milestoneDigitsHTML(streak.current);
  document.getElementById('milestones-longest-streak').textContent = String(streak.best);
  document.getElementById('milestones-badges-digits').innerHTML = milestoneDigitsHTML(totalUnlocked);
  document.getElementById('milestones-badges-frac').textContent = `${totalUnlocked}/${total}`;
  document.getElementById('milestones-badges-progress-fill').style.width =
    Math.round((totalUnlocked / total) * 100) + '%';

  document.getElementById('milestones-sections').innerHTML = MILESTONE_CATEGORIES.map((cat, i) => {
    const tiles = getCategoryBadges(cat.id).map(b => `
      <button class="ms-badge${isBadgeUnlocked(b) ? '' : ' ms-badge--locked'}" type="button" onclick="openBadgeDetail('${b.id}')">
        <img class="ms-badge-art" src="${milestoneArtSrc(b.icon)}" alt="">
        <span class="ms-badge-name">${b.name}</span>
        <span class="ms-badge-req">${b.requirement}</span>
      </button>`).join('');
    return `${i > 0 ? '<hr class="ms-section-divider">' : ''}
      <section class="ms-section">
        <h2 class="ms-section-title">${cat.name} Milestones</h2>
        <p class="ms-section-sub">${cat.description}</p>
        <div class="ms-grid">${tiles}</div>
      </section>`;
  }).join('');
}

// ---- Sheets (badge + share) ----
let _milestoneSheetBadgeId = null;

function _milestoneOpenSheet(overlayId) {
  const ov = document.getElementById(overlayId);
  ov.hidden = false;
  requestAnimationFrame(() => ov.classList.add('is-open'));
}
function _milestoneCloseSheet(overlayId) {
  const ov = document.getElementById(overlayId);
  ov.classList.remove('is-open');
  setTimeout(() => { ov.hidden = true; }, 320);
}

function openBadgeDetail(badgeId) {
  const badge = MILESTONE_BADGES.find(b => b.id === badgeId);
  if (!badge) return;
  _milestoneSheetBadgeId = badgeId;
  const done = isBadgeUnlocked(badge);

  const art = document.getElementById('badge-sheet-art');
  art.src = milestoneArtSrc(badge.icon);
  applyDarkIconSet(art);
  art.classList.toggle('ms-art--locked', !done);
  document.getElementById('badge-sheet-label').textContent = done ? 'Badge Unlocked' : 'Badge Locked';
  document.getElementById('badge-sheet-name').textContent = badge.name;
  document.getElementById('badge-sheet-req').textContent = badge.requirement;
  const action = document.getElementById('badge-sheet-action');
  action.textContent = done ? 'Share' : 'Locked';
  action.disabled = !done;
  _milestoneOpenSheet('badge-sheet-overlay');
}

function closeBadgeDetail() {
  _milestoneCloseSheet('badge-sheet-overlay');
}

function _currentSheetBadge() {
  const badge = MILESTONE_BADGES.find(b => b.id === _milestoneSheetBadgeId);
  return badge && isBadgeUnlocked(badge) ? badge : null;
}

let _msShareText = '';
let _msShareCard = null;         // { accent, artSrc, digitsValue, title, sub } — everything _renderShareImage needs
let _msShareImageCache = null;   // { key, blob } — the rendered PNG, rebuilt only when the card actually changes

function _openShareSheet({ accent, tint, artName, digitsValue, title, sub, text }) {
  const sheet = document.getElementById('badge-share-sheet');
  sheet.style.setProperty('--ms-accent', accent);
  sheet.style.setProperty('--ms-tint', tint);
  const art = document.getElementById('badge-share-art');
  art.src = milestoneArtSrc(artName);
  applyDarkIconSet(art);
  const digits = document.getElementById('badge-share-digits');
  digits.innerHTML = digitsValue === null ? '' : milestoneDigitsHTML(digitsValue);
  digits.hidden = digitsValue === null;
  document.getElementById('badge-share-title').textContent = title;
  document.getElementById('badge-share-sub').textContent = sub;
  _msShareText = text;
  _msShareCard = { accent, artSrc: milestoneArtSrc(artName), digitsValue, title, sub };
  _msShareImageCache = null;
  _milestoneCloseSheet('badge-sheet-overlay');
  _milestoneOpenSheet('badge-share-overlay');
}

// Draws the actual streak/badge card as one flat PNG — art + digit glyphs + title/sub — sized for
// Instagram Stories (1080x1920) so it also looks right dropped into Messages/WhatsApp/anywhere else.
// Always rendered in LIGHT colors regardless of the sharer's own theme: the people THEY share it with
// have no relation to the sharer's device setting, so a fixed, predictable look is correct here, not
// "whatever theme I'm in right now".
async function _renderShareImage() {
  const card = _msShareCard;
  if (!card) return null;
  const key = JSON.stringify(card);
  if (_msShareImageCache && _msShareImageCache.key === key) return _msShareImageCache.blob;

  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

  // Background: a soft tint fading to white, same spirit as .ms-sheet--share's gradient.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, _colorMixWhite(card.accent, 0.30));
  grad.addColorStop(0.55, '#ffffff');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  const cx = W / 2;
  // Centre the whole group (art, number, title, sub) on the canvas, a little above the middle so the
  // footer line has room, instead of pinning it near the top and leaving the lower half empty.
  const ART = 580, DIG = 230;
  const hasDigits = card.digitsValue !== null && card.digitsValue !== undefined;
  const groupH = ART + (hasDigits ? DIG * 0.7 : 0) + 70 + 56 + 56;
  let y = Math.max(160, (H - groupH) / 2 - 90) + ART / 2;

  const art = await loadImg(card.artSrc);
  if (art) {
    const size = ART;
    ctx.drawImage(art, cx - size / 2, y - size / 2, size, size);
    y += size / 2;
  }

  if (card.digitsValue !== null && card.digitsValue !== undefined) {
    const chars = String(card.digitsValue).split('');
    const digitImgs = await Promise.all(chars.map(ch => loadImg(`${MILESTONE_ART_DIR}digit-${ch}.png`)));
    const dH = DIG, dTop = y - dH * 0.3;
    const widths = digitImgs.map(im => im ? (im.width / im.height) * dH : 0);
    const totalW = widths.reduce((a, b) => a + b, 0);
    let dx = cx - totalW / 2;
    digitImgs.forEach((im, i) => { if (im) { ctx.drawImage(im, dx, dTop, widths[i], dH); dx += widths[i]; } });
    y = dTop + dH;   // below the digit glyphs' own bottom edge, not the art's
  }

  y += 70;
  ctx.textAlign = 'center';
  ctx.fillStyle = card.accent;
  ctx.font = '800 56px -apple-system, system-ui, sans-serif';
  ctx.fillText(card.title.toUpperCase(), cx, y);

  y += 56;
  ctx.fillStyle = '#8a8175';
  ctx.font = '400 32px -apple-system, system-ui, sans-serif';
  ctx.fillText(card.sub, cx, y);

  // Bold CTA caption, same pattern as Cal AI's "Get healthy with Cal AI" — only ever in this exported
  // image (what actually gets sent/saved), never shown in the live in-app share-sheet preview itself.
  // The star after "Zelo" is the app's own brand sparkle (.scan-spark's exact SVG path, used after
  // every "Zelo" wordmark in the app's own headers) — same glyph, same place, not a new invention.
  const ctaText = 'Get better at texting with Zelo';
  const ctaY = H - 100;
  ctx.fillStyle = card.accent;
  ctx.font = '800 38px -apple-system, system-ui, sans-serif';
  ctx.fillText(ctaText, cx, ctaY);
  const ctaWidth = ctx.measureText(ctaText).width;
  const starSize = 30;
  ctx.save();
  ctx.translate(cx + ctaWidth / 2 + 8, ctaY - starSize * 0.78);
  ctx.scale(starSize / 24, starSize / 24);
  ctx.fillStyle = card.accent;
  ctx.fill(new Path2D('M12 2.5l1.9 5.7a3 3 0 0 0 1.9 1.9L21.5 12l-5.7 1.9a3 3 0 0 0-1.9 1.9L12 21.5l-1.9-5.7a3 3 0 0 0-1.9-1.9L2.5 12l5.7-1.9a3 3 0 0 0 1.9-1.9z'));
  ctx.restore();

  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  _msShareImageCache = { key, blob };
  return blob;
}
function _colorMixWhite(hex, amount) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const mix = c => Math.round(c * amount + 255 * (1 - amount));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

function openStreakShare() {
  const n = ZeloActivity.streakInfo().current;
  _openShareSheet({
    accent: '#ec4899',
    tint: '#fdf2f8',
    artName: 'hero-streak-flame',
    digitsValue: n,
    title: 'Day Streak',
    sub: n > 0 ? 'Showing up every day' : 'Just getting started',
    text: n > 1 ? `I'm on a ${n} day streak on Zelo. Come practice texting with me.`
        : n === 1 ? "Day 1 of my streak on Zelo. Come practice texting with me."
        : "I just started practicing texting on Zelo. Come join me.",
  });
}

function openBadgeShare() {
  const badge = _currentSheetBadge();
  if (!badge) return;
  const cat = getMilestoneCategory(badge.category);
  _openShareSheet({
    accent: cat.accent,
    tint: cat.bgTint,
    artName: badge.icon,
    digitsValue: null,
    title: badge.name,
    sub: `${cat.name} · ${badge.requirement}`,
    text: `I unlocked ${badge.name} on Zelo: ${badge.requirement}!`,
  });
}

function closeBadgeShare() {
  _milestoneCloseSheet('badge-share-overlay');
}

function _blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// "Save" and "More" — the general OS share sheet, now carrying the actual rendered card image (not just
// text). "Save Image" and every other app (incl. WhatsApp, which has no direct deep-link of its own — see
// shareSheetWhatsapp below) are reached through here.
async function shareSheetNatively() {
  if (!_msShareText) return;
  const blob = await _renderShareImage();
  const file = blob ? new File([blob], 'zelo-streak.png', { type: 'image/png' }) : null;
  if (navigator.share) {
    const data = { title: 'Zelo', text: _msShareText };
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) data.files = [file];
    navigator.share(data).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(_msShareText).then(() => flashLimitToast('Copied to clipboard')).catch(() => {});
  }
}

// Instagram — the real "ready to post" Stories deep link (native, MainViewController.swift), not the
// generic picker. Falls back to the generic share sheet if Instagram isn't installed or the native
// handler isn't available (e.g. testing outside the iOS app).
async function shareSheetInstagram() {
  if (!_msShareCard) return;
  const handlers = window.webkit && window.webkit.messageHandlers;
  const blob = await _renderShareImage();
  if (handlers && handlers.zeloShareInstagram && blob) {
    const base64 = await _blobToBase64(blob);
    try { ZeloAnalytics.track('referral_link_shared', { via: 'instagram_native' }); } catch (e) {}
    handlers.zeloShareInstagram.postMessage({ imageBase64: base64 });
    return;
  }
  shareSheetNatively();
}
window._zeloShareInstagramUnavailable = () => showChatToast("Instagram isn't installed.");

// Messages — a real compose sheet with the image already attached (MFMessageComposeViewController,
// MainViewController.swift), not the generic picker. Falls back to the generic share sheet otherwise.
async function shareSheetMessages() {
  if (!_msShareCard) return;
  const handlers = window.webkit && window.webkit.messageHandlers;
  const blob = await _renderShareImage();
  if (handlers && handlers.zeloShareMessages && blob) {
    const base64 = await _blobToBase64(blob);
    try { ZeloAnalytics.track('referral_link_shared', { via: 'messages_native' }); } catch (e) {}
    handlers.zeloShareMessages.postMessage({ imageBase64: base64, body: _msShareText });
    return;
  }
  shareSheetNatively();
}
window._zeloShareMessagesUnavailable = () => showChatToast("Messages isn't available on this device.");

function copySheetText() {
  if (!_msShareText || !navigator.clipboard) return;
  navigator.clipboard.writeText(_msShareText).then(() => flashLimitToast('Copied to clipboard')).catch(() => {});
}

// Swipe down on the sheet to dismiss — tracks the finger live, closes past
// a distance or fast-flick threshold, otherwise springs back.
function _attachMsSheetDragClose(overlayId, closeFn) {
  const ov = document.getElementById(overlayId);
  const sheet = ov && ov.querySelector('.ms-sheet');
  if (!sheet) return;
  let active = false, startY = 0, dy = 0, startT = 0;
  sheet.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    active = true; startY = e.touches[0].clientY; dy = 0; startT = Date.now();
    sheet.style.transition = 'none';
    ov.style.transition = 'none';
  }, { passive: true });
  sheet.addEventListener('touchmove', e => {
    if (!active) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
    ov.style.opacity = String(Math.max(0, 1 - dy / 360));
  }, { passive: true });
  const finish = () => {
    if (!active) return;
    active = false;
    const speed = dy / Math.max(1, Date.now() - startT);
    sheet.style.transition = 'transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)';
    ov.style.transition = 'opacity 0.32s ease';
    if (dy > 110 || speed > 0.6) {
      sheet.style.transform = 'translateY(100%)';
      ov.style.opacity = '0';
      setTimeout(() => {
        closeFn();
        sheet.style.transition = '';
        sheet.style.transform = '';
        ov.style.transition = '';
        ov.style.opacity = '';
      }, 320);
    } else {
      sheet.style.transform = '';
      ov.style.opacity = '';
      setTimeout(() => { sheet.style.transition = ''; ov.style.transition = ''; }, 320);
    }
  };
  sheet.addEventListener('touchend', finish);
  sheet.addEventListener('touchcancel', finish);
}

document.addEventListener('DOMContentLoaded', () => {
  _attachMsSheetDragClose('badge-sheet-overlay', closeBadgeDetail);
  _attachMsSheetDragClose('badge-share-overlay', closeBadgeShare);
});


// ================================================================
