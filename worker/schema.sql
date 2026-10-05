-- Usage telemetry for sudtoolkit.org.
--
-- One row per event. There is no user table and no join: a device_id is a
-- random identifier the app mints on first launch and nothing here can be
-- resolved back to a person. That is the whole point — see worker/README.md.
--
-- Nothing a clinician typed is ever stored. `detail` names *which* feature was
-- used (a scale id, a page id), never what was entered into it, and the worker
-- rejects any detail that is not on its allow-list.

CREATE TABLE IF NOT EXISTS events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Client-generated, unique. The app may send the same event twice — a
    -- flush that succeeded on the server but died before the app saw the
    -- response is the ordinary case, not an edge one. UNIQUE plus
    -- INSERT OR IGNORE makes that resend a no-op instead of a double count,
    -- which is the difference between a usable denominator and a guess.
    eid          TEXT NOT NULL UNIQUE,

    -- Server clock, authoritative for ordering. Client clocks on ward devices
    -- are wrong often enough that occurred_at alone cannot be trusted, but it
    -- is kept because it is the only record of *when the clinician acted* for
    -- an event that sat in the offline queue for two days before sending.
    received_at  TEXT NOT NULL,
    occurred_at  TEXT NOT NULL,

    device_id    TEXT NOT NULL,

    -- The study's two grouping variables, chosen by the clinician at each
    -- launch rather than derived from a credential: the password is shared
    -- across the district and says nothing about who or where. Both are
    -- self-reported, which is a limitation to state in the write-up, not a
    -- flaw to hide.
    role         TEXT NOT NULL,
    location     TEXT NOT NULL,

    event        TEXT NOT NULL,
    detail       TEXT,

    app_version  TEXT NOT NULL,

    -- 1 when launched from a home-screen icon rather than a browser tab. PWA
    -- install uptake is a real adoption measure for a ward tool.
    standalone   INTEGER NOT NULL DEFAULT 0,

    -- 1 when the event was recorded with no connection and flushed later.
    -- The online/offline split is a finding, not plumbing: it is the only
    -- evidence that the offline-first design is doing anything.
    queued       INTEGER NOT NULL DEFAULT 0
);

-- The questions the study actually asks: how much use over time, how much by
-- role, how much by setting, and how much per device (return rate).
CREATE INDEX IF NOT EXISTS idx_events_received ON events (received_at);
CREATE INDEX IF NOT EXISTS idx_events_role     ON events (role, received_at);
CREATE INDEX IF NOT EXISTS idx_events_location ON events (location, received_at);
CREATE INDEX IF NOT EXISTS idx_events_device   ON events (device_id, received_at);

-- ---------------------------------------------------------------------------
-- Feedback, survey answers and app errors (0.6.0).
--
-- Added after the events table was live, so every statement is IF NOT EXISTS:
-- re-running this whole file against the existing database adds these tables
-- and leaves `events` exactly as it is.
--
-- Unlike `events`, `feedback.message` is free text a clinician typed. The form
-- tells them not to include patient details, but this table must be treated as
-- if it might hold some: it is read only through the password-protected admin
-- page and its exports, and it is covered by the same retention promise as the
-- rest of the database.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS feedback (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    rid          TEXT NOT NULL UNIQUE,   -- client uuid, so a resend is a no-op
    received_at  TEXT NOT NULL,
    occurred_at  TEXT NOT NULL,
    device_id    TEXT NOT NULL,
    role         TEXT NOT NULL,
    location     TEXT NOT NULL,
    app_version  TEXT NOT NULL,

    page         TEXT NOT NULL,          -- page id, or page/tab, e.g. scales-page/ciwa-ar
    category     TEXT NOT NULL,          -- error | unclear | suggestion | praise
    helpful      TEXT,                   -- yes | no, if they also tapped a thumb
    message      TEXT NOT NULL,          -- what they typed, at most 1000 characters

    -- The author's working state, changed from the admin page.
    status       TEXT NOT NULL DEFAULT 'new',  -- new | actioned | wontfix
    status_at    TEXT,

    -- Set once the item has gone out in a daily email. NULL means the next
    -- 9am email will include it.
    emailed_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_status   ON feedback (status, occurred_at);
CREATE INDEX IF NOT EXISTS idx_feedback_emailed  ON feedback (emailed_at);
CREATE INDEX IF NOT EXISTS idx_feedback_device   ON feedback (device_id, received_at);

-- One row per completed System Usability Scale survey (Brooke 1996), plus the
-- app's own question about whether it changed management. q1..q10 are the
-- raw 1-5 answers in the standard item order; `sus` is the 0-100 score,
-- computed by the worker so it cannot disagree with the answers.
CREATE TABLE IF NOT EXISTS survey_responses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    rid          TEXT NOT NULL UNIQUE,
    received_at  TEXT NOT NULL,
    occurred_at  TEXT NOT NULL,
    device_id    TEXT NOT NULL,
    role         TEXT NOT NULL,
    location     TEXT NOT NULL,
    app_version  TEXT NOT NULL,
    q1 INTEGER NOT NULL, q2 INTEGER NOT NULL, q3 INTEGER NOT NULL, q4 INTEGER NOT NULL,
    q5 INTEGER NOT NULL, q6 INTEGER NOT NULL, q7 INTEGER NOT NULL, q8 INTEGER NOT NULL,
    q9 INTEGER NOT NULL, q10 INTEGER NOT NULL,
    changed      TEXT,                   -- yes | no | unsure
    sus          REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_survey_occurred ON survey_responses (occurred_at);
CREATE INDEX IF NOT EXISTS idx_survey_device   ON survey_responses (device_id, received_at);

-- JavaScript errors the app hit, reported automatically. The message is
-- scrubbed of long numbers and email addresses on the device and again here,
-- because an error can quote a value that came from an input.
CREATE TABLE IF NOT EXISTS app_errors (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    rid          TEXT NOT NULL UNIQUE,
    received_at  TEXT NOT NULL,
    occurred_at  TEXT NOT NULL,
    device_id    TEXT NOT NULL,
    role         TEXT NOT NULL,
    location     TEXT NOT NULL,
    app_version  TEXT NOT NULL,
    page         TEXT,
    message      TEXT NOT NULL,
    source       TEXT,                   -- file:line:column
    platform     TEXT NOT NULL           -- ios | android | windows | mac | linux | other
);

CREATE INDEX IF NOT EXISTS idx_errors_occurred ON app_errors (occurred_at);
CREATE INDEX IF NOT EXISTS idx_errors_device   ON app_errors (device_id, received_at);
