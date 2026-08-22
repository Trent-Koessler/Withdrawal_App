# Usage telemetry endpoint

A single Cloudflare Worker that receives usage events from sudtoolkit.org and
writes them to a D1 database.

**The app's hosting does not move.** GitHub Pages keeps serving the app exactly
as it does now. This is a separate, small thing at its own hostname, and the app
talks to it over the network like any other API.

Everything here is inside Cloudflare's free tier: 100,000 worker requests a day
and 100,000 database writes a day. A 500-clinician rollout produces a few
thousand events a day at most. Unlike a free Supabase project, a Worker and its
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
| `cohort` | The site code's id, e.g. `dubbo-ed`. |
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

## Deploying it

You need a free Cloudflare account. Run everything from this directory.

**1. Create the database.**

```sh
npx wrangler d1 create sudtoolkit-metrics
```

Paste the `database_id` it prints into `wrangler.toml`.

**2. Create the table.**

```sh
npx wrangler d1 execute sudtoolkit-metrics --remote --file=./schema.sql
```

**3. Set the cohort allow-list.** Use the ids that
`tools/make-cohort-codes.py` printed — they must match `data/cohorts.js`. Edit
the `COHORTS` line in `wrangler.toml`:

```toml
COHORTS = "pilot,dubbo-ed,dubbo-ward,bathurst-ed,orange-dapl"
```

An empty list makes the endpoint return 503 for everything. That is deliberate:
an endpoint that accepts any cohort id fills the dataset with junk that looks
real.

**4. Set the export password.** Any long random string; you will need it to
download the data.

```sh
npx wrangler secret put EXPORT_TOKEN
```

A secret rather than a `[vars]` entry, so it is not committed here and not
readable from the dashboard.

**5. Deploy.**

```sh
npx wrangler deploy
```

This prints a URL like `https://sudtoolkit-metrics.<your-subdomain>.workers.dev`.
Check it:

```sh
curl https://sudtoolkit-metrics.<your-subdomain>.workers.dev/health
```

**6. Point the app at it.** Set `ENDPOINT` in `../metrics.js` to that URL plus
`/e`, then bump the app version and release as usual:

```js
const ENDPOINT = 'https://sudtoolkit-metrics.<your-subdomain>.workers.dev/e';
```

Until this is set, the app collects nothing. The access-code gate works either
way, so the gate can go live before collection does.

### Optional: a tidier hostname

If sudtoolkit.org's DNS is on Cloudflare you can put this on
`metrics.sudtoolkit.org` instead, which reads better in the ethics application
and survives changing your workers.dev subdomain. Add to `wrangler.toml`:

```toml
route = { pattern = "metrics.sudtoolkit.org/*", custom_domain = true }
```

If DNS is elsewhere, the `workers.dev` URL is fine and changes nothing about
how it works.

## Getting the data out

```sh
curl -H "Authorization: Bearer $EXPORT_TOKEN" \
  "https://sudtoolkit-metrics.<your-subdomain>.workers.dev/export.csv" \
  -o events.csv
```

Opens directly in Excel, SPSS or R. Default page is 10,000 rows; the response
carries `X-Last-Id` and `X-More` headers, so for a larger dataset pass
`?after=<X-Last-Id>` and repeat until `X-More` is `false`.

You can also query the database directly, which is usually faster for a look:

```sh
npx wrangler d1 execute sudtoolkit-metrics --remote --command \
  "SELECT cohort, COUNT(DISTINCT device_id) devices, COUNT(*) events
     FROM events GROUP BY cohort ORDER BY events DESC"
```

Some queries the study will want:

```sql
-- Activation: which sites ever started, and which never did.
SELECT cohort, MIN(received_at) first_use, COUNT(DISTINCT device_id) devices
  FROM events WHERE event = 'unlock' GROUP BY cohort;

-- Return rate: devices that came back on more than one day.
SELECT cohort,
       COUNT(*) FILTER (WHERE days > 1) returning,
       COUNT(*) total
  FROM (SELECT cohort, device_id, COUNT(DISTINCT substr(received_at, 1, 10)) days
          FROM events GROUP BY cohort, device_id)
 GROUP BY cohort;

-- Utility: which scales actually get used to score a patient.
SELECT detail scale, COUNT(*) uses, COUNT(DISTINCT device_id) devices
  FROM events WHERE event = 'scale_complete' GROUP BY detail ORDER BY uses DESC;

-- Did it reach the record? Copies per scoring.
SELECT SUM(event = 'emr_copy') copies, SUM(event = 'scale_complete') scorings
  FROM events;

-- Offline share — the justification for the offline-first design.
SELECT ROUND(100.0 * SUM(queued) / COUNT(*), 1) pct_offline FROM events;

-- Usability signal: scales pages opened without a score being produced.
SELECT COUNT(*) FILTER (WHERE event = 'page_view' AND detail = 'scales-page') opens,
       COUNT(*) FILTER (WHERE event = 'scale_complete') scorings
  FROM events;
```

## Adding a site mid-study

1. Add the line to your sites file and re-run `tools/make-cohort-codes.py`.
   **This mints new codes for every site in the file**, so keep the file
   complete and distribute all of them, or run it on a file containing only the
   new sites and merge the output into `data/cohorts.js` by hand.
2. Add the new id to `COHORTS` in `wrangler.toml` and `npx wrangler deploy`.
3. Release the app so devices pick up the new `data/cohorts.js`.

Do steps 2 and 3 in that order. A device with a code the worker does not know
yet gets a 403, and the app discards that batch rather than retrying forever.

## Abuse

The endpoint is public — the URL ships inside the app, so anyone can find it.
It only accepts requests carrying an `Origin` of sudtoolkit.org, only accepts
known cohort ids, caps the body at 64 KB and the batch at 100 events, and
writes nothing it was not explicitly told to expect.

None of that stops someone determined from inserting plausible-looking rows.
The realistic protections are that there is nothing here worth stealing or
corrupting, and that Cloudflare's free rate limiting can be pointed at
`/e` from the dashboard if it ever becomes a problem. Worth knowing before you
describe the data as tamper-proof to anyone — it is honest usage data, not an
audit log.
