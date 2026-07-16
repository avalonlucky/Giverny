CREATE TABLE IF NOT EXISTS local_cli_pairings (
  id TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  browser_device_key TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_local_cli_pairings_expiry
ON local_cli_pairings(expires_at, consumed_at);

CREATE TABLE IF NOT EXISTS local_cli_devices (
  id TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL,
  browser_device_key TEXT NOT NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT '',
  arch TEXT NOT NULL DEFAULT '',
  bridge_version TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL UNIQUE,
  selected_cli_id TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_local_cli_devices_owner
ON local_cli_devices(principal_id, browser_device_key, revoked_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS local_cli_adapters (
  device_id TEXT NOT NULL,
  adapter_id TEXT NOT NULL,
  name TEXT NOT NULL,
  command TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unavailable',
  auth_status TEXT NOT NULL DEFAULT 'unknown',
  supports_streaming INTEGER NOT NULL DEFAULT 0,
  supports_mcp INTEGER NOT NULL DEFAULT 0,
  detail TEXT NOT NULL DEFAULT '',
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (device_id, adapter_id),
  FOREIGN KEY (device_id) REFERENCES local_cli_devices(id)
);

CREATE INDEX IF NOT EXISTS idx_local_cli_adapters_device
ON local_cli_adapters(device_id, status, adapter_id);

CREATE TABLE IF NOT EXISTS local_cli_commands (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  command_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  result_json TEXT,
  error_message TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  claimed_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (device_id) REFERENCES local_cli_devices(id)
);

CREATE INDEX IF NOT EXISTS idx_local_cli_commands_poll
ON local_cli_commands(device_id, status, expires_at, created_at);

CREATE INDEX IF NOT EXISTS idx_local_cli_commands_owner
ON local_cli_commands(principal_id, created_at DESC);
