const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const html = read('index.html');
const script = read('script.js');
const data = read('data.js');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

test('all first-party JavaScript parses', () => {
  const roots = ['archive', 'services', 'supabase/functions'];
  const files = ['config.js', 'data.js', 'personas.js', 'personas-roster.js', 'personas-posts.js',
    'personas-about.js', 'personas-men.js', 'personas-threads.js', 'script.js'];
  for (const dir of roots) {
    const full = path.join(ROOT, dir);
    if (fs.existsSync(full)) files.push(...walk(full).filter(f => f.endsWith('.js')).map(f => path.relative(ROOT, f)));
  }
  for (const file of files.filter(file => !file.includes('/vendor/') && !path.basename(file).startsWith('._'))) {
    execFileSync(process.execPath, ['--check', path.join(ROOT, file)], { stdio: 'pipe' });
  }
});

test('HTML ids are unique', () => {
  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map(match => match[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  assert.deepEqual(duplicates, []);
});

test('local HTML assets exist', () => {
  const refs = [...html.matchAll(/(?:src|href|data-src)=["']([^"']+)["']/g)].map(match => match[1]);
  const missing = refs
    .filter(ref => !/^(?:https?:|data:|#|javascript:)/.test(ref) && !ref.includes('${'))
    .map(ref => ref.split('?')[0])
    .filter(ref => ref && !fs.existsSync(path.join(ROOT, ref)));
  assert.deepEqual([...new Set(missing)], []);
});

test('release build has no active development, mock-ad, or fake-export paths', () => {
  const combined = [html, script, data, read('services/auth.js'), read('services/analytics.js'),
    read('package.json'), read('ios/App/CapApp-SPM/Package.swift'), read('ios/App/App/Info.plist')].join('\n');
  const forbidden = [
    'dev-credentials.js', 'DEV_AUTO_SIGN_IN', 'DEV_SHOW_SUBSCRIPTION_SWITCH',
    'zelo_ad_used_today', 'watchRewardedAd', 'bonusScansPerAd', 'ad_watched', 'ad_skipped',
    'AppTrackingTransparency', 'NSUserTrackingUsageDescription', 'TEST_LAYOUT_PROFILES',
    'DEMO_SCAN_TRIGGER', 'bindDevPaceToggle', '_missionPreviewNextTier', '_ddSubmitRequest',
    'aicoach-photo-input', 'How your 7-day', 'Day 5: Trial Reminder', 'Day 7: Trial Ends'
  ];
  const found = forbidden.filter(value => combined.includes(value));
  assert.deepEqual(found, []);
  assert.match(data, /trialDays:\s*3\b/);
  assert.match(script, /const SHOW_BUILD_STAMP = false;/);
  assert.doesNotMatch(script, /localStorage\.removeItem\('zelo_onboarding_done'\)/);
});

test('HTML escaping and image-source guards reject injection payloads', () => {
  const escapeSource = script.match(/function _escapeHtml\(str\) \{[\s\S]*?\n\}/)?.[0];
  const imageSource = script.match(/function _safeImageDataUrl\(value\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(escapeSource && imageSource);
  const escapeHtml = vm.runInNewContext(`(${escapeSource})`);
  const safeImageDataUrl = vm.runInNewContext(`(${imageSource})`);
  assert.equal(escapeHtml(`<img src=x onerror="alert('x')">`), '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;');
  assert.equal(safeImageDataUrl('javascript:alert(1)'), '');
  assert.equal(safeImageDataUrl('data:image/svg+xml;base64,PHN2Zz4='), '');
  assert.equal(safeImageDataUrl('data:image/png;base64,iVBORw0KGgo='), 'data:image/png;base64,iVBORw0KGgo=');
});

test('known user and AI text sinks are escaped or use text nodes', () => {
  const forbidden = [
    '${msg.content}', '${thread.name}</span>', '${activity.text}</span>',
    '${scan.message}</div>', '${scan.reply}</div>', '${chat.lastMessage}</span>',
    '${preThr.name}”', '${t.name}</span>'
  ];
  assert.deepEqual(forbidden.filter(value => script.includes(value)), []);
  assert.match(script, /createTextNode\(String\(msg\.content \|\| ''\)\)/);
  assert.match(script, /_escapeHtml\(text\)/);
  assert.match(script, /_safeImageDataUrl\(msg\.image\)/);
});

test('data retention selection is enforced, not merely displayed', () => {
  assert.match(script, /zelo_history_retention_days/);
  assert.match(script, /const cutoff = Date\.now\(\) - days \* 24 \* 60 \* 60 \* 1000/);
  assert.match(script, /thread\.scans\.filter/);
});

// ── Added 2026-10-22a ─────────────────────────────────────────────
// Each of these guards a bug that actually shipped, not a hypothetical.

// archive/legacy-onboarding.js was <script src>'d from index.html while
// archive/ is never copied into www/ or the iOS bundle, so it 404'd in every
// packaged build. 'local HTML assets exist' above passed because it only
// checks the SOURCE tree — this checks what actually gets shipped.
test('every script and stylesheet index.html loads is present in both packaged copies', () => {
  const targets = ['www', 'ios/App/App/public'].filter(dir => fs.existsSync(path.join(ROOT, dir)));
  assert.ok(targets.length === 2, 'www/ and ios/App/App/public/ must both exist');
  const refs = [
    ...[...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]),
    ...[...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m => m[1]),
  ].map(r => r.split('?')[0]).filter(r => !/^https?:/.test(r));
  const missing = [];
  for (const dir of targets) {
    for (const ref of refs) {
      if (!fs.existsSync(path.join(ROOT, dir, ref))) missing.push(`${dir}/${ref}`);
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});

// The packaged copies must be byte-identical to source (CLAUDE.md's release
// rule). A stale www/ is indistinguishable from "my change didn't work".
test('packaged web copies are byte-identical to source', () => {
  const files = ['index.html', 'script.js', 'style.css', 'data.js', 'config.js', 'personas.js'];
  const stale = [];
  for (const dir of ['www', 'ios/App/App/public']) {
    for (const f of files) {
      const packaged = path.join(ROOT, dir, f);
      if (!fs.existsSync(packaged)) { stale.push(`${dir}/${f} (missing)`); continue; }
      if (fs.readFileSync(packaged).compare(fs.readFileSync(path.join(ROOT, f))) !== 0) stale.push(`${dir}/${f}`);
    }
  }
  assert.deepEqual(stale, []);
});

// Every inline handler must resolve against ONLY the scripts index.html
// actually loads — the earlier version of this check was passing because it
// also read files that are not in the bundle.
test('inline HTML handlers resolve against the loaded scripts only', () => {
  const loaded = [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1])
    .filter(f => fs.existsSync(path.join(ROOT, f)));
  const js = loaded.map(f => read(f)).join('\n');
  const names = new Set();
  for (const m of html.matchAll(/\bon(?:click|change|input|submit|focus|blur|touchstart|keydown)\s*=\s*"([^"]*)"/g)) {
    for (const c of m[1].matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) names.add(c[1]);
  }
  const builtin = new Set(['if', 'return', 'typeof', 'document', 'window', 'event', 'setTimeout',
    'Number', 'String', 'JSON', 'Math', 'Date', 'localStorage', 'getElementById', 'querySelector',
    'classList', 'focus', 'blur', 'preventDefault', 'stopPropagation', 'remove', 'click', 'toggle',
    'contains', 'add', 'value', 'console', 'parseInt', 'parseFloat', 'alert', 'vibrate', 'Object', 'Array']);
  const unresolved = [...names].filter(n => !builtin.has(n) &&
    !new RegExp(`(?:function\\s+${n}\\b|\\b${n}\\s*[:=]\\s*(?:async\\s*)?(?:function|\\()|\\b${n}\\s*\\([^)]*\\)\\s*\\{)`).test(js));
  assert.deepEqual(unresolved.sort(), []);
});

// Hiding a widget or deleting one onclick silently orphaned whole screens
// (Leaderboard, Mission Control, Zelo Pro, Download My Data). A screen with no
// way in is invisible to every other test in this file.
test('feature screens still have a way in', () => {
  const entries = {
    openMissionControl:    /onclick="openMissionControl\(\)"/,
    openLeaderboard:       /onclick="openLeaderboard\(\)"/,
    openJourney:           /onclick="openJourney\(\)"/,
    openSettingsZeloPro:   /onclick="openSettingsZeloPro\(\)"/,
    openDownloadData:      /onclick="openDownloadData\(\)"/,
  };
  const orphaned = Object.entries(entries).filter(([, re]) => !re.test(html)).map(([name]) => name);
  assert.deepEqual(orphaned, []);
  // ...and the widgets that carry them are not hidden.
  assert.doesNotMatch(html, /widget-card--leaderboard"[^>]*\shidden/);
  assert.doesNotMatch(html, /widget-card--activity"[^>]*\shidden/);
  assert.doesNotMatch(html, /settings2-pro-card"[^>]*\shidden/);
});

// One currency, one source of truth: the paywall shipped in USD while every
// other screen was in THB, and the one-time offer struck through THB 2,999 —
// a price no product has ever had.
test('pricing is one currency derived from the real products', () => {
  assert.doesNotMatch(html, /\$\d+\.\d\d/, 'no hardcoded USD prices in markup');
  assert.match(script, /const PRICE_ANNUAL_THB\s*=\s*999;/);
  assert.match(script, /const PRICE_MONTHLY_THB\s*=\s*399;/);
  // Quoted, so the comment that explains why it was removed doesn't trip this.
  assert.ok(!/['"`]THB 2,999/.test(script) && !html.includes('>THB 2,999'),
    'the fabricated anchor price must not come back');
  // The annual anchor must be a real figure: 12 months at the monthly rate.
  assert.match(script, /PRICE_ANNUAL_AT_MONTHLY_THB = PRICE_MONTHLY_THB \* 12/);
  // Subscription screens need working Terms / Privacy / Restore.
  assert.match(html, /cine-offer-legal">\s*<a[^>]*terms\.html/);
  assert.match(html, /restorePurchasesFromPaywall\(\)/);
});

// Unconfigured Apple/Google buttons were reachable in onboarding step 14,
// which every new user has to get past.
test('sign-in providers are gated until their native config exists', () => {
  const auth = read('services/auth.js');
  assert.match(auth, /const PROVIDER_ENABLED = \{ apple: false, google: false \}/);
  assert.match(auth, /\[data-provider\]/);
  // Both call sites refuse, not just the hidden buttons.
  assert.match(auth, /if \(!PROVIDER_ENABLED\.apple\)/);
  assert.match(auth, /if \(!PROVIDER_ENABLED\.google\)/);
  // No placeholder OAuth config left in the shipped native config.
  assert.ok(!read('ios/App/App/Info.plist').includes('REPLACE_WITH'));
  // Capacitor and Xcode must agree on the bundle id.
  assert.equal(JSON.parse(read('capacitor.config.json')).appId, 'com.ozlilbrother.zelo');
});

// Password reset used to email a link that opened Safari at the website, with
// no way to set a password in the app. It is a recovery code now.
test('password reset completes inside the app', () => {
  const auth = read('services/auth.js');
  assert.match(auth, /type: 'recovery'/);
  assert.match(auth, /auth\.updateUser\(\{ password: pw \}\)/);
  // The session that verifyOtp issues must not navigate away mid-reset.
  assert.match(auth, /if \(_resettingPassword\) return;/);
  assert.match(html, /id="auth-reset-overlay"/);
  // The old dead-end step is gone.
  assert.ok(!html.includes('auth-forgot-sent'));
  assert.ok(!auth.includes('_forgotCountdown'));
});

// Retention pruning used to run inside getThreads(), making every render a
// destructive write that deleted history nobody had asked it to.
test('getThreads is a pure read and pruning is explicit', () => {
  const getThreads = script.match(/function getThreads\(\) \{[\s\S]*?\n\}/)[0];
  assert.ok(!getThreads.includes('setItem'), 'getThreads must not write');
  assert.ok(!getThreads.includes('cutoff'), 'getThreads must not prune');
  assert.match(script, /function pruneExpiredScans\(\)/);
  assert.match(script, /pruneExpiredScans\(\);\s*\/\/ retention enforced once per launch/);
  // An unset preference must not silently delete anything.
  const windowFn = script.match(/function _retentionWindowMs\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(windowFn, /if \(!pref \|\| pref === 'forever'\) return null;/);
  // Shortening the window confirms first.
  assert.match(script, /function retentionDeleteCount\(value\)/);
  assert.match(script, /showDeleteConfirm\(\s*\n?\s*`This will delete \$\{doomed\}/);
});

// The export has to actually hand over a file. `<a download>` is a no-op in an
// iOS WKWebView, so the native path must be the share sheet.
test('data export works inside the native webview', () => {
  assert.match(script, /navigator\.canShare\(\{ files: \[file\] \}\)/);
  assert.match(script, /navigator\.share\(\{ files: \[file\]/);
  assert.match(script, /e\.name === 'AbortError'/);        // cancel is not a failure
  assert.match(script, /function buildAccountExport\(\)/);
});

// Entitlement must be one switch, and the UI must never claim a subscription
// that does not exist.
test('entitlement is a single seam and the UI reports it truthfully', () => {
  assert.match(script, /const ENTITLEMENT_UNLOCK_ALL = true;/);
  assert.match(script, /function getEntitlement\(\)/);
  assert.match(script, /return ENTITLEMENT_UNLOCK_ALL \|\| getEntitlement\(\)\.active;/);
  assert.ok(!html.includes('Renews on Aug 15, 2026'), 'no invented renewal date');
  assert.ok(!html.includes('>Annual Plan<'), 'plan name must be rendered, not hardcoded');
});

// The non-binary deck used to serve ten blank "Layout N" placeholder cards,
// then a 3-card pool with empty-state copy that gave false advice.
test('non-binary deck uses real personas and honest empty copy', () => {
  assert.match(script, /const NONBINARY_IDENTITY_RE = /);
  const re = new RegExp(script.match(/const NONBINARY_IDENTITY_RE = \/(.+?)\/i;/)[1], 'i');
  const idents = [read('personas-men.js'), read('personas-roster.js')]
    .flatMap(src => [...src.matchAll(/"ident":\s*"([^"]*)"/g)].map(m => m[1]));
  assert.ok(idents.filter(i => re.test(i)).length >= 5, 'the umbrella must match the real roster');
  assert.match(script, /reason === 'nonbinary'/);
  // The non-binary branch must set its OWN reason, not reuse 'filter' (whose
  // copy tells the user to widen an age range, which changes nothing here).
  const nbBranch = script.match(/if \(practiceMode === 'nonbinary'\) \{[\s\S]*?\n    \}/)[0];
  assert.match(nbBranch, /deckEmptyReason = 'nonbinary'/);
  assert.ok(!nbBranch.includes("deckEmptyReason = 'filter'"));
  assert.match(script, /switch who you practise with in Home settings/);
});

// ── Added 2026-10-22b ─────────────────────────────────────────────

// Character photos are WebP (48% smaller at the same 1080x1350). The risk is a
// half-done conversion: a stray .jpg reference, or an id whose set is short a
// file, either of which is a broken image in the swipe deck.
test('character photos are WebP and every set is complete', () => {
  const dir = path.join(ROOT, 'assets/characters');
  const files = fs.readdirSync(dir).filter(f => !f.startsWith('._'));
  const byExt = files.reduce((a, f) => { const e = path.extname(f).toLowerCase(); a[e] = (a[e] || 0) + 1; return a; }, {});
  assert.deepEqual(Object.keys(byExt), ['.webp'], 'assets/characters must contain only .webp');

  // Every persona id needs photos 1-4 plus a pfp.
  const ids = [...new Set(files.map(f => f.replace(/-(?:\d|pfp)\.webp$/i, '')))];
  const incomplete = ids.filter(id =>
    !['1', '2', '3', '4', 'pfp'].every(sfx => files.includes(`${id}-${sfx}.webp`)));
  assert.deepEqual(incomplete, [], 'every id needs -1..-4 and -pfp');

  // No source may still point at a .jpg.
  const sources = ['index.html', 'style.css', 'script.js', 'data.js',
    'personas.js', 'personas-men.js', 'personas-roster.js', 'personas-posts.js'].map(read).join('\n');
  assert.doesNotMatch(sources, /assets\/characters\/[^"'`\s]*\.jpg/i);

  // The originals must still exist somewhere — this folder is gitignored, so
  // the archive is the ONLY copy.
  const archive = path.join(ROOT, 'design-refs/characters-original-jpg-2026-10-22');
  assert.ok(fs.existsSync(archive), 'JPEG originals archive is missing');
  assert.equal(fs.readdirSync(archive).filter(f => f.endsWith('.jpg')).length, files.length);
});

// Daily Missions used to be static markup reading "0/1" forever while
// promising XP that was never awarded for them.
test('daily missions are wired to real XP triggers and pay what they promise', () => {
  // Each row declares which XP source it tracks.
  // A mission row contains spans and a button but no nested div, so lazy-match
  // to its own closing tag.
  const rows = [...html.matchAll(/<div class="mission-row" data-mission="(\w+)">([\s\S]*?)<\/div>/g)];
  assert.ok(rows.length >= 3, 'mission rows must carry data-mission');

  const targets = {};
  const spec = script.match(/const DAILY_MISSIONS = \{[\s\S]*?\n\};/)[0];
  for (const m of spec.matchAll(/(\w+):\s*\{\s*target:\s*(\d+)/g)) targets[m[1]] = Number(m[2]);

  const sources = {};
  const xpSrc = script.match(/const XP_SOURCES = \{[\s\S]*?\n\};/)[0];
  for (const m of xpSrc.matchAll(/(\w+):\s*\{\s*xp:\s*(\d+),\s*dailyCap:\s*(\d+)/g)) {
    sources[m[1]] = { xp: Number(m[2]), cap: Number(m[3]) };
  }

  for (const [, mission, body] of rows) {
    const src = sources[mission];
    assert.ok(src, `mission "${mission}" must map to an XP_SOURCES entry`);
    const target = targets[mission];
    assert.ok(target, `mission "${mission}" needs a target`);

    // The badge must equal what finishing it actually pays out.
    const badge = Number(body.match(/mission-row-xp">\+(\d+) XP/)[1]);
    assert.equal(badge, src.xp * target,
      `"${mission}" advertises +${badge} XP but pays ${src.xp} x ${target}`);

    // The printed progress denominator must be the target.
    assert.equal(Number(body.match(/mission-row-progress">\d+\/(\d+)/)[1]), target);

    // A daily cap below the target would make the mission impossible.
    assert.ok(target <= src.cap, `"${mission}" target ${target} exceeds daily cap ${src.cap}`);

    // The trigger has to actually be called somewhere.
    assert.ok(new RegExp(`awardXP\\('${mission}'\\)`).test(script), `awardXP('${mission}') is never called`);
  }

  // Progress comes from the same counters awardXP writes, so it cannot drift.
  assert.match(script, /function renderDailyMissions\(\)/);
  assert.match(script, /const daily = _xpDailyState\(\);/);
  assert.match(script, /renderDailyMissions\(\);\s*\/\/ the only thing that can move a mission/);

  // "Revive a dead conversation" cannot be completed while chatStore is
  // in-memory only, so it must not be advertised.
  assert.ok(!html.includes('Revive a dead conversation'));
  assert.match(script, /let chatStore = \[\];/); // if this ever persists, revive becomes possible again

  // The Go button hides on completion, which needs its own [hidden] rule —
  // an author `display` beats the UA stylesheet.
  assert.match(read('style.css'), /\.mission-row-go\[hidden\]\s*\{\s*display:\s*none;?\s*\}/);
});

// The "How to Level Up" modal advertised four payouts that are never awarded:
// streak XP, daily-quest bonus XP, revival XP and referral XP. XP_SOURCES has
// only scan/message/conversation.
test('the level-up modal only advertises XP that is actually awarded', () => {
  const sources = {};
  const xpSrc = script.match(/const XP_SOURCES = \{[\s\S]*?\n\};/)[0];
  for (const m of xpSrc.matchAll(/(\w+):\s*\{\s*xp:\s*(\d+)/g)) sources[m[1]] = Number(m[2]);

  // Every "Everyday actions" row must match an XP_SOURCES amount exactly.
  const everyday = html.match(/Everyday actions[\s\S]*?<\/div>\s*\n\s*<div class="levelup-section">/);
  assert.ok(everyday, 'Everyday actions section not found');
  const amounts = [...everyday[0].matchAll(/levelup-row-label">([^<]+)<[\s\S]*?levelup-row-xp">\+(\d+) XP</g)]
    .map(m => ({ label: m[1].trim(), xp: Number(m[2]) }));
  const real = new Set(Object.values(sources));
  const bogus = amounts.filter(a => !real.has(a.xp));
  assert.deepEqual(bogus, [], 'these rows promise XP no source awards');

  for (const claim of ['Keep your streak alive', 'Revive a dead conversation',
                       'Refer a friend who joins', 'Finish top of the weekly leaderboard']) {
    assert.ok(!html.includes(claim), `"${claim}" awards no XP and must not be advertised`);
  }
  // Per-unit amounts in the modal must equal the code's.
  assert.ok(html.includes('>+' + sources.scan + ' XP<'));
  assert.ok(html.includes('>+' + sources.message + ' XP<'));
  assert.ok(html.includes('>+' + sources.conversation + ' XP<'));
});

// ── Added 2026-10-22c ─────────────────────────────────────────────

// A webview console.log is bridged to the native os_log and captured by a
// sysdiagnose, so the OCR path was writing the conversation read out of the
// user's screenshot — their private messages — into the device log.
test('nothing logs user or AI content to the device log', () => {
  const sources = [script, read('services/auth.js'), read('services/records.js'),
                   read('services/analytics.js'), read('services/support.js')].join('\n');
  const calls = [...sources.matchAll(/console\.(log|warn|error|debug|info)\(([^\n]*)/g)];
  // Identifiers that carry user or model content. A console call may not take one.
  const CONTENT = /\b(extracted|messages|data|text|reply|replies|prompt|body|details|content|message|transcript|conversation|value|input)\b/;
  const leaks = calls
    .map(m => ({ line: sources.slice(0, m.index).split('\n').length, call: m[0].slice(0, 110) }))
    .filter(c => CONTENT.test(c.call.replace(/"[^"]*"|'[^']*'/g, '')));  // ignore literal strings
  assert.deepEqual(leaks, [], 'console call appears to take content as an argument');
  // The two specific ones that shipped must not come back.
  assert.ok(!script.includes('raw extracted conversation'));
  assert.ok(!script.includes('openai-proxy response'));
});

// Three toggles — two of them privacy controls — were wired to a function
// whose entire body was navigator.vibrate(4).
test('leaderboard settings persist and actually apply', () => {
  assert.match(script, /const LB_SETTINGS_KEY = 'zelo_lb_settings';/);
  assert.match(script, /function lbSettings\(\)/);
  assert.match(script, /function lbDisplayName\(\)/);
  // Saving happens on toggle, and the board re-renders so the change is visible.
  const fn = script.match(/function toggleLbSetting\(el\) \{[\s\S]*?\n\}/)[0];
  assert.match(fn, /_lbSaveSettings\(next\)/);
  assert.match(fn, /renderLeaderboard\(\)/);
  // Anonymous by default — this is what the Privacy Policy already states.
  assert.match(script, /LB_SETTINGS_DEFAULTS = \{ show: true, anon: true/);
  // The name the board shows for you must go through the anonymising helper.
  assert.match(script, /const myName\s*=\s*lbDisplayName\(\);/);
  assert.ok(!/const myName\s*=\s*getDisplayName\(\);/.test(script));
  // "Notify when overtaken" needs a backend + push; it must stay hidden.
  assert.match(html, /<div class="settings-toggle-row" hidden>[\s\S]*?Notify when overtaken/);
});

// The 'via' property was being stripped by the allowlist, so there was no way
// to tell how a referral spread.
test('referral analytics keep their properties', () => {
  assert.match(read('services/analytics.js'), /referral_link_shared:\s*\['via'\]/);
  for (const via of ['native_share', 'copy', 'instagram_native', 'messages_native']) {
    assert.ok(script.includes(`via: '${via}'`), `missing referral source: ${via}`);
  }
  // A redemption is the other side of a referral, not another share.
  assert.match(script, /track\('referral_signup_completed'\)/);
  // Streak and badges are real features; they were allowlisted but never fired.
  assert.match(script, /track\('streak_incremented', \{ days:/);
  assert.match(script, /track\('streak_broken', \{ days:/);
  assert.match(script, /track\('badge_earned', \{ badge_id:/);
});

// Every function should be reachable, and every screen should have a way in —
// this is the check that would have caught the orphaned Leaderboard/Mission
// Control screens in the first place.
test('no orphaned functions and no unreachable screens', () => {
  const loaded = [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1])
    .filter(f => fs.existsSync(path.join(ROOT, f)));
  const js = loaded.map(f => read(f)).join('\n');
  const all = js + '\n' + html;
  const defs = [...new Set([...script.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]))];
  const orphans = defs.filter(n => {
    const esc = n.replace(/\$/g, '\\$');
    const uses = (all.match(new RegExp(`\\b${esc}\\b`, 'g')) || []).length;
    const made = (js.match(new RegExp(`function\\s+${esc}\\b`, 'g')) || []).length;
    return uses <= made;
  });
  assert.deepEqual(orphans, [], 'these functions are never called');

  const screens = [...html.matchAll(/id="screen-([a-z0-9-]+)"/g)].map(m => m[1]);
  const unreachable = screens.filter(s => !new RegExp(`screen-${s}|['"\`]${s}['"\`]`).test(script));
  assert.deepEqual(unreachable, [], 'these screens have no way in');
});

// The trial screen ran 148px past the fold on a 667pt iPhone SE, which is the
// screen every new user has to get through.
test('short phones get the paywall compression rules', () => {
  const css = read('style.css');
  const block = css.match(/@media \(max-height: 740px\) \{[\s\S]*?\n\}\n/);
  assert.ok(block, 'short-screen media query is missing');
  assert.match(block[0], /\.cine-trial-hero-img[\s\S]*?max-height:\s*calc\(var\(--app-vh\) \* 40\)/);
  assert.match(block[0], /object-fit:\s*cover/);
  assert.match(block[0], /\.paywall-hero[\s\S]*?var\(--app-vh\) \* 9\.5/);
  // Scoped by height, never width — a width query would catch the iPad too.
  // (Checked by counting: the hero cap must exist exactly once, inside the
  // max-height block above, and nowhere else in the file.)
  const capCount = (css.match(/\.cine-trial-hero-img\s*\{[^}]*max-height/g) || []).length;
  assert.equal(capCount, 1, 'the trial hero cap must be defined once, in the max-height block');
  assert.ok(block[0].includes('.cine-trial-hero-img'));
});

// Orientation data was written to the device and never read or uploaded.
test('no special-category data is stored without a purpose', () => {
  assert.ok(!script.includes('zelo_onb_attracted'), 'orientation must not be persisted unused');
  // The functional value (who you practise with) lives here and is still set.
  assert.match(script, /setItem\('zelo_practice_mode', o\.value\)/);
  // A cached notification-permission string can never be trusted; use the live check.
  assert.ok(!script.includes('zelo_notif_permission'));
  assert.match(script, /LN\.checkPermissions\(\)/);
});

// ── Added 2026-10-22d ─────────────────────────────────────────────

// chatStore was `let chatStore = []` with no persistence: every practice
// conversation vanished on relaunch and the Chats tab was empty on every open.
test('practice chats persist across a relaunch', () => {
  assert.match(script, /const CHATS_KEY\s*=\s*'zelo_chats';/);
  assert.match(script, /function loadChats\(\)/);
  assert.match(script, /function saveChatsNow\(\)/);
  // Loaded before anything can render the Chats tab.
  assert.match(script, /loadChats\(\);\s*\/\/ practice conversations survive a relaunch/);
  // Saved from the one place every message is written, and on structural changes.
  const sync = script.match(/function syncChatToStore\([\s\S]*?\n\}/)[0];
  assert.match(sync, /saveChats\(\);/);
  // Backgrounding is the last reliable moment before iOS can discard the webview.
  assert.match(script, /document\.hidden\) saveChatsNow\(\)/);
  assert.match(script, /addEventListener\('pagehide', saveChatsNow\)/);

  // Stored slim: the persona is an id, never the whole object (it carries four
  // photo paths and a long systemPrompt).
  const ser = script.match(/function _serializeChats\(\)[\s\S]*?\n\}/)[0];
  assert.match(ser, /profileId: c\.profile && c\.profile\.id/);
  assert.ok(!/profile:\s*c\.profile/.test(ser), 'must not serialise the whole persona');
  // Transient reply state must not be restored as if it were still happening.
  const saved = script.match(/_CHAT_SAVED_FIELDS = \[([\s\S]*?)\]/)[1];
  assert.ok(!/'typing'/.test(saved) && !/'replyFailed'/.test(saved));
  assert.match(script, /typing: false, replyFailed: null/);
  // Bounded, so it cannot grow without limit in localStorage.
  assert.match(script, /CHATS_MAX\s*=\s*\d+/);
  assert.match(script, /CHAT_MSGS_MAX\s*=\s*\d+/);

  // Signing out must not leave the previous account's conversations behind.
  assert.match(script, /function clearLocalChats\(\)/);
  assert.match(read('services/auth.js'), /clearLocalChats\(\)/);
  // And a different account on the same device is caught on load.
  assert.match(script, /if \(uid && owner && owner !== uid\) \{ clearLocalChats\(\); return; \}/);
});

// The "Cold" card mode was the only paid-only one, and its gate was reachable
// only from code that was already dead.
test('the Cold card mode is gone', () => {
  const d = read('data.js');
  // Scoped to the array, so the comment explaining the removal doesn't match.
  const modes = d.match(/const CARD_MODES = \[([\s\S]*?)\];/)[1];
  assert.ok(!/cold/i.test(modes), 'cold must not come back');
  assert.ok(!/free:\s*false/.test(modes), 'no paid-only card mode remains');
  assert.ok(!script.includes('isColdAvailable'));
  // The two real modes stay, and the default is still valid.
  assert.match(d, /key:\s*"open"/);
  assert.match(d, /key:\s*"neutral"/);
  const def = d.match(/const CARD_MODE_DEFAULT = "(\w+)"/)[1];
  assert.ok(new RegExp(`key:\\s*"${def}"`).test(d), 'CARD_MODE_DEFAULT must name a mode that exists');
});

// ── Added 2026-10-22f ─────────────────────────────────────────────

// There were TWO forgot-password flows and only the sign-in sheet's had been
// converted from "emailed link" to "code". Settings > Profile & Login still sent
// a link and showed "Reset link sent!" with nowhere to type a code.
test('password reset has ONE entry point, and Settings uses the code flow', () => {
  const auth = read('services/auth.js');
  assert.ok(!html.includes('screen-settings-reset-sent'), 'the link-sent page must stay deleted');
  assert.ok(!html.includes('Reset link sent'), 'no link wording left in the markup');
  assert.ok(!script.includes('plResendPasswordReset') && !script.includes('AUTH.sendPasswordReset'));
  assert.ok(!auth.includes('async function sendPasswordReset'), 'the link helper must stay deleted');
  assert.match(script, /AUTH\.startPasswordReset\(document\.getElementById\('pl-forgot-email'\)\?\.value, 'settings'\)/);
  assert.match(auth, /startPasswordReset\(document\.getElementById\('auth-forgot-email'\)\?\.value, 'sheet'\)/);
  assert.match(html, /Send reset code<\/button>/);
});

// The send button used to await two server calls AND the SMTP send (~5 s) before
// showing the next page, and two quick taps sent two emails.
test('reset screen opens immediately; the email is sent in the background, once', () => {
  const auth = read('services/auth.js');
  const start = auth.match(/function startPasswordReset\([\s\S]*?\n  \}/)[0];
  assert.ok(!/\bawait\b/.test(start), 'startPasswordReset must not wait on the network');
  assert.match(start, /_resetTapLatch/);
  assert.match(start, /_showResetScreen\(email\);[\s\S]*_deliverResetCode\(email, false\);/);
  assert.ok(!/await _deliverResetCode\(email, false\)/.test(start), 'the first send must not be awaited');
  const sendForgot = auth.match(/function sendForgot\(\) \{[\s\S]*?\n  \}/)[0];
  assert.ok(!/\bawait\b/.test(sendForgot) && !/async function sendForgot/.test(auth));

  // The attempt is recorded BEFORE the network call, so a re-entry cannot race it.
  const deliver = auth.match(/async function _deliverResetCode[\s\S]*?\n  \}\n/)[0];
  assert.ok(deliver.indexOf('_markResetSent(email)') < deliver.indexOf('resetPasswordForEmail'));
  assert.match(deliver, /_resetCooldownLeft\(email\) > 0/);
  // A failure must not leave a cooldown behind, or the user is locked out of retrying.
  assert.ok((deliver.match(/_clearResetSent\(\)/g) || []).length >= 3);

  // Resend disables on THIS tap, before any await.
  const resend = auth.match(/async function handleResetResend\(\) \{[\s\S]*?\n  \}/)[0];
  assert.ok(resend.indexOf('_resetResendCountdown()') < resend.indexOf('await'));
});

// .auth-overlay's base rule was deleted in the 2026-08-15 auto-commit that added
// the bottom-sheet sign-in. The sign-up code screen, the password-reset screen
// and the name/age setup then had no position and no background: transparent
// blocks in the page flow with the screen behind showing through.
test('the full-screen auth overlays are positioned and opaque', () => {
  const css = read('style.css');
  const rule = css.match(/\.auth-overlay:not\(\.auth-overlay--sheet\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(rule, 'base rule for the full-screen auth overlays is missing');
  assert.match(rule[1], /position:\s*absolute/);
  assert.match(rule[1], /inset:\s*0/);
  assert.match(rule[1], /background:\s*var\(--bg\)/);
  assert.match(rule[1], /z-index:\s*2000/);
  assert.match(css, /\.auth-overlay:not\(\.auth-overlay--sheet\)\[hidden\]\s*\{\s*display:\s*none/);
  for (const id of ['auth-verify-overlay', 'auth-reset-overlay', 'auth-setup-overlay']) {
    assert.match(html, new RegExp(`id="${id}"[^>]*class="auth-overlay"|class="auth-overlay"[^>]*id="${id}"`), `${id} must use the shared class`);
  }
});

// Supabase had mailer_otp_length = 8 while the app has 6 boxes and requires 6.
test('the setup script can only set the OTP length the app is built for', () => {
  const setup = read('scripts/setup-email.mjs');
  assert.match(setup, /mailer_otp_length:\s*v => \{ if \(v !== '6'\)/);
  assert.match(read('services/auth.js'), /code\.length !== 6/);
  assert.equal([...html.matchAll(/id="auth-reset-code-row"[\s\S]*?<\/div>/g)][0][0].match(/auth-code-input/g).length, 6);
});

// ── Added 2026-10-22g ─────────────────────────────────────────────

// iOS puts a whole one-time code (from Messages / Mail "From Messages") into ONE
// field. The boxes kept only the last character of it, and maxlength="1" cut it
// to a single digit before any script saw it, so autofill never worked.
test('the one-time-code boxes accept a whole code, from autofill or paste, in any box', () => {
  const auth = read('services/auth.js');
  const boxes = [...html.matchAll(/<input class="auth-code-input"[^>]*>/g)].map(m => m[0]);
  assert.equal(boxes.length, 18, 'three rows of six');
  assert.ok(boxes.every(b => !/maxlength/.test(b)), 'maxlength="1" truncates autofill to one digit');
  assert.ok(boxes.every(b => /autocomplete="one-time-code"/.test(b)), 'every box must be an autofill target');
  const bind = auth.match(/function bindCodeRow\([\s\S]*?\n  \}\n  const _initCodeInputs/)[0];
  assert.match(bind, /const fill = \(start, digits\)/);
  assert.match(bind, /fill\(d\.length >= inputs\.length \? 0 : i, d\)/);   // a full code always starts at box 1
  assert.match(bind, /e\.preventDefault\(\);[\s\S]*inputs\[i - 1\]\.value = ''/); // Backspace removes the previous digit
  assert.ok(!/\.slice\(-1\);\s*\n\s*if \(inp\.value && i < inputs\.length - 1\)/.test(bind), 'the keep-only-the-last-character handler must stay gone');
  // ONE implementation: Profile & Login's modal rows delegate to it instead of carrying their own copy.
  assert.match(auth, /\n    bindCodeRow,\n/);
  const pl = script.match(/function _plBindCodeRow\(rowId\) \{[\s\S]*?\n\}/)[0];
  assert.match(pl, /AUTH\.bindCodeRow\(rowId\)/);
  assert.ok(!/addEventListener\('input'/.test(pl), 'no second copy of the box logic');
});

// Typing a code hops focus through six boxes, and the app rewrote the viewport
// meta on EVERY focusin/focusout: measured 10 rewrites per 6-digit code.
test('moving focus between text fields does not rewrite the viewport', () => {
  assert.match(script, /const setMeta = \(v\) => \{ if \(meta\.getAttribute\('content'\) !== v\) meta\.setAttribute\('content', v\); \};/);
  assert.match(script, /isTextField\(e\.target\) && !isTextField\(e\.relatedTarget\)\) setMeta\(NORMAL\)/);
});

// With a code box still focused, the first tap on Change password / Resend was
// eaten by the global "tap outside dismisses the keyboard" handler.
test('the full-screen auth overlays are exempt from the keyboard-dismiss tap swallow', () => {
  assert.match(script, /target\.closest\('#auth-reset-overlay, #auth-verify-overlay, #auth-setup-overlay'\)\) return;/);
});

// ── Added 2026-10-23a ─────────────────────────────────────────────

// my_referral_code() generated a code, UPDATEd the profile (0 rows if the account has no profile
// row), and returned the code anyway: a code that looks real, is shared, and can never be redeemed.
test('referral codes: the server never hands out a code it did not save', () => {
  const sql = read('supabase/migrations/20261023100000_referral_code_needs_profile.sql');
  assert.match(sql, /get diagnostics n = row_count;\s*\n\s*if n = 0 then return null; end if;/);
  // the fix keeps the original contract
  assert.match(sql, /revoke all on function public\.my_referral_code\(\) from public, anon;/);
  assert.match(sql, /grant execute on function public\.my_referral_code\(\) to authenticated;/);
  // anon must never be able to call either referral function (checked in the original migration)
  const orig = read('supabase/migrations/20261019150000_referral_codes.sql');
  assert.match(orig, /revoke all on function public\.redeem_referral_code\(text\) from public, anon;/);
});

// Setup was marked "done" before / regardless of whether the profile insert worked, so an account
// whose insert failed (profiles had no grants until 2026-10-17) looked finished forever.
test('a profile row is confirmed before setup is marked done, and missing ones are created', () => {
  const auth = read('services/auth.js');
  assert.match(auth, /async function ensureProfile\(\)/);
  assert.match(auth, /insertError\.code !== '23505'/);                       // "already exists" is success
  assert.match(auth, /if \(await ensureProfile\(\)\) localStorage\.setItem\('zelo_setup_done', '1'\);/);
  assert.match(auth, /ensureProfile\(\)\.then\(done => \{ if \(done\) localStorage\.setItem\('zelo_setup_done', '1'\); \}\)/);
  assert.ok(!/localStorage\.setItem\('zelo_setup_done', '1'\);\s*\n\s*const userId = _session\?\.user\?\.id;/.test(auth),
    'setup_done must not be set before the insert is known to have worked');
  assert.match(auth, /if \(_session\) ensureProfile\(\)\.then\(ok => \{ if \(ok\) _loadProfileIntoLocalStorage\(\); \}\);/);                  // heals returning users in the background
  assert.match(auth, /\n    ensureProfile,\n/);
  // and the Invite screen asks again after creating the row
  const get = script.match(/async function getReferralCode\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(get, /AUTH\.ensureProfile\(\)/);
  assert.match(get, /code = await ZeloRecords\.getMyReferralCode\(\);\s*\n\s*\}/);
});
