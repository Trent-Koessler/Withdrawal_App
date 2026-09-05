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

**3. Set the export password.** Any long random string; you will need it to
download the data.

```sh
npx wrangler secret put EXPORT_TOKEN
```

A secret rather than a `[vars]` entry, so it is not committed here and not
readable from the dashboard.

**4. Deploy.**

```sh
npx wrangler deploy
```

This prints a URL like `https://sudtoolkit-metrics.<your-subdomain>.workers.dev`.
Check it:

```sh
curl https://sudtoolkit-metrics.<your-subdomain>.workers.dev/health
```

**5. Point the app at it.** Set `ENDPOINT` in `../metrics.js` to that URL plus
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
  "SELECT role, location, COUNT(*) events
     FROM events GROUP BY role, location ORDER BY events DESC"
```

Some queries the study will want:

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

-- Usability signal: scales pages opened without a score being produced.
SELECT COUNT(*) FILTER (WHERE event = 'page_view' AND detail = 'scales-page') opens,
       COUNT(*) FILTER (WHERE event = 'scale_complete') scorings
  FROM events;
```

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
