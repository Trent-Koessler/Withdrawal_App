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
