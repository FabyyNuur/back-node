import Database from "better-sqlite3";

const db = new Database("nuurgym.db");
db.pragma("journal_mode = WAL");

export const initDb = () => {
  db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'CONTROLEUR', -- 'ADMIN' ou 'CONTROLEUR'
            is_active INTEGER NOT NULL DEFAULT 1
        );
    `);

  db.exec(`
        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            registration_fee REAL DEFAULT 0,
            daily_ticket_price REAL DEFAULT 0,
            weekly_price REAL,
            monthly_price REAL,
            quarterly_price REAL,
            semester_price REAL,
            yearly_price REAL,
            subscription_only BOOLEAN DEFAULT 0,
            color TEXT DEFAULT '#F36F6F',
            is_active INTEGER NOT NULL DEFAULT 1
        );
    `);

  db.exec(`
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            address TEXT,
            qr_code TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

  db.exec(`
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            activity_id INTEGER NOT NULL,
            start_date DATETIME NOT NULL,
            end_date DATETIME NOT NULL,
            status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'EXPIRED'
            FOREIGN KEY (client_id) REFERENCES clients(id),
            FOREIGN KEY (activity_id) REFERENCES activities(id)
        );
    `);

  db.exec(`
        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activity_id INTEGER NOT NULL,
            price REAL NOT NULL,
            qr_code TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            valid_until DATETIME NOT NULL,
            status TEXT DEFAULT 'VALID', -- 'VALID', 'USED', 'EXPIRED'
            FOREIGN KEY (activity_id) REFERENCES activities(id)
        );
    `);

  db.exec(`
        CREATE TABLE IF NOT EXISTS access_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            qr_code_scanned TEXT NOT NULL,
            is_valid BOOLEAN NOT NULL,
            details TEXT,
            scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

  db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount REAL NOT NULL,
            type TEXT NOT NULL, -- 'INCOME', 'EXPENSE'
            description TEXT,
            payment_method TEXT DEFAULT 'CASH', -- 'CASH', 'CARD', 'MOBILE_MONEY'
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

  const activityColumns = db.prepare(`PRAGMA table_info(activities)`).all();
  const hasColorColumn = activityColumns.some(
    (column) => column.name === "color",
  );
  const hasActivityIsActiveColumn = activityColumns.some(
    (column) => column.name === "is_active",
  );
  if (!hasColorColumn) {
    db.prepare(
      `ALTER TABLE activities ADD COLUMN color TEXT DEFAULT '#F36F6F'`,
    ).run();
  }
  if (!hasActivityIsActiveColumn) {
    db.prepare(
      `ALTER TABLE activities ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`,
    ).run();
  }

  db.prepare(
    `UPDATE activities SET color = '#F36F6F' WHERE color IS NULL OR TRIM(color) = ''`,
  ).run();
  db.prepare(
    `UPDATE activities SET is_active = 1 WHERE is_active IS NULL`,
  ).run();

  const userColumns = db.prepare(`PRAGMA table_info(users)`).all();
  const hasUserIsActiveColumn = userColumns.some(
    (column) => column.name === "is_active",
  );
  if (!hasUserIsActiveColumn) {
    db.prepare(
      `ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`,
    ).run();
  }
  db.prepare(`UPDATE users SET is_active = 1 WHERE is_active IS NULL`).run();

  const subscriptionColumns = db
    .prepare(`PRAGMA table_info(subscriptions)`)
    .all();
  const subColNames = subscriptionColumns.map((c) => c.name);
  if (!subColNames.includes("amount_paid")) {
    db.prepare(
      `ALTER TABLE subscriptions ADD COLUMN amount_paid REAL DEFAULT 0`,
    ).run();
  }
  if (!subColNames.includes("payment_method")) {
    db.prepare(
      `ALTER TABLE subscriptions ADD COLUMN payment_method TEXT DEFAULT 'CASH'`,
    ).run();
  }

  const adminExists = db
    .prepare(`SELECT count(*) as count FROM users WHERE role = 'ADMIN'`)
    .get();
  if (adminExists.count === 0) {
    // admin@nuurgym.com avec le mot de passe "admin123" (Hashé via bcrypt pour la sécurité)
    db.prepare(
      `INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)`,
    ).run(
      "admin@nuurgym.com",
      "$2b$10$eYkZUcMHDZR.7awP87.s9eGyOeSIg3Vjfebfx0yJuIyMiuP8IDgBm",
      "Gérant Admin",
      "ADMIN",
    );
  }
};

export default db;
