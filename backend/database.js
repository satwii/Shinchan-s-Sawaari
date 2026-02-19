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
    -- role is NULL initially; set to 'driver'|'rider' when user enters DriveShare
    CREATE TABLE IF NOT EXISTS users (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        phone           TEXT    UNIQUE NOT NULL,
        username        TEXT    UNIQUE NOT NULL,
        gender          TEXT    NOT NULL,
        age             INTEGER NOT NULL,
        role            TEXT    DEFAULT NULL,           -- NULL | 'driver' | 'rider'
        created_at      TEXT    DEFAULT (datetime('now'))
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
        type        TEXT    NOT NULL,  -- Auto / Cab / SUV / Mini Bus etc.
        color       TEXT,
        capacity    INTEGER NOT NULL,
        created_at  TEXT    DEFAULT (datetime('now'))
    );

    -- ─── TRIP STATUS ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS trip_status (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    UNIQUE NOT NULL  -- Open | Full | Completed | Cancelled
    );

    -- Seed statuses
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
        pink_mode       INTEGER DEFAULT 0,   -- 1 = female-only trip
        created_at      TEXT    DEFAULT (datetime('now'))
    );

    -- ─── BOOKINGS ─────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS bookings (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id         INTEGER NOT NULL REFERENCES trips(id),
        rider_id        INTEGER NOT NULL REFERENCES users(id),
        seats_booked    INTEGER NOT NULL DEFAULT 1,
        status          TEXT    NOT NULL DEFAULT 'pending',  -- pending | confirmed | cancelled
        expires_at      TEXT,       -- payment deadline (30s after booking)
        booking_date    TEXT    DEFAULT (datetime('now'))
    );

    -- ─── PAYMENTS ─────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS payments (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id      INTEGER NOT NULL REFERENCES bookings(id),
        amount          REAL    NOT NULL,
        mode            TEXT    DEFAULT 'UPI',   -- UPI | Card | Cash
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

    -- ─── EMERGENCY CONTACTS ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS emergency_contacts (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id         INTEGER NOT NULL REFERENCES users(id),
        contact_name    TEXT    NOT NULL,
        contact_phone   TEXT    NOT NULL
    );

    -- ─── RIDE SHARING (FairShare — public transport sharing) ──────────────────
    CREATE TABLE IF NOT EXISTS rides (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id         INTEGER NOT NULL REFERENCES users(id),
        source          TEXT    NOT NULL,
        destination     TEXT    NOT NULL,
        date            TEXT    NOT NULL,
        time_slot       TEXT    NOT NULL,
        vehicle_type    TEXT    NOT NULL,
        seats_available INTEGER NOT NULL,
        male_count      INTEGER DEFAULT 0,
        female_count    INTEGER DEFAULT 0,
        pink_mode       INTEGER DEFAULT 0,   -- 1 = female-only ride
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
  `);

    // Migration: if users.role has NOT NULL constraint from old schema, relax it
    // SQLite can't ALTER columns, so we gracefully handle NULLs in code
    try {
        // Ensure existing users without a role default to NULL
        db.prepare(`UPDATE users SET role = NULL WHERE role = 'rider' AND id NOT IN (SELECT DISTINCT rider_id FROM bookings)`).run();
    } catch (e) {
        // Ignore — bookings table may not have data yet
    }

    console.log('✅ Database schema initialized');
}

module.exports = { getDb };
