# Password gate (Cloudflare Worker)

A single shared password in front of `sudtoolkit.org`, enforced at Cloudflare's
edge by `worker/gate.js`. The site itself is unchanged — the Worker either
passes a request through to GitHub Pages untouched, or answers it with a login
page instead.

## Why a Worker rather than Zero Trust

Cloudflare Access authenticates *people*: email one-time PIN, or an identity
provider. There is no shared-password login anywhere in Zero Trust, and no
dashboard setting that turns a stored secret into a login prompt — a secret is
only encrypted storage, and something has to read it and decide. That something
is this Worker.

If a per-clinician login with an audit trail is ever wanted instead, Access with
One-time PIN does that with no code, and this Worker should be removed rather
than stacked underneath it.

## Relationship to the in-app access code

`access.js` already asks for a password, and this Worker is a **second,
separate** layer rather than a replacement. They are not interchangeable:

| | `access.js` | `worker-gate/gate.js` |
| --- | --- | --- |
| Runs | in the browser, after the files load | at Cloudflare's edge, before they load |
| Password lives | as a SHA-256 hash in `data/access-config.js`, shipped to every visitor | as a Worker secret, never sent to the browser |
| Stops | the app being *used* | the app being *served* |
| Works offline | yes — that is the point of storing the unlock flag | no, and does not need to |
| Knows about roles, locations, the `unlock` event | yes | no |

The in-app gate cannot keep anyone from reading the content: the files are
already on the device by the time it asks, and the password's hash is in them.
That is a reasonable trade for something that must work offline on a ward
phone, and it is what makes the edge gate a complement rather than a duplicate
— the edge gate is the one that stops an anonymous visitor obtaining the files
at all.

**Running both means two prompts on a new device** — Cloudflare's, then the
app's — even if the password is the same in each. Before deploying this, decide
which of the following is wanted:

- **Both.** Strongest, and the app's role/location/telemetry flow is untouched.
  Costs a second prompt at first install only; installed devices see neither.
- **Edge gate only.** One prompt, but `access.js` also collects role and
  location and emits the `unlock` event the study depends on, so removing it
  means reworking that flow. Not a small change.
- **In-app gate only.** What `main` does today. Leave this Worker undeployed;
  the code can stay in the tree unused.

Nothing in the app needs to change either way — the Worker is transparent to a
request that carries a valid session cookie.

## Prerequisites

1. `sudtoolkit.org` uses Cloudflare nameservers.
2. The DNS records for the apex (and `www`, if used) are **proxied** — the
   orange cloud. A Worker route only sees traffic that passes through
   Cloudflare; a DNS-only record bypasses the gate entirely.
3. SSL/TLS mode is **Full**. Turn the proxy on only *after* GitHub has issued
   the Pages certificate, or GitHub's renewal check fails and HTTPS breaks.

## Setup

```sh
cd worker-gate
npx wrangler login

# The password clinicians will type. Choose a long one — see "No rate limiting".
npx wrangler secret put SITE_PASSWORD

# An unrelated random value that signs session cookies. Never share it, and
# never reuse SITE_PASSWORD here.
npx wrangler secret put GATE_SIGNING_SECRET   # e.g. `openssl rand -base64 32`

npx wrangler deploy
```

Both secrets are set with `wrangler secret put`, not in `wrangler.toml` —
that file is in git.

Note the directory: `worker-gate/`, not `worker/`. `worker/` is the telemetry
endpoint, a different Worker with its own secrets and its own deploy. A
`wrangler.toml` describes exactly one Worker, which is why they are separate
directories.

To change the password later, run `wrangler secret put SITE_PASSWORD` again.
Existing sessions survive that, because they are signed with the *other*
secret; rotating `GATE_SIGNING_SECRET` is what logs everyone out.

`/__gate/logout` clears the current device's session.

## What this actually protects

**The GitHub Pages origin is still public.** The same files are served at
`trent-koessler.github.io/withdrawal_app/`, and that URL never touches
Cloudflare, so the gate does not apply to it. There is no way to IP-restrict a
Pages origin. On the current hosting the password is a barrier to casual
discovery, not access control.

Closing that hole means moving hosting to **Cloudflare Pages** (same repo,
empty build command, output directory `/`), so the origin is Cloudflare and
there is no second address.

**The service worker means the gate is a front door, not a turnstile.** `sw.js`
is cache-first from the snapshot it installed, so an already-installed device
serves the entire app from its own cache and never reaches the edge. The
password gates first load and updates. Two consequences:

- A clinician mid-shift is never bounced to a login screen, including offline.
  This is the intended behaviour for a ward phone.
- Changing the password does not evict anyone who already has a copy installed.
  They keep the version they have until their next update, which requires a
  fresh login.

An expired session cannot corrupt the offline snapshot: the login page is
served as `401`, and `precache()` in `sw.js` rejects any non-OK response, so
those files are skipped rather than stored under the name of `script.js`.

## Deliberate limitations

**No rate limiting.** Counting attempts needs KV or a Durable Object. The
Worker instead sleeps 500 ms on every failure, which makes scripted guessing
slow but not impossible. A long, non-guessable password is doing the real work
here; a short one is not protected by anything.

**Fails closed.** With either secret missing the Worker returns `503` rather
than serving the site unauthenticated — a gate that silently stops gating is
worse than an outage, and installed devices keep working from cache regardless.

**No CSRF token on the login form.** A forged cross-site POST could only log
someone *in*, which is not an attack. The session cookie is `SameSite=Lax`.

## Tests

`test/gate.test.js` covers the parts that can be got wrong invisibly — forged
and expired cookies, extended expiries, cookie-name prefix matches, open
redirects, and the constant-time password comparison. They run in the normal
suite:

```sh
npm test
```
