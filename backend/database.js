const Database = require('better-sqlite3');
const path = require('path');

let db;

function getDb() {
    if (!db) {
        db = new Database(path.join(__dirname, 'sawaari.db'));
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        initSchema();
    }
    return db;
}

function initSchema() {
    db.exec(`
    -- ─── USERS ────────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS users (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        phone                   TEXT    UNIQUE NOT NULL,
        username                TEXT    UNIQUE,
        gender                  TEXT,
        age                     INTEGER,
        role                    TEXT    DEFAULT NULL,
        aadhaar_last4           TEXT,
        aadhaar_verified        INTEGER DEFAULT 0,
        emergency_contact_name  TEXT,
        emergency_contact_phone TEXT,
        trip_count              INTEGER DEFAULT 0,
        created_at              TEXT    DEFAULT (datetime('now'))
    );

    -- ─── OTP STORE ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS otp_store (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        phone       TEXT    NOT NULL,
        otp         TEXT    NOT NULL,
        expires_at  TEXT    NOT NULL,
        used        INTEGER DEFAULT 0,
        created_at  TEXT    DEFAULT (datetime('now'))
    );

    -- ─── VEHICLES (driver-owned) ──────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS vehicles (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        driver_id   INTEGER NOT NULL REFERENCES users(id),
        model       TEXT    NOT NULL,
        type        TEXT    NOT NULL,
        color       TEXT,
        capacity    INTEGER NOT NULL,
        created_at  TEXT    DEFAULT (datetime('now'))
    );

    -- ─── TRIP STATUS ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS trip_status (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    UNIQUE NOT NULL
    );
    INSERT OR IGNORE INTO trip_status(name) VALUES ('Open'),('Full'),('Completed'),('Cancelled');

    -- ─── TRIPS ────────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS trips (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id      INTEGER NOT NULL REFERENCES vehicles(id),
        source          TEXT    NOT NULL,
        destination     TEXT    NOT NULL,
        trip_date       TEXT    NOT NULL,
        trip_time       TEXT    NOT NULL,
        available_seats INTEGER NOT NULL,
        price_per_seat  REAL    NOT NULL DEFAULT 0,
        status_id       INTEGER NOT NULL REFERENCES trip_status(id),
        pink_mode       INTEGER DEFAULT 0,
        created_at      TEXT    DEFAULT (datetime('now'))
    );

    -- ─── BOOKINGS ─────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS bookings (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id         INTEGER NOT NULL REFERENCES trips(id),
        rider_id        INTEGER NOT NULL REFERENCES users(id),
        seats_booked    INTEGER NOT NULL DEFAULT 1,
        status          TEXT    NOT NULL DEFAULT 'pending',
        expires_at      TEXT,
        booking_date    TEXT    DEFAULT (datetime('now'))
    );

    -- ─── PAYMENTS ─────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS payments (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id      INTEGER NOT NULL REFERENCES bookings(id),
        amount          REAL    NOT NULL,
        mode            TEXT    DEFAULT 'UPI',
        status          TEXT    DEFAULT 'Completed',
        paid_at         TEXT    DEFAULT (datetime('now'))
    );

    -- ─── DRIVER LICENSE ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS driver_licenses (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER UNIQUE NOT NULL REFERENCES users(id),
        license_no  TEXT    UNIQUE NOT NULL,
        issue_date  TEXT,
        expiry_date TEXT
    );

    -- ─── EMERGENCY CONTACTS (legacy table) ───────────────────────────────────
    CREATE TABLE IF NOT EXISTS emergency_contacts (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id         INTEGER NOT NULL REFERENCES users(id),
        contact_name    TEXT    NOT NULL,
        contact_phone   TEXT    NOT NULL
    );

    -- ─── RIDES (FairShare) ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS rides (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id         INTEGER NOT NULL REFERENCES users(id),
        source          TEXT    NOT NULL,
        destination     TEXT    NOT NULL,
        date            TEXT    NOT NULL,
        time_slot       TEXT    NOT NULL,
        ride_time       TEXT,
        vehicle_type    TEXT    NOT NULL,
        seats_available INTEGER NOT NULL,
        male_count      INTEGER DEFAULT 0,
        female_count    INTEGER DEFAULT 0,
        pink_mode       INTEGER DEFAULT 0,
        status          TEXT    DEFAULT 'open',
        trip_started    INTEGER DEFAULT 0,
        trip_started_at TEXT,
        trip_completed  INTEGER DEFAULT 0,
        trip_completed_at TEXT,
        vehicle_reg     TEXT,
        tracking_token  TEXT,
        created_at      TEXT    DEFAULT (datetime('now')),
        expires_at      TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ride_members (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        ride_id     INTEGER NOT NULL REFERENCES rides(id),
        user_id     INTEGER NOT NULL REFERENCES users(id),
        joined_at   TEXT    DEFAULT (datetime('now')),
        UNIQUE(ride_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        ride_id     INTEGER NOT NULL REFERENCES rides(id),
        user_id     INTEGER NOT NULL REFERENCES users(id),
        content     TEXT    NOT NULL,
        sent_at     TEXT    DEFAULT (datetime('now'))
    );

    -- ─── RIDE REQUESTS (Mutual Consent) ──────────────────────────────────────
    CREATE TABLE IF NOT EXISTS ride_requests (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        ride_id         INTEGER NOT NULL REFERENCES rides(id),
        requester_id    INTEGER NOT NULL REFERENCES users(id),
        status          TEXT    NOT NULL DEFAULT 'pending',
        requested_at    TEXT    DEFAULT (datetime('now')),
        responded_at    TEXT,
        UNIQUE(ride_id, requester_id)
    );

    -- ─── RIDE TRACKING (GPS) ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS ride_tracking (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        ride_id     INTEGER NOT NULL REFERENCES rides(id),
        lat         REAL    NOT NULL,
        lng         REAL    NOT NULL,
        timestamp   TEXT    DEFAULT (datetime('now'))
    );

    -- ─── RIDE AUDIT LOG ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS ride_audit_log (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        ride_id         INTEGER NOT NULL,
        started_at      TEXT,
        source          TEXT,
        destination     TEXT,
        vehicle_reg     TEXT,
        owner_user_id   INTEGER,
        member_aadhaars TEXT,
        member_ids      TEXT,
        created_at      TEXT    DEFAULT (datetime('now'))
    );

    -- ─── RATINGS ─────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS ratings (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        ride_id     INTEGER NOT NULL REFERENCES rides(id),
        rated_by    INTEGER NOT NULL REFERENCES users(id),
        rated_user  INTEGER NOT NULL REFERENCES users(id),
        stars       INTEGER NOT NULL CHECK(stars >= 1 AND stars <= 5),
        created_at  TEXT    DEFAULT (datetime('now')),
        UNIQUE(ride_id, rated_by, rated_user)
    );
  `);

    // ─── MIGRATIONS for existing tables ──────────────────────────────────────
    const migrations = [
        { table: 'users', column: 'aadhaar_last4', type: 'TEXT' },
        { table: 'users', column: 'aadhaar_verified', type: 'INTEGER DEFAULT 0' },
        { table: 'users', column: 'emergency_contact_name', type: 'TEXT' },
        { table: 'users', column: 'emergency_contact_phone', type: 'TEXT' },
        { table: 'users', column: 'trip_count', type: 'INTEGER DEFAULT 0' },
        { table: 'rides', column: 'ride_time', type: 'TEXT' },
        { table: 'rides', column: 'status', type: "TEXT DEFAULT 'open'" },
        { table: 'rides', column: 'trip_started', type: 'INTEGER DEFAULT 0' },
        { table: 'rides', column: 'trip_started_at', type: 'TEXT' },
        { table: 'rides', column: 'trip_completed', type: 'INTEGER DEFAULT 0' },
        { table: 'rides', column: 'trip_completed_at', type: 'TEXT' },
        { table: 'rides', column: 'vehicle_reg', type: 'TEXT' },
        { table: 'rides', column: 'tracking_token', type: 'TEXT' },
        { table: 'rides', column: 'source_lat', type: 'REAL' },
        { table: 'rides', column: 'source_lng', type: 'REAL' },
        { table: 'rides', column: 'destination_lat', type: 'REAL' },
        { table: 'rides', column: 'destination_lng', type: 'REAL' },
    ];

    for (const m of migrations) {
        try {
            db.exec(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.type}`);
        } catch (e) {
            // Column already exists — ignore
        }
    }

    // Make username nullable for partial registration
    try {
        db.prepare(`UPDATE users SET role = NULL WHERE role = 'rider' AND id NOT IN (SELECT DISTINCT rider_id FROM bookings)`).run();
    } catch (e) {
        // Ignore
    }

    console.log('✅ Database schema initialized');
}

module.exports = { getDb };
