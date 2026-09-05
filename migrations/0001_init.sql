CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mrn TEXT,
  admission_date TEXT,
  age TEXT,
  weight TEXT,
  diagnosis TEXT,
  background TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS daily_entries (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  active_issues TEXT,
  checkup TEXT,
  antibiotics TEXT,
  labs TEXT,
  treatment TEXT,
  plan TEXT,
  future_plan TEXT,
  events TEXT,
  documented_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY(documented_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_entries_patient_date
ON daily_entries(patient_id,entry_date,created_at);
