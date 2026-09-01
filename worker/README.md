# Usage telemetry endpoint

A single Cloudflare Worker that receives usage events from sudtoolkit.org and
writes them to a D1 database.

**The app's hosting does not move.** GitHub Pages keeps serving the app exactly
as it does now. This is a separate, small thing at its own hostname, and the app
talks to it over the network like any other API.

Everything here is inside Cloudflare's free tier: 100,000 worker requests a day
and 100,000 database writes a day. A 500-clinician rollout produces a few
thousand events a day at most, and the free tier has no per-user seat to buy —
which is the whole reason this is a Worker and not Cloudflare Access. Unlike a free Supabase project, a Worker and its
D1 database are never paused for inactivity — a quiet fortnight over Christmas
does not create a hole in the dataset.

## What is collected

One row per event:

| Column | What it is |
| --- | --- |
| `eid` | Random per-event id. Exists so a resend cannot double-count. |
| `received_at` | Server clock. Authoritative for ordering. |
| `occurred_at` | Client clock, sanity-bounded. When the clinician actually acted. |
| `device_id` | Random per-install id. Not derived from anything about the device or person. |
| `role` | What the clinician selected, e.g. `registrar`. |
| `location` | Where they said they were working, e.g. `ed`. |
| `event` | `unlock`, `session`, `page_view`, `scale_complete`, `emr_copy`. |
| `detail` | Which page or scale, e.g. `ciwa-ar`. Never free text. |
| `app_version` | Which release produced it. |
| `standalone` | 1 if launched from a home-screen icon. PWA install uptake. |
| `queued` | 1 if recorded offline and sent later. |

**Not collected, by construction:** IP addresses, user agents, names, emails,
any score, any patient detail, anything typed into a calculator. The worker
enforces an allow-list on both `event` and `detail` and drops anything else, so
widening what is collected takes a deliberate change in two files.

`device_id` is pseudonymous, not anonymous — it distinguishes repeat use by one
device from ten separate clinicians, which is the difference between "40
sessions" and "40 sessions across 4 devices". It cannot be resolved back to a
person, but it is still a persistent identifier and the ethics application
should say so plainly.

`role` and `location` are **self-reported and re-asked every launch**. The
password is shared across the district, so it says nothing about who or where —
these two fields are the only grouping variables the study has, and they are
whatever the clinician selected at that launch. State that as a limitation
rather than presenting them as verified attributes.

## Setting it up

**Where you run this: your own computer, not a Claude session.** `wrangler login`
opens a browser and signs you into your Cloudflare account, which only you can
do. Everything below is a one-off — about fifteen minutes, once.

You need [Node.js](https://nodejs.org) 20 or later (`node --version` to check)
and a free Cloudflare account. Then clone this repo and:

```sh
cd worker
npm install          # installs wrangler, pinned in package.json
npm run login        # opens a browser; approve the access request
```

Everything after this is an npm script, so there is no wrangler syntax to
remember and no chance of a version change under you.

**1. Create the database.**

```sh
npm run db:create
```

It prints a block ending in `database_id = "..."`. Copy that id into
`wrangler.toml`, replacing `PASTE_DATABASE_ID_HERE`.

**2. Create the table.**

```sh
npm run db:init
```

**3. Set the export password.** This is what you will use to download the data
later. Make it long and random — a password manager's generator is ideal — and
save it somewhere you will still have in a year.

```sh
npm run secret
```

It prompts for the value and does not echo it. A secret rather than a
`[vars]` entry, so it is not committed here and cannot be read back from the
dashboard.

**4. Deploy.**

```sh
npm run deploy
```

This prints a URL like `https://sudtoolkit-metrics.<your-subdomain>.workers.dev`.
Check it answers:

```sh
curl https://sudtoolkit-metrics.<your-subdomain>.workers.dev/health
```

Expect `ok`. If you get anything else, stop here — the app has nothing to talk
to yet, which is harmless, but there is no point continuing until this works.

**5. Point the app at it.** In `../metrics.js`, set `ENDPOINT` to that URL plus
`/e`:

```js
const ENDPOINT = 'https://sudtoolkit-metrics.<your-subdomain>.workers.dev/e';
```

Then bump the app version and release as usual.

**This step is the moment collection starts.** Until `ENDPOINT` is set the app
records nothing at all — not even locally — so the password gate and the
role/location questions can go live first, and the ethics approval can land
before any data exists.

**6. Confirm it is working.** Open sudtoolkit.org, go through the gate, use a
calculator, then:

```sh
npm run count
```

You should see a handful of rows. If it says zero, see *When nothing arrives*
below.

### Optional: a tidier hostname

If sudtoolkit.org's DNS is on Cloudflare you can put this on
`metrics.sudtoolkit.org` instead, which reads better in the ethics application
and survives changing your workers.dev subdomain. Add to `wrangler.toml`:

```toml
route = { pattern = "metrics.sudtoolkit.org/*", custom_domain = true }
```

If DNS is elsewhere, the `workers.dev` URL is fine and changes nothing about how
it works.

## Getting the data out

Three ways in, depending on what you are doing.

### The dashboard — no command line at all

This is the one to use for a quick look, and the only one that needs nothing
installed. At [dash.cloudflare.com](https://dash.cloudflare.com), open
**Storage & Databases → D1 → sudtoolkit-metrics → Console**, and run SQL
straight in the browser. Results come back as a table you can read or copy.

Good for "how is it going" checks from any machine, including one where you
cannot install Node.

### The whole dataset as a CSV — for analysis

```sh
export SUDTOOLKIT_METRICS_URL='https://sudtoolkit-metrics.<your-subdomain>.workers.dev'
export SUDTOOLKIT_EXPORT_TOKEN='the token from step 3'
./tools/fetch-metrics.sh events.csv
```

Opens directly in Excel, SPSS, R or Stata.

**Use this rather than a plain `curl` of `/export.csv`.** The endpoint pages at
10,000 rows, so a bare curl gives you a truncated file that looks complete —
a study that silently under-reports is a much worse failure than one that
errors. The script follows the cursor to the end and stitches the pages into
one file, printing each page as it goes so you can see the row count.

On Windows, run it from Git Bash or WSL, or use the dashboard route above.

### Ad-hoc queries from the command line

```sh
cd worker
npm run summary    # who is using it, and where
npm run count      # row count, device count, date range
```

For anything else:

```sh
npx wrangler d1 execute sudtoolkit-metrics --remote --command "SELECT ..."
```

`--remote` matters: without it you query an empty local copy and conclude
nothing is being collected.

## Queries the study will want

Paste any of these into the dashboard Console, or into
`wrangler d1 execute --remote --command`.

```sql
-- Who is using it, and where.
SELECT role, location, COUNT(DISTINCT device_id) devices, COUNT(*) events
  FROM events GROUP BY role, location ORDER BY events DESC;

-- Uptake over time.
SELECT substr(received_at, 1, 10) day, COUNT(DISTINCT device_id) devices
  FROM events GROUP BY day ORDER BY day;

-- Return rate: devices that came back on more than one day.
SELECT role,
       COUNT(*) FILTER (WHERE days > 1) returning,
       COUNT(*) total
  FROM (SELECT role, device_id, COUNT(DISTINCT substr(received_at, 1, 10)) days
          FROM events GROUP BY role, device_id)
 GROUP BY role;

-- Utility: which scales actually get used to score a patient.
SELECT detail scale, COUNT(*) uses, COUNT(DISTINCT device_id) devices
  FROM events WHERE event = 'scale_complete' GROUP BY detail ORDER BY uses DESC;

-- Did it reach the record? Copies per scoring.
SELECT SUM(event = 'emr_copy') copies, SUM(event = 'scale_complete') scorings
  FROM events;

-- Offline share — the justification for the offline-first design.
SELECT ROUND(100.0 * SUM(queued) / COUNT(*), 1) pct_offline FROM events;

-- PWA install uptake: home-screen icon versus browser tab.
SELECT ROUND(100.0 * SUM(standalone) / COUNT(*), 1) pct_installed FROM events;

-- Usability signal: scales pages opened without a score being produced.
SELECT COUNT(*) FILTER (WHERE event = 'page_view' AND detail = 'scales-page') opens,
       COUNT(*) FILTER (WHERE event = 'scale_complete') scorings
  FROM events;
```

## When nothing arrives

In rough order of likelihood:

1. **`ENDPOINT` is still empty in `metrics.js`,** or the release carrying it has
   not shipped. Check the deployed `metrics.js` in the browser, not your local
   copy.
2. **A device is still serving an older release.** The service worker is
   cache-first (see IMPLEMENTATION_NOTES §1.7), so a device that installed
   before this release keeps serving it until `sw.js` changes. Hard-reload, or
   check `app_version` in the data.
3. **You queried the local database.** `wrangler d1 execute` without `--remote`
   reads an empty local copy.
4. **The origin is wrong.** The worker only accepts requests from
   sudtoolkit.org. Testing from `localhost` or a `github.io` preview is refused
   with a 403 unless that origin is in `ALLOWED_ORIGINS`.
5. **A hospital proxy is blocking the workers.dev hostname.** Events queue on
   the device rather than being lost, so they arrive if the app is later opened
   somewhere the endpoint is reachable. This is worth testing on a ward device
   early — it is the one failure that looks like "nobody is using it".

`npx wrangler tail` (or `npm run tail`) streams live requests to the worker,
which settles quickly whether anything is arriving at all.

## Changing the password

```sh
python3 tools/set-password.py 'NEWPASSWORD' --write
```

Then release the app. Note what this does *not* do: devices already unlocked are
not re-prompted, because the unlock flag is stored, not the password. Changing
it locks out new devices only. To force everyone to re-enter it you would have
to change the storage key in `access.js` as well.

## Adding a role or a location mid-study

1. Add the entry to `ROLES` or `CONSULT_LOCATIONS` in `data/access-config.js`.
2. Add the same id to `ALLOWED_ROLES` or `ALLOWED_LOCATIONS` in
   `worker/src/index.js`, and `npx wrangler deploy`.
3. Release the app.

`test/access.test.js` asserts the two lists match exactly, so a half-done change
fails the suite rather than reaching production. Do steps 2 and 3 in that order:
a device sending an id the worker does not know yet gets a 403, and the app
discards that batch rather than retrying forever.

Never rename or remove an id that has been in use — that splits or orphans the
data behind it. Add a new one and leave the old in place.

## Abuse

The endpoint is public — the URL ships inside the app, so anyone can find it.
It only accepts requests carrying an `Origin` of sudtoolkit.org, only accepts
known role and location ids, caps the body at 64 KB and the batch at 100 events,
and writes nothing it was not explicitly told to expect.

None of that stops someone determined from inserting plausible-looking rows.
The realistic protections are that there is nothing here worth stealing or
corrupting, and that Cloudflare's free rate limiting can be pointed at
`/e` from the dashboard if it ever becomes a problem. Worth knowing before you
describe the data as tamper-proof to anyone — it is honest usage data, not an
audit log.
