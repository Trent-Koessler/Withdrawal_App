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
| `event` | `unlock`, `session`, `page_view`, `scale_complete`, `emr_copy`, `helpful_yes`, `helpful_no`, `survey`. |
| `detail` | Which page or scale, e.g. `ciwa-ar`, or page and tab, e.g. `scales-page/ciwa-ar`. Never free text. |
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

## Feedback, the survey, error reports and the admin page (0.6.0)

Three more kinds of record arrive at `POST /r`, each in its own table:

| Table | What it holds | Sent when |
| --- | --- | --- |
| `feedback` | The page and tab, a type (error, unclear, suggestion, praise), the message (max 1000 characters), whether they also tapped 👍/👎, and the author's status (new, actioned, won't fix). | Someone presses Send on the form at the foot of a page. |
| `survey_responses` | The ten System Usability Scale answers (1-5), "has it changed how you managed a patient" (yes, no, not sure), and the 0-100 score, computed here. | Someone finishes the survey. |
| `app_errors` | The error message (long numbers and emails masked), file:line:column, page, and device type (ios, android, windows, mac, linux, other). | The app hits a JavaScript error. At most 5 per launch. |

Each carries the same `device_id`, `role`, `location` and `app_version` as the
usage events. The 👍/👎 ratings themselves are ordinary events
(`helpful_yes` / `helpful_no`, with the page as `detail`), and the survey being
offered, started, completed, put off or declined is the `survey` event.

**The feedback message is free text.** It is the first thing this endpoint
stores that a person typed. The form warns against patient details and the
privacy statement says so, but treat the table as if it might hold some: it is
read only through the admin page and its exports.

Each device can send at most 20 feedback messages, 2 surveys and 50 error
reports a day; the rest are dropped.

### Setting it up

Do these once, from this directory, after pulling 0.6.0.

**1. Add the new tables.** Safe to run on the live database: every statement is
`IF NOT EXISTS`, so `events` is untouched.

```sh
npx wrangler d1 execute sudtoolkit-metrics --remote --file=./schema.sql
```

**2. Turn on Email Routing for sudtoolkit.org** in the Cloudflare dashboard
(sudtoolkit.org → Email → Email Routing → Enable). Then, under *Destination
addresses*, add the address the daily email should go to and click the link in
the verification email Cloudflare sends. The worker can only send to a
verified address.

**3. Tell the worker that address.** A secret, so it is not committed here:

```sh
npx wrangler secret put DIGEST_TO
```

**4. Deploy.**

```sh
npx wrangler deploy
```

This publishes the admin page (`public/admin/`), the daily 9am schedule and the
email binding along with the code.

### The admin page

Open `https://metrics.sudtoolkit.org/admin/` and sign in with the
`EXPORT_TOKEN` password. Use a long one: four or five random words is easy to
type and impractical to guess, and this page is on the open internet.

- **Feedback** — every message, newest first, filterable by status, type, page,
  role, setting and date. Mark each New, Actioned or Won't fix.
- **Overview** — sessions, devices, returning devices, helpfulness by page, use
  by role and setting, sessions per week, most used pages and scales, recent
  errors.
- **Survey** — response count, average score (68 is the published average),
  average answer to each question, score by role and by month, and the
  changed-management answers.
- **Errors** — app errors grouped by message and place.

Every tab has a **Download CSV** button for the data behind it, with the
current filters applied.

The password is kept for the browser tab only (sessionStorage) and is sent as a
header, never in a URL. The page writes feedback text as plain text, never as
HTML, and is served with a Content-Security-Policy that blocks any script it did
not ship with.

### The daily email

At 9am Sydney time, if any feedback has not been emailed yet, the worker emails
it to `DIGEST_TO` with a one-line summary of the last 24 hours and a link to the
admin page. No email is sent on a day with nothing new. Feedback is marked as
emailed only after the send succeeds, so a failed send is retried the next
morning.

The schedule (`crons` in `wrangler.toml`) fires at 22:00 and 23:00 UTC, and the
worker sends only on the run that is 9am in Sydney, so it follows daylight
saving without being edited.

The email goes to whatever inbox `DIGEST_TO` is — if that is a personal account,
the message text leaves Cloudflare and lands there, which the privacy statement
says. To keep message text out of email entirely, edit `buildDigest()` in
`src/digest.js` to send only the counts.

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

## When the evaluation period ends

The privacy statement on the About page promises the data is kept only until
the trial's evaluation period ends. Keeping that promise is a manual step:

1. Set `ENDPOINT` in `../metrics.js` back to `''`, update the privacy
   statement to say collection has stopped, and release the app.
2. Take a final export (above) and store it wherever the study's ethics
   approval says research data lives.
3. Delete the database, which removes every row:

   ```sh
   npx wrangler d1 delete sudtoolkit-metrics
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
   `worker/src/vocab.js`, and its label to `worker/src/labels.js`, and
   `npx wrangler deploy`.
3. Release the app.

`test/access.test.js` and `test/feedback.test.js` assert the lists match exactly, so a half-done change
fails the suite rather than reaching production. Do steps 2 and 3 in that order:
a device sending an id the worker does not know yet gets a 403, and the app
discards that batch rather than retrying forever.

Never rename or remove an id that has been in use — that splits or orphans the
data behind it. Add a new one and leave the old in place.

## Abuse

The endpoint is public — the URL ships inside the app, so anyone can find it.
It only accepts requests carrying an `Origin` of sudtoolkit.org, only accepts
known role and location ids, caps the body at 64 KB and the batch at 100 events
(20 records on `/r`, with a daily ceiling per device), and writes nothing it was
not explicitly told to expect.

None of that stops someone determined from inserting plausible-looking rows.
The realistic protections are that there is nothing here worth stealing or
corrupting, and that Cloudflare's free rate limiting can be pointed at
`/e` and `/r` from the dashboard if it ever becomes a problem. Worth knowing before you
describe the data as tamper-proof to anyone — it is honest usage data, not an
audit log.
