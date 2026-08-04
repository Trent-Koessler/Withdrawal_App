# Flash of Unstyled Content — diagnosis

Symptom: the toolkit flashes unstyled on NSW Health workstations, but looks fine
on personal machines and phones.

This document records what was found by reading the code, ranked by how much
each finding is likely contributing. Nothing here has been changed yet — see
"Options" at the end.

## Background: why a corporate SOE changes the picture

`index.html` loads `style.css` as a normal render-blocking `<link>` (index.html:44).
On a healthy connection the browser refuses to paint until that file has arrived
and parsed, so there is no window in which unstyled content can appear. Every
FOUC mechanism below is therefore some variant of one of two things:

1. **The first paint does happen, and what it paints is wrong** — because the
   inline critical CSS in `<head>` does not match the real stylesheet.
2. **`style.css` fails, stalls, or is rejected**, which *unblocks* rendering with
   no styles at all.

A NSW Health SOE makes both far more likely than a home network: traffic goes
through an intercepting web filter, `sudtoolkit.org` is a personal domain that is
very likely uncategorised by that filter, and the service worker sitting in front
of every request is configured in a way that amplifies rather than absorbs the
latency.

---

## Finding 1 — The critical CSS paints the wrong colours (certain, happens on every load)

`index.html:17-43` inlines "critical CSS to prevent FOUC". Its colours do not
match the stylesheet it is standing in for:

| | Inline critical CSS | `style.css` (actual) |
|---|---|---|
| Light background | `#ffffff` (index.html:20) | `#f0f0f0` (`--bg-color`, style.css:197) |
| Dark background | `#121212` (index.html:24) | `#2b2b2b` (`--bg-color`, style.css:279) |

So the guaranteed sequence on *every* load is: paint `#ffffff` (or `#121212`),
then repaint `#f0f0f0` (or `#2b2b2b`) when `style.css` lands. `#121212 → #2b2b2b`
is a clearly visible step in dark mode.

On a fast machine that window is a few milliseconds and invisible. Behind a
proxy that adds 300–3000 ms to the `style.css` fetch, it is a long white (or
near-black) hold followed by everything appearing at once — which is exactly
what "flash of unstyled content" looks like to a user.

`<meta name="theme-color" content="#f0f0f0">` (index.html:51) is also hardcoded
to the light value and never updated for dark mode, so the PWA title bar is the
wrong colour in dark mode too.

**This one is environment-independent and cheap to fix.**

## Finding 2 — The one element visible during the gap is the one with no critical styles

`#app-container` is deliberately `visibility: hidden` in the critical CSS
(index.html:41) until `style.css` sets it visible (style.css:24). But the
disclaimer modal is *outside* `#app-container` and is `display: block` straight
from the markup (index.html:1026).

The critical CSS covers `.modal` (the fixed full-screen scrim) but **not**
`.modal-content` (style.css:584) — the white card, padding, border-radius,
`max-width: 600px`, centring. All of that is `var()`-driven and external.

So during the gap the user sees the full disclaimer text sprawled edge-to-edge in
default serif over a grey scrim, on an otherwise blank page, which then snaps
into a centred card. That *is* the flash they are describing, and it is the first
thing they see on every cold load because the disclaimer gates the app.

## Finding 3 — The service worker is network-first for assets it has already precached

`sw.js` precaches the whole shell (`sw.js:3-18`) and then routes **every** GET
through `networkFirst()` (sw.js:88-95), with a 5-second timeout (sw.js:2).

That means on a machine that has already installed the app, `style.css` is
*still* fetched from the network on every load, and only falls back to the
perfectly good cached copy after up to 5 seconds. Behind a slow or flaky
intercepting proxy this converts an instant local read into a multi-second stall
— directly widening the FOUC window described in Findings 1 and 2.

Network-first is the right policy for the navigation request (so users get new
clinical content). It is the wrong policy for versioned shell assets, which is
what `CACHE_NAME = 'withdrawal-app-cache-v24'` already exists to manage.

## Finding 4 — The service worker will cache a proxy block page as `style.css`

```js
if (response && response.status === 200) {
    cache.put(request, response.clone());
}
```
(sw.js:65-67)

The only check is `status === 200`. Enterprise web filters commonly answer with
**HTTP 200 and an HTML body** — a block notice, a "your session has expired"
login interstitial, or a category-warning interstitial. If that happens once for
`style.css`, the service worker stores the HTML block page under the `style.css`
key. From then on the app is unstyled on that machine *even offline*, until the
cache version is bumped.

The same hazard applies to `script.js` and the `data/*.js` modules, where the
result is a silently broken app rather than an ugly one.

This is the most plausible explanation for the problem being **sticky** on
particular NSW Health machines rather than intermittent.

## Finding 5 — A wrong `Content-Type` from the filter silently disables the stylesheet

GitHub Pages serves `X-Content-Type-Options: nosniff`. With `nosniff` set,
Chrome and Edge **refuse to apply a stylesheet** that does not arrive as
`text/css`. Some intercepting proxies rewrite `Content-Type` (to `text/plain`,
or `text/html` for an interstitial) on assets they inspect or challenge.

The result is a page that renders promptly and completely unstyled, with only a
console warning. Combined with Finding 2, the app also stays *invisible* —
`#app-container` never becomes visible, so the user gets a bare disclaimer and
then nothing.

## Finding 6 — No cache-busting on `style.css` / `script.js`

`<link rel="stylesheet" href="style.css">` (index.html:44) and
`<script type="module" src="script.js">` carry no version query. The service
worker cache is versioned, but the URLs are not.

Corporate caching proxies key on URL. A NSW Health proxy that has cached an
older `style.css` can serve it against a freshly deployed `index.html`, giving
selectors that no longer match the markup — which reads as "half-unstyled". This
is a class of bug that can *only* appear on a caching-proxy network, which fits
the "only on NSW Health computers" report.

## Finding 7 — The whole visual design depends on CSS custom properties

`style.css` uses `var(--…)` in 46 places, plus `clamp()` (style.css:38),
`:focus-visible` (style.css:256) and flexbox `gap` in 16 places.

If any of these workstations render the site in **IE mode** or a very old Edge —
still not unheard of in an NSW Health SOE, and often forced by site-list policy —
custom properties do not resolve. Because an unresolvable `var()` makes the whole
declaration invalid, `.big-button { background-color: var(--primary-btn-bg);
color: white; }` (style.css:230-234) degrades to **white text on a transparent
background**, i.e. the home screen's six main buttons become invisible labels on
a white page. That is a much more dramatic "unstyled" than a colour flash, and
worth ruling out explicitly.

`<script type="module">` also does not run at all in IE mode, so the disclaimer
would never dismiss — if that is what users see, this finding is the whole story.

## Finding 8 — `visibility: hidden` turns a CSS failure into a blank app

Hiding `#app-container` until the stylesheet loads (index.html:41 /
style.css:24) trades a brief flash for a *total* blackout whenever `style.css`
is slow, and a permanent one whenever it fails (Findings 4, 5, 7). On a network
where the stylesheet is unreliable, this defence costs more than it saves.

## Minor, found along the way

- **Theme toggle label is wrong on load.** The button text is only set inside the
  click handler (script.js:63-73). A user who saved dark mode reloads to a dark
  page with a button that still reads "🌙 Dark Mode".
- **`fetchWithTimeout` does not cancel the losing fetch** (sw.js:48-55). After a
  timeout the request keeps running and its response is discarded rather than
  cached, so a slow-but-successful fetch never warms the cache. An `AbortController`
  would both cancel it and let a late response still be stored.

---

## Why I can't confirm which of these is dominant from here

Findings 1, 2, 3, 4, 6 and 8 are all readable from the code and all real. Which
one actually dominates on a NSW Health terminal depends on what their web filter
does to `sudtoolkit.org`, and I have no way to reach that network from here
(outbound requests to the live site are blocked from this environment).

The fastest way to settle it is Option D below — devtools are usually disabled by
policy on a SOE, so the page needs to report on itself.

---

## Options

### A. Inline the entire stylesheet into `index.html` — *recommended*

`style.css` is 13.7 KB. Inlining it removes the second round trip entirely, which
structurally eliminates Findings 1, 2, 3, 5 and 6 in one move: there is no
separate CSS request for the proxy to stall, mis-type, block, or serve stale, and
no gap in which anything can paint unstyled.

- Cost: `index.html` grows from 75 KB to ~89 KB, and CSS is no longer cached
  separately. Both are irrelevant here — the HTML is already the bulk of the
  payload and the service worker precaches it anyway.
- Keeping it maintainable: leave `style.css` as the source of truth and add a
  small build step (`tools/build-css.py`, mirroring the existing
  `tools/build-icon.py`) that injects it between marker comments, wired into CI
  so the inlined copy can't drift.

### B. Just make the critical CSS honest — smallest possible change

Keep the current architecture; fix what it says:

- Match the real background colours (`#f0f0f0` / `#2b2b2b`).
- Declare the `:root` and `[data-theme="dark"]` custom property blocks inline, so
  a late or failed `style.css` still yields correct colours.
- Add critical styles for `.modal-content` so the disclaimer is a card from first
  paint.
- Update `<meta name="theme-color">` for dark mode from the inline theme script.

This kills the visible flash (Findings 1 and 2) with no build step, but leaves
the app exposed to Findings 3–6.

### C. Fix the service worker — worth doing under any of the above

1. **Cache-first for precached shell assets**, network-first only for navigations.
   Repeat visits then style instantly and are immune to proxy latency (Finding 3).
2. **Validate before caching**: require a same-origin `basic` response *and* a
   `Content-Type` consistent with the request destination, so an HTML block page
   can never be stored as `style.css` (Finding 4).
3. **`cache: 'reload'` on the install fetch**, so `addAll` cannot precache the
   corporate proxy's stale copy (Finding 6).
4. Use `AbortController` in `fetchWithTimeout` (minor, above).

### D. Ship a self-diagnosing `?diag` panel — IMPLEMENTED, see below

Now built (index.html, before `</body>`). A panel activated by `?diag` that
reports from the affected machine:

- whether `style.css` appears in `document.styleSheets`, and its `cssRules.length`
  (0 or a thrown error ⇒ blocked by MIME/`nosniff` — Finding 5)
- `getComputedStyle(document.body).backgroundColor` (⇒ Finding 1 vs 7)
- `getComputedStyle(document.documentElement).getPropertyValue('--bg-color')`
  (empty ⇒ custom properties unsupported — Finding 7)
- the `PerformanceResourceTiming` entry for `style.css`: `duration`,
  `transferSize`, `responseStatus` (⇒ Findings 3, 5, 6)
- `navigator.serviceWorker.controller` state and the active cache name, plus the
  first 100 bytes of the cached `style.css` (⇒ Finding 4, cache poisoning, visible
  immediately as `<!DOCTYPE html>`)
- `navigator.userAgent` (⇒ Finding 7, IE mode)

A clinician can open `sudtoolkit.org/?diag` on an affected terminal and send a
screenshot. That turns the ranked list above into a single confirmed cause.

#### How to use it

1. On an affected NSW Health terminal, open **https://sudtoolkit.org/?diag**
2. A white panel covers the screen. Press **Copy report**, or screenshot it.
3. Send it back.

If the panel does not appear, press **Ctrl+F5** — the service worker may have
served an older cached `index.html`. Needing the hard refresh is itself evidence
for Finding 3.

The panel is dormant without `?diag`, so normal users never see it.

#### Verified behaviour

Exercised in headless Chromium against a local server that impersonates a
corporate filter (200 + HTML block page for `style.css`, with `nosniff` as
GitHub Pages sends it):

- **Healthy load** — reports `--bg-color: #f0f0f0`, 84 rules parsed,
  `content-type: text/css`.
- **Filtered load** — reports `--bg-color: (EMPTY)`, `rule count: UNREADABLE
  (SecurityError)`, `#app-container visibility: hidden`, and
  `*** The network returned HTML, not CSS ***`. Chromium logs *"Refused to apply
  style … strict MIME checking is enabled"*, confirming **Finding 5** is a real
  mechanism and **Finding 8** turns it into a blank app.
- **Filtered load, second visit** — the service worker has stored the block page
  under the `style.css` key and the panel prints `*** POISONED CACHE - HTML is
  stored where CSS should be ***`. **Finding 4 is reachable in practice, not just
  in theory.**
- Without `?diag`: no panel, no console errors, disclaimer and navigation
  unaffected; `npm test` 27/27.

#### Do not bump `CACHE_NAME` when deploying this

Changing the service worker version wipes the cache — including the poisoned
`style.css` entry the panel is trying to find. Ship the panel on the current
`v24` first, read the result, *then* bump as part of the fix.

### E. Defensive fallback (cheap, do it regardless)

Add `onerror` to the stylesheet `<link>` that reveals `#app-container` and applies
a minimal safe theme, so a stylesheet failure degrades to "plain but usable"
rather than "blank page with a sprawling disclaimer" (Finding 8). For a clinical
tool, usable-and-ugly is the correct failure mode.

### F. Rule out IE mode first if the disclaimer never dismisses

If affected users report the **Accept and Continue** button doing nothing, stop
here — that is Finding 7, the fix is a browser/site-list policy change with NSW
Health IT, and none of the CSS work above will help.

---

## Suggested order

1. **D** — get ground truth from an affected terminal (one deploy, no risk).
2. **A** + **E** — structurally remove the FOUC window and make failure graceful.
3. **C** — stop the service worker amplifying and persisting proxy failures.

**B** is the fallback if a build step is unwanted; it fixes the flash you can see
but not the reasons it is worse on their network.
