/**
 * Browser glue for the journey ledger: launch Chromium, give each trial a FRESH rostered member, enumerate the controls
 * that are visible, press one, and gather what a person would see. The judgement is classify.mjs; nothing here decides.
 *
 * Isolation: every trial runs as its own never-before-seen member in its own browser context, so pressing "Just let me
 * write" (which makes a Work) cannot change the Home that the next control is tried from.
 *
 * Dev-mode artefact neutralised, disclosed: `next dev` mounts a <nextjs-portal> element that covers the bottom-left
 * corner and swallows clicks on whatever is under it ("Beta journey" sits there). The init script removes that element
 * (and only that element) from every document. A click that is still intercepted by anything else is the product's.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

/** Find a Chromium the harness can drive. JL_CHROMIUM wins; then Playwright's own; then a pre-installed browser cache. */
export function findChromium() {
  if (process.env.JL_CHROMIUM && fs.existsSync(process.env.JL_CHROMIUM)) return process.env.JL_CHROMIUM;
  let own = null;
  try { own = require('playwright').chromium.executablePath(); } catch { /* fall through */ }
  if (own && fs.existsSync(own)) return own;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers', path.join(process.env.HOME || '', '.cache/ms-playwright')].filter(Boolean);
  const found = [];
  for (const root of roots) {
    let dirs = [];
    try { dirs = fs.readdirSync(root); } catch { continue; }
    for (const d of dirs.filter(x => /^chromium-\d+$/.test(x))) {
      for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe']) {
        const p = path.join(root, d, sub);
        if (fs.existsSync(p)) found.push({ n: Number(d.split('-')[1]), p });
      }
    }
  }
  found.sort((a, b) => b.n - a.n);
  return found[0]?.p || null;
}

export async function launch() {
  const { chromium } = require('playwright');
  const executablePath = findChromium();
  const args = typeof process.getuid === 'function' && process.getuid() === 0 ? ['--no-sandbox'] : [];
  return chromium.launch({ headless: true, executablePath: executablePath || undefined, args });
}

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

const REMOVE_DEV_PORTAL = `
(() => {
  const kill = () => { document.querySelectorAll('nextjs-portal').forEach(n => n.remove()); };
  const start = () => { kill(); new MutationObserver(kill).observe(document.documentElement, { childList: true, subtree: true }); };
  // An init script runs before <html> exists: wait for it, or the observer is never attached.
  if (document.documentElement) start();
  else new MutationObserver((_m, o) => { if (document.documentElement) { o.disconnect(); start(); } }).observe(document, { childList: true });
})();`;

/** A new browser context for one trial: dev portal removed, requests off localhost blocked and counted. */
export async function newContext(browser, base, blocked) {
  const ctx = await browser.newContext({ baseURL: base, viewport: { width: 1280, height: 900 } });
  ctx.setDefaultNavigationTimeout(120000);   // the first request to a route compiles it under next dev
  ctx.setDefaultTimeout(60000);
  await ctx.addInitScript(REMOVE_DEV_PORTAL);
  const origin = new URL(base).origin;
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(origin) || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('about:')) return route.continue();
    blocked.push(`${route.request().method()} ${u.slice(0, 120)}`);
    return route.abort('blockedbyclient');
  });
  return ctx;
}

/**
 * Sign a (fictional, rostered) member in through the REAL sign-in form, as a person does. Not through the API alone: the form
 * also writes the client-side session cache (localStorage memberId / beta_user), and parts of the product (for example the
 * "Report a bug" launcher, see getValidMemberId in lib/http/apiBase.ts) appear only when it is set. A member signed in by API
 * would see a different page from a real one.
 */
export async function signInViaForm(page, member) {
  await page.goto(`/signin?u=${encodeURIComponent(member.username)}`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Password').fill(member.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  // The form stores the session cache after the server has set the cookie, then routes on (to /home). Let that finish, or a
  // navigation of our own would collide with it (net::ERR_ABORTED).
  await page.waitForFunction(() => !!(localStorage.getItem('memberId') || localStorage.getItem('beta_user')), null, { timeout: 60000 });
  await page.waitForURL(u => !/^\/signin/.test(u.pathname), { timeout: 90000 });
}

/** page.goto, retrying a navigation that was superseded by another (net::ERR_ABORTED) a couple of times. */
export async function gotoRetrying(page, url, opts = { waitUntil: 'domcontentloaded' }) {
  for (let i = 0; ; i += 1) {
    try { return await page.goto(url, opts); }
    catch (e) { if (!/ERR_ABORTED|frame was detached/i.test(String(e)) || i >= 2) throw e; await page.waitForTimeout(1500); }
  }
}

/** In-page: the controls a person can see and press. Marks each with data-jl for the locator. */
const ENUMERATE = () => {
  const SEL = 'a[href],button,[role=button],[role=tab],[role=menuitem],[role=link],[role=switch],summary,input[type=button],input[type=submit]';
  const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const out = [];
  const seen = new Map();
  let n = 0;
  for (const el of document.querySelectorAll(SEL)) {
    if (el.closest('nextjs-portal')) continue;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role') || '';
    const href = el.getAttribute('href');
    const label = clean(el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('title') || '').slice(0, 80);
    const disabled = el.disabled === true || el.getAttribute('aria-disabled') === 'true';
    let disabledReason = '';
    if (disabled) {
      const describedBy = (el.getAttribute('aria-describedby') || '').split(/\s+/).map(id => document.getElementById(id)?.innerText || '').join(' ');
      disabledReason = clean(el.getAttribute('title') || el.getAttribute('aria-description') || describedBy || '');
    }
    const base = `${tag}|${role}|${label}|${href ?? ''}`;
    const ord = (seen.get(base) || 0) + 1; seen.set(base, ord);
    el.setAttribute('data-jl', String(n));
    out.push({
      idx: n, key: `${base}#${ord}`, tag, role, label, href, disabled, disabledReason,
      kind: tag === 'a' || role === 'link' ? 'link' : tag === 'summary' ? 'disclosure' : 'button',
      disclosure: tag === 'summary' || el.hasAttribute('aria-expanded') || el.hasAttribute('aria-haspopup'),
      target: el.getAttribute('target') || '',
      selected: ['aria-pressed', 'aria-checked', 'aria-selected'].some(a => el.getAttribute(a) === 'true') || (el.hasAttribute('aria-current') && el.getAttribute('aria-current') !== 'false'),
      cls: String(el.className || '').slice(0, 40),
    });
    n += 1;
  }
  const fields = [...document.querySelectorAll('input:not([type=button]):not([type=submit]):not([type=hidden]),textarea,select')]
    .filter(el => !el.closest('nextjs-portal') && (typeof el.checkVisibility !== 'function' || el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })))
    .map(el => clean(el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || el.tagName).slice(0, 60));
  return { controls: out, fields };
};

export async function enumerateControls(page) {
  return page.evaluate(ENUMERATE);
}

/** A person waits for a control that mounts late; so does the walk (up to ms), then reports it missing. */
export async function waitForControl(page, key, ms = 10000) {
  const t0 = Date.now();
  for (;;) {
    const { controls } = await enumerateControls(page);
    const c = controls.find(x => x.key === key);
    if (c) return c;
    if (Date.now() - t0 >= ms) return null;
    await page.waitForTimeout(400);
  }
}

/** In-page signature of what is on screen, used to see whether pressing a control changed anything. */
const SIGNATURE = () => {
  const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const states = [...document.querySelectorAll('[aria-pressed],[aria-expanded],[aria-checked],[aria-selected],details,[aria-current]')]
    .filter(el => !el.closest('nextjs-portal'))
    .map(el => `${clean(el.innerText).slice(0, 24)}:${el.getAttribute('aria-pressed') ?? ''}${el.getAttribute('aria-expanded') ?? ''}${el.getAttribute('aria-checked') ?? ''}${el.getAttribute('aria-selected') ?? ''}${el.getAttribute('aria-current') ?? ''}${el.tagName === 'DETAILS' ? (el.open ? 'open' : 'shut') : ''}`);
  const dialogs = document.querySelectorAll('[role=dialog],[aria-modal=true],dialog[open]').length;
  const overlay = (() => {
    const p = document.querySelector('nextjs-portal');
    // Only a real runtime/build error counts. Next's own dev-tools notices (for example its security advisory dialog) do not.
    const t = p && p.shadowRoot ? clean(p.shadowRoot.textContent || '') : '';
    return /Unhandled Runtime Error|Runtime Error|Build Error|Failed to compile|Application error/i.test(t) ? t.slice(0, 400) : null;
  })();
  return { url: location.href, text: clean(document.body ? document.body.innerText : ''), aria: states.join('|'), dialogs, overlay };
};

async function signature(page) {
  const s = await page.evaluate(SIGNATURE);
  const { controls } = await enumerateControls(page);
  return { ...s, controls: controls.length, controlKeys: controls.map(c => c.key), controlList: controls };
}

/** Wait until the page has been quiet (same text, same control count) for `quietMs`, or `capMs` passes. */
export async function settle(page, { quietMs = 1500, capMs = 25000, minControls = 1, notWhile = null } = {}) {
  const t0 = Date.now();
  let last = null; let lastChange = Date.now();
  while (Date.now() - t0 < capMs) {
    const s = await signature(page).catch(() => null);
    if (s) {
      const key = `${s.text.length}|${s.text.slice(0, 200)}|${s.controls}|${s.aria}`;
      if (key !== last) { last = key; lastChange = Date.now(); }
      // `notWhile`: a loading fallback ("Opening Writer's Studio…") is not a page that has settled, however quiet it is.
      if (s.controls >= minControls && Date.now() - lastChange >= quietMs && !(notWhile && notWhile.test(s.text))) return s;
    }
    await page.waitForTimeout(250);
  }
  return signature(page);
}

/** The loading fallback the Studio host shows while a route compiles / data loads. */
export const STUDIO_LOADING = /Opening Writer[’']s Studio…/;

/** Count of same-origin fetch/xhr requests started and not yet finished (not framework assets). */
export function trackInFlight(page, origin) {
  const pending = new Set();
  const counts = (req) => { try { const u = req.url(); const t = req.resourceType(); return u.startsWith(origin) && (t === 'fetch' || t === 'xhr') && !/\/_next\/|\/__nextjs|hot-update/.test(u); } catch { return false; } };
  const onReq = (r) => { if (counts(r)) pending.add(r); };
  const onDone = (r) => { pending.delete(r); };
  page.on('request', onReq); page.on('requestfinished', onDone); page.on('requestfailed', onDone);
  return { count: () => pending.size, stop: () => { page.off('request', onReq); page.off('requestfinished', onDone); page.off('requestfailed', onDone); } };
}

/** The model stub appends one JSON line per call; the walker reads the length before and after a press. */
export function modelCallCount(logPath) {
  try { return fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean).length; } catch { return 0; }
}

function describeClickError(e) {
  const msg = String(e && e.message ? e.message : e);
  if (/intercepts pointer events/.test(msg)) {
    const m = /<([a-z0-9-]+)[^>]*>[^\n]*intercepts pointer events/i.exec(msg) || /(<[^>]+>)[^\n]*intercepts pointer events/i.exec(msg);
    const who = m ? m[0].slice(0, 140) : 'an element';
    return { kind: /nextjs-portal|data-nextjs/.test(msg) ? 'intercepted-by-dev-overlay' : 'intercepted-by-page', message: who };
  }
  if (/not attached|detached|no such control|not found|resolved to 0 elements/i.test(msg)) return { kind: 'not-found', message: msg.split('\n')[0].slice(0, 140) };
  if (/Timeout|timeout/.test(msg)) return { kind: 'timeout', message: msg.split('\n')[0].slice(0, 140) };
  return { kind: 'other', message: msg.split('\n')[0].slice(0, 140) };
}

/**
 * Press one control, already located on `page` by its key, and gather an observation for classifyTrial().
 * `prepare` (optional) is a persona hook that makes a disabled control pressable by doing what a person would do first.
 */
export async function pressAndObserve(page, ctx, control, { base, modelLog, windowMs = 3000, prepare = null, hrefOf = null }) {
  const origin = new URL(base).origin;
  const before = await signature(page);
  const obs = {
    label: control.label || `[unlabelled ${control.tag}${control.cls ? '.' + control.cls : ''}]`, kind: control.kind, href: control.href,
    disabled: false, disabledReason: '', clickError: null, origin,
    urlBefore: before.url, urlAfter: before.url, document: null, linkProbe: null, popup: null,
    landingText: '', textBefore: before.text, textAfter: before.text,
    ariaBefore: before.aria, ariaAfter: before.aria, controlsBefore: before.controls, controlsAfter: before.controls,
    requests: [], modelCalls: 0, dialogOpened: false, overlay: null, revealed: [], revealedControls: [], pageErrors: [], pendingRequests: 0, fileChooserOpened: false,
    alreadySelected: control.selected === true,
  };

  // External / non-http targets are never followed.
  if (control.href) {
    let abs = null;
    try { abs = new URL(control.href, before.url); } catch { abs = null; }
    if (!abs || !/^https?:$/.test(abs.protocol) || abs.origin !== origin) {
      if (!control.href.startsWith('#')) { obs.externalHref = control.href; return obs; }
    }
  }

  const loc = page.locator(`[data-jl="${control.idx}"]`);

  // Disabled: try to do what a person would do first; otherwise report it as disabled.
  let isDisabled = await loc.evaluate(el => el.disabled === true || el.getAttribute('aria-disabled') === 'true').catch(() => false);
  if (isDisabled && prepare) {
    await prepare(page).catch(() => {});
    await page.waitForTimeout(400);
    isDisabled = await loc.evaluate(el => el.disabled === true || el.getAttribute('aria-disabled') === 'true').catch(() => false);
  }
  if (isDisabled) { obs.disabled = true; obs.disabledReason = control.disabledReason || ''; return obs; }
  if (prepare) { await prepare(page).catch(() => {}); await page.waitForTimeout(300); }

  // A dead link is a dead link whatever the click does: probe the target with the member's own session.
  if (control.href && !control.href.startsWith('#')) {
    obs.linkProbe = await page.evaluate(async (h) => {
      try { const r = await fetch(h, { credentials: 'same-origin', redirect: 'follow' }); return { status: r.status, finalUrl: r.url }; }
      catch (e) { return { status: 0, error: String(e) }; }
    }, control.href);
  } else if (control.href && control.href.startsWith('#')) {
    obs.hashTargetExists = await page.evaluate((h) => !!document.getElementById(decodeURIComponent(h.slice(1))) || !!document.querySelector(`[name="${h.slice(1)}"]`), control.href);
  }

  const requests = [];
  const pageErrors = [];
  const onPageError = (e) => { pageErrors.push(String(e && e.message ? e.message : e).split('\n')[0].slice(0, 160)); };
  page.on('pageerror', onPageError);
  const onResponse = (res) => {
    try {
      const req = res.request();
      const type = req.resourceType();
      const url = res.url();
      if (!url.startsWith(origin)) return;
      if (/\/_next\/|\/__nextjs|hot-update|favicon|\.(png|jpe?g|svg|webp|gif|ico|woff2?|css|map)(\?|$)/.test(url)) return;
      if (type === 'document' && req.isNavigationRequest() && req.frame() === page.mainFrame()) { obs.document = { status: res.status(), url }; return; }
      if (type === 'fetch' || type === 'xhr') requests.push({ method: req.method(), url: url.replace(origin, ''), status: res.status() });
    } catch { /* ignore */ }
  };
  page.on('response', onResponse);
  let popupPage = null;
  const onPopup = (p) => { popupPage = p; };
  ctx.on('page', onPopup);

  const inflight = trackInFlight(page, origin);
  let chooser = false;
  const onChooser = () => { chooser = true; };
  page.on('filechooser', onChooser);

  const modelBefore = modelCallCount(modelLog);
  try {
    await loc.click({ timeout: 6000 });
  } catch (e) {
    obs.clickError = describeClickError(e);
  }

  if (!obs.clickError) {
    // Observe: up to windowMs for the first change; once something changes, wait for quiet. A request still in flight is
    // something happening: keep watching until it finishes (cap IN_FLIGHT_CAP_MS), because a cold `next dev` compiles an API
    // route on its first call, and a screen that says "listening…" is not an outcome.
    const IN_FLIGHT_CAP_MS = 60000;
    const t0 = Date.now(); let changedAt = null; let lastKey = null;
    while (Date.now() - t0 < windowMs + IN_FLIGHT_CAP_MS) {
      await page.waitForTimeout(250);
      let s = null;
      try { s = await signature(popupPage || page); } catch { s = null; }
      if (!s) continue;
      const key = `${s.url}|${s.text}|${s.aria}|${s.dialogs}|${s.controls}`;
      const changed = s.url !== before.url || s.text !== before.text || s.aria !== before.aria || s.dialogs !== before.dialogs || s.controls !== before.controls || requests.length > 0 || !!popupPage || chooser;
      if (changed && changedAt === null) { changedAt = Date.now(); lastKey = key; }
      if (changedAt !== null && key !== lastKey) { lastKey = key; changedAt = Date.now(); }
      const quiet = changedAt !== null ? Date.now() - changedAt >= 1200 : Date.now() - t0 >= windowMs;
      if (quiet && inflight.count() === 0) break;
    }
  }
  obs.pendingRequests = inflight.count();
  obs.fileChooserOpened = chooser;
  inflight.stop();
  page.off('filechooser', onChooser);
  page.off('response', onResponse);
  page.off('pageerror', onPageError);
  ctx.off('page', onPopup);
  obs.pageErrors = pageErrors;

  const target = popupPage || page;
  if (!obs.clickError) {
    if (popupPage) { await popupPage.waitForLoadState('domcontentloaded').catch(() => {}); }
    const after = await signature(target).catch(() => null);
    if (after) {
      obs.urlAfter = after.url; obs.textAfter = after.text; obs.ariaAfter = after.aria; obs.controlsAfter = after.controls;
      obs.dialogOpened = after.dialogs > before.dialogs;
      obs.overlay = after.overlay;
      obs.landingText = after.text;
      obs.revealed = after.controlKeys.filter(k => !before.controlKeys.includes(k));
      obs.revealedControls = after.controlList.filter(c => !before.controlKeys.includes(c.key));
    }
    if (popupPage) { obs.popup = { url: popupPage.url() }; await popupPage.close().catch(() => {}); }
  }
  obs.requests = requests;
  // Give an in-flight server-side model call a moment to be logged before counting.
  await page.waitForTimeout(300);
  obs.modelCalls = Math.max(0, modelCallCount(modelLog) - modelBefore);
  return obs;
}

export { norm, signature };
