#!/usr/bin/env node
// Sets up Zelo's auth email: a verified Resend domain, then Supabase SMTP + the
// branded code templates in supabase/templates/. No dependencies (Node 18+).
//
//   node scripts/setup-email.mjs plan        offline: validate templates, print what will happen
//   node scripts/setup-email.mjs domain      create/fetch the Resend domain, print the DNS records
//   node scripts/setup-email.mjs status      poll the Resend domain until it verifies
//   node scripts/setup-email.mjs check       read the Supabase auth config and confirm field names
//   node scripts/setup-email.mjs apply       WRITE the SMTP + template settings to Supabase
//   node scripts/setup-email.mjs set KEY=VALUE   change ONE allow-listed Supabase auth setting
//   node scripts/setup-email.mjs apply --make-key
//                                            same, but first create a sending-only Resend key
//                                            restricted to the domain and hand it straight to
//                                            Supabase (never printed, never written to disk)
//
// Secrets come from the environment ONLY and are never printed. Nothing is
// written anywhere without the `apply` command.
//
//   RESEND_API_KEY        full-access key. Used for `domain`/`status` only. Never sent to Supabase.
//   RESEND_SMTP_KEY       a SENDING-ONLY key, restricted to the domain (Resend dashboard > API Keys).
//                         This is the one stored in Supabase as the SMTP password, so if it ever
//                         leaks it can send mail but cannot manage your account.
//   SUPABASE_ACCESS_TOKEN personal access token from the account that OWNS the Zelo project.
//   SUPABASE_PROJECT_REF  defaults to Zelo's project.
//
// Optional: DOMAIN (zelofficial.com), SENDER_LOCAL (noreply), SENDER_NAME (Zelo).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const T = join(here, '..', 'supabase', 'templates');

const DOMAIN      = process.env.DOMAIN       || 'zelofficial.com';
const SENDER_NAME = process.env.SENDER_NAME  || 'Zelo';
const SENDER_MAIL = `${process.env.SENDER_LOCAL || 'noreply'}@${DOMAIN}`;
const REF         = process.env.SUPABASE_PROJECT_REF || 'bfxxywxhydxvccusjinm';

const SUBJECTS = {
  confirmation: 'Your Zelo verification code',
  recovery:     'Reset your Zelo password',
  email_change: 'Confirm your new Zelo email',
};

const tpl = name => readFileSync(join(T, `${name}.html`), 'utf8');
const need = name => {
  const v = process.env[name];
  if (!v) { console.error(`Missing ${name}. Set it in your shell; do not paste it into chat or commit it.`); process.exit(1); }
  return v;
};

// The app verifies with 6-digit codes (verifyOtp). A template without {{ .Token }}
// would email a link the app cannot consume, so refuse before sending anything.
function validateTemplates() {
  const problems = [];
  for (const name of Object.keys(SUBJECTS)) {
    const html = tpl(name);
    if (!html.includes('{{ .Token }}')) problems.push(`${name}.html has no {{ .Token }}`);
    if (html.includes('{{ .ConfirmationURL }}')) problems.push(`${name}.html still contains a link`);
  }
  return problems;
}

// What we PATCH. Field names follow the Supabase Management API's auth config;
// `check` verifies each one exists on your project before `apply` is allowed.
function desiredConfig(smtpKey) {
  return {
    smtp_host: 'smtp.resend.com',
    smtp_port: '465',
    smtp_user: 'resend',
    smtp_pass: smtpKey,
    smtp_admin_email: SENDER_MAIL,
    smtp_sender_name: SENDER_NAME,
    mailer_subjects_confirmation: SUBJECTS.confirmation,
    mailer_templates_confirmation_content: tpl('confirmation'),
    mailer_subjects_recovery: SUBJECTS.recovery,
    mailer_templates_recovery_content: tpl('recovery'),
    mailer_subjects_email_change: SUBJECTS.email_change,
    mailer_templates_email_change_content: tpl('email_change'),
  };
}
const redact = cfg => Object.fromEntries(Object.entries(cfg).map(([k, v]) =>
  [k, k === 'smtp_pass' ? '<redacted>' : (String(v).length > 60 ? `<${String(v).length} chars>` : v)]));

const resend = async (method, path, body) => {
  const r = await fetch(`https://api.resend.com${path}`, {
    method, headers: { Authorization: `Bearer ${need('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Resend ${method} ${path} -> ${r.status} ${j.message || ''}`);
  return j;
};
const supa = async (method, body) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
    method, headers: { Authorization: `Bearer ${need('SUPABASE_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Supabase ${method} auth config -> ${r.status} ${j.message || ''}`);
  return j;
};

async function findDomain() {
  const list = await resend('GET', '/domains');
  return (list.data || []).find(d => d.name === DOMAIN);
}
function printRecords(d) {
  console.log(`\nDomain ${d.name}  status: ${d.status}\nAdd these at your DNS host, then run: status\n`);
  for (const r of d.records || []) {
    const pri = r.priority != null ? `  priority ${r.priority}` : '';
    console.log(`  [${r.status || '?'}] ${r.record || ''}  ${r.type}  ${r.name}${pri}\n        ${r.value}\n`);
  }
}

const cmd = process.argv[2];
try {
  if (cmd === 'plan' || !cmd) {
    const bad = validateTemplates();
    console.log(`Sender        : ${SENDER_NAME} <${SENDER_MAIL}>`);
    console.log(`Supabase ref  : ${REF}`);
    console.log(`Templates     : ${bad.length ? 'PROBLEMS: ' + bad.join('; ') : 'ok (all use {{ .Token }}, no links)'}`);
    console.log('\nWould write to Supabase:\n', JSON.stringify(redact(desiredConfig('x')), null, 2));
    process.exit(bad.length ? 1 : 0);
  }
  if (cmd === 'domain') {
    const d = (await findDomain()) || await resend('POST', '/domains', { name: DOMAIN });
    printRecords(await resend('GET', `/domains/${d.id}`));
  }
  if (cmd === 'status') {
    const d = await findDomain();
    if (!d) throw new Error('No Resend domain yet. Run: domain');
    try { await resend('POST', `/domains/${d.id}/verify`); } catch { /* Resend also re-checks on its own */ }
    printRecords(await resend('GET', `/domains/${d.id}`));
  }
  if (cmd === 'check') {
    const live = await supa('GET');
    const want = Object.keys(desiredConfig('x'));
    const missing = want.filter(k => !(k in live));
    console.log(missing.length ? `These fields are NOT on your project, apply will refuse: ${missing.join(', ')}`
                               : 'All fields exist on your project.');
    console.log(`secure email change enabled: ${live.mailer_secure_email_change_enabled}  (if true, an email change needs a code from BOTH addresses)`);
    console.log(`current SMTP host: ${live.smtp_host || '(none, default sender)'}`);
    process.exit(missing.length ? 1 : 0);
  }
  if (cmd === 'set') {
    // A deliberately tiny allow-list: this is for the two settings that interact with email
    // delivery, not a general config editor.
    const ALLOWED = {
      rate_limit_email_sent: v => { const n = Number(v); if (!Number.isInteger(n) || n < 1 || n > 500) throw new Error('rate_limit_email_sent must be a whole number 1-500'); return n; },
      mailer_autoconfirm:    v => { if (v !== 'true' && v !== 'false') throw new Error('mailer_autoconfirm must be true or false'); return v === 'true'; },
      // The app's code boxes, its "6-digit" copy and verifyOtp's length check all assume 6.
      // Supabase can be set to 6-10, and this project had been set to 8.
      mailer_otp_length:     v => { if (v !== '6') throw new Error('mailer_otp_length must be 6 (the app is built for 6-digit codes)'); return 6; },
    };
    const [key, raw] = String(process.argv[3] || '').split('=');
    if (!ALLOWED[key] || raw === undefined) throw new Error(`Usage: set KEY=VALUE, KEY one of: ${Object.keys(ALLOWED).join(', ')}`);
    const value = ALLOWED[key](raw);
    const live = await supa('GET');
    if (!(key in live)) throw new Error(`${key} isn't on your project`);
    console.log(`${key}: ${live[key]} -> ${value}`);
    await supa('PATCH', { [key]: value });
    console.log('Done.');
  }
  if (cmd === 'apply') {
    const bad = validateTemplates();
    if (bad.length) throw new Error('Templates invalid: ' + bad.join('; '));
    const d = await findDomain();
    if (!d || d.status !== 'verified') throw new Error(`Resend domain is "${d ? d.status : 'missing'}", not verified. Finish DNS first.`);
    const live = await supa('GET');
    let smtpKey = process.env.RESEND_SMTP_KEY;
    if (!smtpKey && process.argv.includes('--make-key')) {
      // Sending-only and limited to this one domain, so if Supabase's copy ever leaks it can
      // send mail from zelofficial.com but cannot manage the Resend account.
      const made = await resend('POST', '/api-keys', {
        name: `supabase-auth-smtp ${new Date().toISOString().slice(0, 10)}`,
        permission: 'sending_access',
        domain_id: d.id,
      });
      if (!made.token) throw new Error('Resend did not return a key');
      smtpKey = made.token;
      console.log('Created a sending-only Resend key (not shown).');
    }
    const cfg = desiredConfig(smtpKey || need('RESEND_SMTP_KEY'));
    const missing = Object.keys(cfg).filter(k => !(k in live));
    if (missing.length) throw new Error(`Refusing: these fields aren't on your project: ${missing.join(', ')}`);
    await supa('PATCH', cfg);
    console.log('Applied:\n', JSON.stringify(redact(cfg), null, 2));
  }
} catch (e) {
  console.error(String(e.message || e).replace(/re_[A-Za-z0-9_]+/g, 're_***').replace(/sbp_[A-Za-z0-9]+/g, 'sbp_***'));
  process.exit(1);
}
