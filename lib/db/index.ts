import initSqlJs, { type Database } from "sql.js"
import path from "path"
import fs from "fs"
import { hashSync } from "bcryptjs"
import { nanoid } from "nanoid"

let db: Database | null = null
let initPromise: Promise<Database> | null = null
let sqlInitPromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null = null
let dbFileMtimeMs = 0

const DB_PATH =
  process.env.SOC_BEACON_DB_PATH ||
  (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? path.join("/tmp", "soc-beacon.db")
    : path.join(process.cwd(), "data", "soc-beacon.db"))

function ensureDir() {
  try {
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  } catch (e) {
    console.warn("[db] ensureDir warning:", e)
  }
}

function getFileMtimeMs(): number {
  try {
    if (!fs.existsSync(DB_PATH)) return 0
    return fs.statSync(DB_PATH).mtimeMs
  } catch {
    return 0
  }
}

async function getSqlModule() {
  if (!sqlInitPromise) sqlInitPromise = initSqlJs()
  return sqlInitPromise
}

function saveDb(database: Database) {
  ensureDir()
  const data = database.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
  dbFileMtimeMs = getFileMtimeMs()
}

function applyPragmas(database: Database) {
  database.run("PRAGMA journal_mode = WAL")
  database.run("PRAGMA foreign_keys = ON")
}

async function loadDatabaseFromDiskOrCreate(): Promise<Database> {
  const SQL = await getSqlModule()
  ensureDir()

  const nextDb = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database()

  applyPragmas(nextDb)
  initializeSchema(nextDb)
  saveDb(nextDb)
  return nextDb
}

export async function getDb(forceReload: boolean = false): Promise<Database> {
  if (!db) {
    if (!initPromise) {
      initPromise = (async () => {
        db = await loadDatabaseFromDiskOrCreate()
        return db
      })()
    }
    return initPromise
  }

  // In dev/app-router, different workers may write/read independently.
  // Reload from file when another worker has persisted a newer snapshot.
  const diskMtimeMs = getFileMtimeMs()
  if (forceReload || diskMtimeMs > dbFileMtimeMs) {
    if (fs.existsSync(DB_PATH)) {
      const previousDb = db
      const SQL = await getSqlModule()
      const reloaded = new SQL.Database(fs.readFileSync(DB_PATH))
      applyPragmas(reloaded)
      db = reloaded
      dbFileMtimeMs = diskMtimeMs || getFileMtimeMs()
      ;(previousDb as unknown as { close?: () => void }).close?.()
    }
  }

  return db
}

export function persistDb() {
  if (db) saveDb(db)
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'analyst' CHECK(role IN ('admin','analyst')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('critical','high','medium','low','info')),
  parsed INTEGER DEFAULT 0,
  raw TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_severity ON logs(severity);
CREATE INDEX IF NOT EXISTS idx_logs_source ON logs(source);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  source TEXT NOT NULL,
  source_ip TEXT NOT NULL,
  dest_ip TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('critical','high','medium','low','info')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  yara_match TEXT,
  mitre_tactic TEXT NOT NULL,
  mitre_technique TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','investigating','resolved','false_positive')),
  incident_status TEXT NOT NULL DEFAULT 'unassigned' CHECK(incident_status IN ('unassigned','in_progress','resolved')),
  verdict TEXT NOT NULL DEFAULT 'suspicious' CHECK(verdict IN ('malicious','suspicious','false_positive')),
  raw_log TEXT NOT NULL,
  log_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);

CREATE TABLE IF NOT EXISTS alert_enrichments (
  alert_id TEXT PRIMARY KEY,
  ai_analysis TEXT,
  ai_summary_short TEXT,
  ioc_type TEXT,
  threat_intel TEXT,
  recommendation TEXT,
  confidence REAL,
  ai_score REAL,
  heuristics_score REAL,
  related_cves TEXT,
  geo_country TEXT,
  geo_city TEXT,
  asn_info TEXT,
  sigma_match TEXT,
  parse_confidence REAL,
  extracted_fields TEXT,
  field_confidence TEXT,
  verdict_reason TEXT,
  verdict_factors TEXT,
  enriched_at TEXT DEFAULT (datetime('now')),
  llm_provider TEXT,
  llm_model TEXT
);

CREATE TABLE IF NOT EXISTS alert_notes (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL,
  username TEXT NOT NULL,
  note_text TEXT NOT NULL,
  image_data TEXT,
  image_mime TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(alert_id) REFERENCES alerts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_alert_notes_alert_id ON alert_notes(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_notes_created_at ON alert_notes(created_at);

CREATE TABLE IF NOT EXISTS yara_rules (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS threat_feeds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  api_key TEXT DEFAULT '',
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
`

function initializeSchema(database: Database) {
  database.run(SCHEMA_SQL)
  migrateSchema(database)

  const result = database.exec("SELECT COUNT(*) as count FROM users")
  const count = result[0]?.values[0]?.[0] as number
  if (count === 0) {
    seedDatabase(database)
  }
}

function tableHasColumn(database: Database, table: string, column: string): boolean {
  const rs = database.exec(`PRAGMA table_info(${table})`)
  const rows = rs[0]?.values || []
  return rows.some((r: unknown[]) => String(r[1]) === column)
}

function migrateSchema(database: Database) {
  if (!tableHasColumn(database, "users", "role")) {
    database.run("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'analyst' CHECK(role IN ('admin','analyst'))")
    database.run("UPDATE users SET role = 'admin' WHERE username = 'admin'")
    database.run("UPDATE users SET role = 'analyst' WHERE role IS NULL OR role = ''")
  }

  if (!tableHasColumn(database, "alerts", "incident_status")) {
    database.run(
      "ALTER TABLE alerts ADD COLUMN incident_status TEXT NOT NULL DEFAULT 'unassigned' CHECK(incident_status IN ('unassigned','in_progress','resolved'))"
    )
    database.run(`
      UPDATE alerts
      SET incident_status = CASE
        WHEN status = 'investigating' THEN 'in_progress'
        WHEN status = 'resolved' THEN 'resolved'
        ELSE 'unassigned'
      END
    `)
  }

  if (!tableHasColumn(database, "alerts", "verdict")) {
    database.run(
      "ALTER TABLE alerts ADD COLUMN verdict TEXT NOT NULL DEFAULT 'suspicious' CHECK(verdict IN ('malicious','suspicious','false_positive'))"
    )
    database.run(`
      UPDATE alerts
      SET verdict = CASE
        WHEN status = 'false_positive' THEN 'false_positive'
        ELSE 'suspicious'
      END
    `)
  }

  if (!tableHasColumn(database, "alert_enrichments", "ai_score")) {
    database.run("ALTER TABLE alert_enrichments ADD COLUMN ai_score REAL")
    database.run("UPDATE alert_enrichments SET ai_score = confidence WHERE ai_score IS NULL")
  }

  if (!tableHasColumn(database, "alert_enrichments", "heuristics_score")) {
    database.run("ALTER TABLE alert_enrichments ADD COLUMN heuristics_score REAL")
    database.run("UPDATE alert_enrichments SET heuristics_score = confidence WHERE heuristics_score IS NULL")
  }

  if (!tableHasColumn(database, "alert_enrichments", "sigma_match")) {
    database.run("ALTER TABLE alert_enrichments ADD COLUMN sigma_match TEXT")
  }

  if (!tableHasColumn(database, "alert_enrichments", "parse_confidence")) {
    database.run("ALTER TABLE alert_enrichments ADD COLUMN parse_confidence REAL")
  }

  if (!tableHasColumn(database, "alert_enrichments", "extracted_fields")) {
    database.run("ALTER TABLE alert_enrichments ADD COLUMN extracted_fields TEXT")
  }

  if (!tableHasColumn(database, "alert_enrichments", "field_confidence")) {
    database.run("ALTER TABLE alert_enrichments ADD COLUMN field_confidence TEXT")
  }

  if (!tableHasColumn(database, "alert_enrichments", "threat_intel_vendors")) {
    database.run("ALTER TABLE alert_enrichments ADD COLUMN threat_intel_vendors TEXT")
  }

  if (!tableHasColumn(database, "alert_enrichments", "ai_summary_short")) {
    database.run("ALTER TABLE alert_enrichments ADD COLUMN ai_summary_short TEXT")
  }

  if (!tableHasColumn(database, "alert_enrichments", "verdict_reason")) {
    database.run("ALTER TABLE alert_enrichments ADD COLUMN verdict_reason TEXT")
  }

  if (!tableHasColumn(database, "alert_enrichments", "verdict_factors")) {
    database.run("ALTER TABLE alert_enrichments ADD COLUMN verdict_factors TEXT")
  }
}

function seedDatabase(database: Database) {
  // Seed admin user
  const adminId = nanoid()
  const configuredAdminPassword = (process.env.SOC_BEACON_ADMIN_PASSWORD || "").trim()
  const bootstrapAdminPassword = configuredAdminPassword || "admin123"
  const hash = hashSync(bootstrapAdminPassword, 10)
  database.run(
    "INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)",
    [adminId, "admin", hash, "admin"]
  )

  // Seed default settings
  const defaults: Record<string, unknown> = {
    general: { instanceName: "SOC Beacon - Production", retentionDays: 90 },
    syslog: { enabled: true, port: 1514, protocol: "both", tls: false },
    api: { enabled: true, port: 8443, apiKey: `sk-beacon-${nanoid(32)}` },
    llm: {
      provider: "openai",
      apiKey: "",
      model: "gpt-4.1-nano",
      endpoint: "https://api.openai.com/v1",
      maxTokens: 700,
      temperature: 0.1,
      autoEnrich: true,
      analysisAgents: 3,
      agents: [
        {
          id: "triage",
          name: "Incident Triage Expert",
          description: "Scores risk and explains likely attacker objective.",
          enabled: true,
          model: "gpt-4.1-nano",
          prompt: "Explain what happened, probable attacker objective, and assign AI score.",
          maxTokens: 700,
          temperature: 0.1,
        },
        {
          id: "ioc_detection",
          name: "IOC and Detection Expert",
          description: "Validates indicators and detection quality, highlights likely false positives.",
          enabled: true,
          model: "gpt-4.1-nano",
          prompt: "Validate IOC type quality, tune MITRE mapping, and note likely false positives.",
          maxTokens: 700,
          temperature: 0.1,
        },
        {
          id: "threat_intel",
          name: "Threat Intelligence Correlation Expert",
          description: "Correlates event context with threat intel history and active compromise risk.",
          enabled: true,
          model: "gpt-4.1-nano",
          prompt: "Correlate event against threat intel and assess probability of active compromise.",
          maxTokens: 700,
          temperature: 0.1,
        },
        {
          id: "response",
          name: "Incident Response Lead",
          description: "Creates prioritized containment and investigation actions.",
          enabled: true,
          model: "gpt-4.1-nano",
          prompt: "Produce concise prioritized containment and investigation steps.",
          maxTokens: 700,
          temperature: 0.1,
        },
        {
          id: "summary_header",
          name: "Alert Header Summary Agent",
          description: "Generates a strict max-30-word alert summary for header display.",
          enabled: true,
          model: "gpt-4.1-nano",
          prompt: "Summarize this alert in one sentence, maximum 30 words, technical and actionable, no markdown.",
          maxTokens: 120,
          temperature: 0.1,
        },
      ],
      autoStatusConfidenceThreshold: 90,
      verdictMaliciousThreshold: 80,
      verdictSuspiciousThreshold: 45,
      fpAutoResolveThreshold: 30,
      neverAutoResolveLowEvidence: true,
      minAutoResolveEvidence: 55,
      sourceThresholds: {},
    },
    yara: { enabled: true, autoUpdate: true },
    sigma: {
      enabled: false,
      rulesPath: "",
      maxRules: 500,
    },
    pipeline: {
      fieldConfidenceThreshold: 60,
    },
    syslogOutput: {
      enabled: false,
      host: "10.0.0.50",
      port: 5514,
      format: "cef",
    },
  }

  for (const [key, value] of Object.entries(defaults)) {
    database.run("INSERT INTO settings (key, value) VALUES (?, ?)", [
      key,
      JSON.stringify(value),
    ])
  }

  // Seed threat feeds
  const feeds = [
    {
      name: "AlienVault OTX",
      url: "https://otx.alienvault.com/api/v1/",
      enabled: 1,
    },
    {
      name: "Abuse.ch URLhaus",
      url: "https://urlhaus-api.abuse.ch/v1/",
      enabled: 1,
    },
    {
      name: "VirusTotal",
      url: "https://www.virustotal.com/api/v3/",
      enabled: 0,
    },
  ]
  for (const f of feeds) {
    database.run(
      "INSERT INTO threat_feeds (id, name, url, api_key, enabled) VALUES (?, ?, ?, '', ?)",
      [nanoid(), f.name, f.url, f.enabled]
    )
  }

  // Seed YARA rules
  const yaraRules = [
    {
      name: "CobaltStrike_Beacon_Encoded",
      content: `rule CobaltStrike_Beacon_Encoded {
  meta:
    description = "Detects encoded Cobalt Strike beacon patterns"
    severity = "critical"
  strings:
    $s1 = "cobalt" nocase
    $s2 = "beacon" nocase
    $s3 = "cobaltstrike" nocase
    $hex1 = { 4D 5A 90 00 03 00 00 00 }
  condition:
    any of ($s*) or $hex1
}`,
    },
    {
      name: "Mimikatz_Memory_Signature",
      content: `rule Mimikatz_Memory_Signature {
  meta:
    description = "Detects Mimikatz credential dumping signatures"
    severity = "critical"
  strings:
    $s1 = "mimikatz" nocase
    $s2 = "sekurlsa" nocase
    $s3 = "lsass" nocase
    $s4 = "credential.dump" nocase
    $s5 = "kerberos::golden" nocase
  condition:
    any of them
}`,
    },
    {
      name: "PowerShell_Download_Cradle",
      content: `rule PowerShell_Download_Cradle {
  meta:
    description = "Detects PowerShell download cradle patterns"
    severity = "high"
  strings:
    $s1 = "DownloadString" nocase
    $s2 = "DownloadFile" nocase
    $s3 = "Invoke-WebRequest" nocase
    $s4 = "IEX" nocase
    $s5 = "Net.WebClient" nocase
    $s6 = "-enc " nocase
    $s7 = "-encodedcommand" nocase
  condition:
    any of them
}`,
    },
    {
      name: "OLE_Macro_Suspicious",
      content: `rule OLE_Macro_Suspicious {
  meta:
    description = "Detects suspicious OLE macro indicators"
    severity = "medium"
  strings:
    $s1 = "AutoOpen" nocase
    $s2 = "AutoExec" nocase
    $s3 = "Document_Open" nocase
    $s4 = "Shell(" nocase
    $s5 = "WScript.Shell" nocase
    $s6 = "macro" nocase
    $s7 = ".xlsm" nocase
  condition:
    any of them
}`,
    },
    {
      name: "Ransomware_Note_Strings",
      content: `rule Ransomware_Note_Strings {
  meta:
    description = "Detects common ransomware note strings"
    severity = "critical"
  strings:
    $s1 = "your files have been encrypted" nocase
    $s2 = "bitcoin" nocase
    $s3 = "ransom" nocase
    $s4 = "decrypt" nocase
    $s5 = "pay the" nocase
    $s6 = ".onion" nocase
  condition:
    2 of them
}`,
    },
  ]
  for (const rule of yaraRules) {
    database.run(
      "INSERT INTO yara_rules (id, name, content, enabled) VALUES (?, ?, ?, 1)",
      [nanoid(), rule.name, rule.content]
    )
  }

  // Seed demo alerts and logs
  const seedDemo = (process.env.SOC_BEACON_SEED_DEMO || "false").toLowerCase()
  if (seedDemo === "true" || seedDemo === "1" || seedDemo === "yes") {
    seedDemoData(database)
  }
}

function seedDemoData(database: Database) {
  const now = Date.now()
  const h = (hours: number) => new Date(now - hours * 3600000).toISOString()
  const mi = (minutes: number) => new Date(now - minutes * 60000).toISOString()

  // Seed logs
  const logs = [
    { id: "LOG-001", timestamp: mi(1), source: "Firewall-01", message: "Connection accepted from 192.168.1.100:52341 to 10.0.1.15:443 proto TCP", severity: "info", parsed: 1 },
    { id: "LOG-002", timestamp: mi(2), source: "Sysmon-Agent-01", message: "Process Create: powershell.exe -ExecutionPolicy Bypass -File C:\\scripts\\update.ps1", severity: "medium", parsed: 1 },
    { id: "LOG-003", timestamp: mi(3), source: "Firewall-01", message: "DROP: SRC=198.51.100.44 DST=10.0.1.15 PROTO=TCP SPT=443 DPT=49832 - Matched rule: CobaltStrike_Beacon", severity: "critical", parsed: 1 },
    { id: "LOG-004", timestamp: mi(4), source: "Auth-Server", message: "Failed authentication for user admin from 10.0.4.12 via Kerberos", severity: "high", parsed: 1 },
    { id: "LOG-005", timestamp: mi(5), source: "DNS-Monitor", message: "Query: MFZGC3TBNVSA.data.update-service.xyz IN TXT from 10.0.6.30", severity: "medium", parsed: 1 },
    { id: "LOG-006", timestamp: mi(6), source: "Web-Server-01", message: "GET /api/users?id=1%20UNION%20SELECT%201,2,3 HTTP/1.1 403 - ModSecurity blocked", severity: "high", parsed: 1 },
    { id: "LOG-007", timestamp: mi(7), source: "EDR-Agent-07", message: "File created: C:\\Windows\\Temp\\debug.dll - SHA256: a1b2c3d4...", severity: "medium", parsed: 1 },
    { id: "LOG-008", timestamp: mi(8), source: "Firewall-02", message: "Connection accepted from 10.0.1.45:49123 to 185.220.101.33:443 proto TLS", severity: "high", parsed: 1 },
    { id: "LOG-009", timestamp: mi(9), source: "Proxy-01", message: "CONNECT github.com:443 HTTP/1.1 200 - User: jdoe - Category: Technology", severity: "info", parsed: 1 },
    { id: "LOG-010", timestamp: mi(10), source: "Auth-Server", message: "Successful authentication for user svc_backup from 10.0.1.100 via NTLM", severity: "info", parsed: 1 },
    { id: "LOG-011", timestamp: mi(11), source: "Sysmon-Agent-15", message: "Registry modification: HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run - Value added", severity: "medium", parsed: 1 },
    { id: "LOG-012", timestamp: mi(12), source: "EDR-Agent-07", message: "ALERT: Process injection detected - svchost.exe (PID:4412) -> lsass.exe (PID:672)", severity: "critical", parsed: 1 },
    { id: "LOG-013", timestamp: mi(15), source: "Mail-Gateway", message: "Quarantined: From=billing@quickb00ks-support.com Subject='Invoice #INV-2026-0215' - Malicious macro", severity: "medium", parsed: 1 },
    { id: "LOG-014", timestamp: mi(18), source: "Cloud-Trail", message: "iam.amazonaws.com PutRolePolicy - User: devops-admin - Role: lambda-data-processor", severity: "info", parsed: 1 },
    { id: "LOG-015", timestamp: mi(20), source: "WAF-01", message: "Blocked: Nikto scanner detected from 45.33.32.156 - 2847 requests in 45 minutes", severity: "low", parsed: 1 },
    { id: "LOG-016", timestamp: mi(22), source: "Firewall-01", message: "Connection accepted from 10.0.2.50:8080 to 10.0.2.51:22 proto SSH", severity: "info", parsed: 1 },
    { id: "LOG-017", timestamp: mi(25), source: "Proxy-01", message: "BLOCKED: Connection to known malware domain evil-payload.ru from 10.0.5.77", severity: "high", parsed: 1 },
    { id: "LOG-018", timestamp: mi(28), source: "IDS-Sensor-03", message: "ALERT: SQL Injection signature matched - Source: 203.0.113.55 Target: 10.0.3.200:443", severity: "high", parsed: 1 },
    { id: "LOG-019", timestamp: mi(30), source: "Auth-Server", message: "Account lockout: user 'finance_admin' after 5 failed attempts from 10.0.4.12", severity: "high", parsed: 1 },
    { id: "LOG-020", timestamp: mi(35), source: "DNS-Monitor", message: "NXDomain response for suspicious-c2-domain.top queried by 10.0.3.55", severity: "low", parsed: 1 },
  ]

  const logStmt = database.prepare(
    "INSERT INTO logs (id, timestamp, source, message, severity, parsed) VALUES (?, ?, ?, ?, ?, ?)"
  )
  for (const log of logs) {
    logStmt.run([log.id, log.timestamp, log.source, log.message, log.severity, log.parsed])
  }
  logStmt.free()

  // Seed alerts
  const alertsData: Array<{
    id: string; timestamp: string; source: string; sourceIp: string; destIp: string;
    severity: string; title: string; description: string; yaraMatch: string | null;
    mitreTactic: string; mitreTechnique: string; status: string; rawLog: string;
    enrichment: {
      aiAnalysis: string; iocType: string; threatIntel: string; recommendation: string;
      confidence: number; relatedCves: string[];
      geoLocation: { country: string; city: string } | null; asnInfo: string | null;
    };
  }> = [
    {
      id: "ALR-001", timestamp: mi(3), source: "Firewall-01", sourceIp: "198.51.100.44", destIp: "10.0.1.15",
      severity: "critical", title: "Cobalt Strike Beacon Detected",
      description: "YARA rule matched known Cobalt Strike beacon pattern in network traffic from external IP targeting internal server.",
      yaraMatch: "CobaltStrike_Beacon_Encoded", mitreTactic: "Command and Control",
      mitreTechnique: "T1071.001 - Application Layer Protocol: Web Protocols", status: "new",
      rawLog: '<134>1 2026-02-15T10:42:15.003Z fw-01 suricata - - - [1:2027865:3] ET MALWARE Cobalt Strike Beacon Detected [Classification: A Network Trojan was Detected] [Priority: 1] {TCP} 198.51.100.44:443 -> 10.0.1.15:49832',
      enrichment: {
        aiAnalysis: "This alert indicates a high-confidence detection of a Cobalt Strike beacon, a widely used adversary simulation tool frequently leveraged in real-world intrusions. The beacon was detected communicating over HTTPS to a known C2 infrastructure IP (198.51.100.44). The encoded payload matches the signature pattern of a staged Cobalt Strike beacon using a malleable C2 profile designed to mimic legitimate web traffic. The destination host (10.0.1.15) appears to be a domain controller based on DNS records. Immediate isolation is recommended as lateral movement may have already occurred. The beacon's sleep timer suggests active operator engagement rather than automated staging.",
        iocType: "C2 Communication",
        threatIntel: "IP 198.51.100.44 has been associated with APT29 (Cozy Bear) infrastructure in recent CISA advisories. The IP was flagged in 3 threat intelligence feeds including AlienVault OTX and Abuse.ch.",
        recommendation: "1. Immediately isolate host 10.0.1.15 from the network. 2. Capture full memory dump before remediation. 3. Check for lateral movement indicators on adjacent hosts. 4. Block IP 198.51.100.44 at the perimeter firewall. 5. Hunt for additional beacons using provided YARA signatures across all endpoints.",
        confidence: 96, relatedCves: [],
        geoLocation: { country: "Russia", city: "Moscow" }, asnInfo: "AS12345 - Suspicious Hosting Ltd",
      },
    },
    {
      id: "ALR-002", timestamp: mi(12), source: "EDR-Agent-07", sourceIp: "10.0.2.88", destIp: "10.0.2.1",
      severity: "critical", title: "Mimikatz Credential Dumping",
      description: "Process injection detected with Mimikatz signatures. LSASS memory access from unauthorized process.",
      yaraMatch: "Mimikatz_Memory_Signature", mitreTactic: "Credential Access",
      mitreTechnique: "T1003.001 - OS Credential Dumping: LSASS Memory", status: "investigating",
      rawLog: 'Feb 15 10:31:00 ws-088 EDR[1234]: ALERT - Process Injection Detected - Source: svchost.exe (PID:4412) -> Target: lsass.exe (PID:672) - Signature: Mimikatz_Memory_Signature - Action: Blocked',
      enrichment: {
        aiAnalysis: "Detected Mimikatz credential dumping tool execution on workstation WS-088. The process svchost.exe (PID 4412) was observed accessing LSASS memory space, which is a classic indicator of credential harvesting. The binary has been identified as a packed variant of Mimikatz v2.2.0 based on static analysis signatures. Process lineage shows the parent process was cmd.exe spawned from a Microsoft Word macro, suggesting initial access via spear-phishing. Multiple credential sets may have been compromised including domain admin tokens present in memory.",
        iocType: "Credential Theft",
        threatIntel: "This technique is commonly used in ransomware pre-deployment phases. Similar activity was observed in recent BlackCat/ALPHV campaigns.",
        recommendation: "1. Force password reset for all accounts logged into WS-088. 2. Revoke and rotate Kerberos TGT tickets. 3. Check for Golden Ticket indicators. 4. Scan for the originating phishing email across all mailboxes. 5. Enable Credential Guard on all endpoints.",
        confidence: 94, relatedCves: [], geoLocation: null, asnInfo: null,
      },
    },
    {
      id: "ALR-003", timestamp: mi(28), source: "IDS-Sensor-03", sourceIp: "203.0.113.55", destIp: "10.0.3.200",
      severity: "high", title: "SQL Injection Attempt on Web Application",
      description: "Multiple SQL injection attempts detected targeting production web server. UNION-based attack pattern identified.",
      yaraMatch: null, mitreTactic: "Initial Access", mitreTechnique: "T1190 - Exploit Public-Facing Application", status: "new",
      rawLog: 'Feb 15 10:15:00 web-srv-01 modsecurity: [id "942100"] [msg "SQL Injection Attack Detected via libinjection"] [data "Matched Data: UNION SELECT found"] [severity "CRITICAL"] [uri "/api/users?id=1 UNION SELECT 1,2,3,username,password FROM admin_users--"] [unique_id "abc123"]',
      enrichment: {
        aiAnalysis: "A series of SQL injection attempts were detected against the /api/users endpoint on the production web server (10.0.3.200). The attack pattern shows a methodical UNION-based injection technique, progressing from initial fingerprinting queries to data extraction attempts. The attacker appears to be using sqlmap with a custom tamper script to bypass WAF rules. Analysis of the payloads reveals attempts to enumerate database schema, extract user credentials, and access administrative tables.",
        iocType: "Web Attack",
        threatIntel: "Source IP 203.0.113.55 is associated with a known bulletproof hosting provider frequently used for automated vulnerability scanning campaigns.",
        recommendation: "1. Enable WAF rules for SQL injection protection. 2. Patch the vulnerable ORM configuration. 3. Review database access logs for successful data exfiltration. 4. Implement parameterized queries across the application. 5. Block source IP at edge firewall.",
        confidence: 89, relatedCves: ["CVE-2024-23108", "CVE-2024-23109"],
        geoLocation: { country: "Netherlands", city: "Amsterdam" }, asnInfo: "AS9009 - M247 Europe SRL",
      },
    },
    {
      id: "ALR-004", timestamp: h(1), source: "Firewall-02", sourceIp: "10.0.1.45", destIp: "185.220.101.33",
      severity: "high", title: "TOR Exit Node Communication",
      description: "Internal host communicating with known TOR exit node. Potential data exfiltration or C2 tunnel.",
      yaraMatch: null, mitreTactic: "Exfiltration", mitreTechnique: "T1048.002 - Exfiltration Over Alternative Protocol", status: "investigating",
      rawLog: '<134>1 2026-02-15T09:42:00.000Z fw-02 paloalto - - - THREAT,end,2026/02/15 09:42:00,10.0.1.45,185.220.101.33,...',
      enrichment: {
        aiAnalysis: "Host 10.0.1.45 (workstation WS-045) has established multiple TLS connections to IP 185.220.101.33, which is a known TOR exit node. Traffic analysis shows approximately 2.3GB of data transferred over the past 4 hours. The traffic pattern is consistent with data staging and exfiltration through an encrypted tunnel.",
        iocType: "Data Exfiltration",
        threatIntel: "IP 185.220.101.33 is listed on multiple TOR exit node databases. This node has been flagged in connection with multiple data breach investigations in the past 90 days.",
        recommendation: "1. Block TOR exit node IPs at the perimeter. 2. Interview user jsmith regarding unusual activity. 3. Forensically image the workstation. 4. Check DLP logs for file access patterns. 5. Review data classification of accessed resources.",
        confidence: 82, relatedCves: [],
        geoLocation: { country: "Germany", city: "Frankfurt" }, asnInfo: "AS24940 - Hetzner Online GmbH",
      },
    },
    {
      id: "ALR-005", timestamp: h(2), source: "SIEM-Correlation", sourceIp: "10.0.4.12", destIp: "10.0.4.0/24",
      severity: "high", title: "Brute Force Attack - Multiple Failed Logins",
      description: "Over 500 failed authentication attempts detected from single internal host targeting domain controller.",
      yaraMatch: null, mitreTactic: "Credential Access", mitreTechnique: "T1110.001 - Brute Force: Password Guessing", status: "new",
      rawLog: 'Feb 15 08:42:00 DC-01 Microsoft-Windows-Security-Auditing[4625]: An account failed to log on. Subject: Security ID: S-1-0-0, Account Name: -, Logon Type: 3, Account For Which Logon Failed: Account Name: administrator, Failure Reason: Unknown user name or bad password. Source Network Address: 10.0.4.12',
      enrichment: {
        aiAnalysis: "Internal host 10.0.4.12 has generated 547 failed Kerberos authentication attempts against the domain controller DC-01 within a 15-minute window. The attempts target multiple user accounts following an alphabetical pattern, suggesting an automated password spraying tool.",
        iocType: "Brute Force",
        threatIntel: "Password spraying is the #1 initial access vector for ransomware groups in 2026 according to recent DFIR reports.",
        recommendation: "1. Disable the 3 potentially compromised accounts immediately. 2. Implement account lockout policies. 3. Investigate DEV-012 for compromise indicators. 4. Enable MFA for all domain accounts. 5. Deploy advanced authentication monitoring.",
        confidence: 91, relatedCves: [], geoLocation: null, asnInfo: null,
      },
    },
    {
      id: "ALR-006", timestamp: h(3), source: "EDR-Agent-15", sourceIp: "10.0.5.77", destIp: "N/A",
      severity: "medium", title: "Suspicious PowerShell Execution",
      description: "Encoded PowerShell command detected with download cradle pattern on user workstation.",
      yaraMatch: "PowerShell_Download_Cradle", mitreTactic: "Execution",
      mitreTechnique: "T1059.001 - Command and Scripting Interpreter: PowerShell", status: "resolved",
      rawLog: 'Feb 15 07:42:00 ws-077 EDR[5678]: DETECT - Suspicious Process - powershell.exe -enc SQBFAFgA... - Parent: WINWORD.EXE - User: jdoe',
      enrichment: {
        aiAnalysis: "A PowerShell process was observed executing a Base64-encoded command that, when decoded, reveals a download cradle pattern. The payload URL points to a paste site commonly used for staging malicious scripts. The downloaded payload was blocked by application whitelisting before execution.",
        iocType: "Malicious Script",
        threatIntel: "The staging URL is associated with commodity malware distribution. Similar delivery chains have been observed in IcedID campaigns.",
        recommendation: "1. Verify application whitelisting successfully blocked execution. 2. Scan workstation with updated AV signatures. 3. Report the malicious Teams message. 4. Block the staging domain across all proxies. 5. Alert SOC team of potential phishing campaign.",
        confidence: 76, relatedCves: [], geoLocation: null, asnInfo: null,
      },
    },
    {
      id: "ALR-007", timestamp: h(4), source: "DNS-Monitor", sourceIp: "10.0.6.30", destIp: "8.8.8.8",
      severity: "medium", title: "DNS Tunneling Activity Detected",
      description: "Anomalous DNS query patterns detected suggesting potential data exfiltration via DNS tunneling.",
      yaraMatch: null, mitreTactic: "Command and Control", mitreTechnique: "T1071.004 - Application Layer Protocol: DNS", status: "new",
      rawLog: 'Feb 15 06:42:00 dns-01 named[1234]: queries: client @0x7f2a3c 10.0.6.30#54321 (MFZGC3TBNVSA.data.update-service.xyz): query: MFZGC3TBNVSA.data.update-service.xyz IN TXT + (8.8.8.8)',
      enrichment: {
        aiAnalysis: "Statistical analysis of DNS queries from host 10.0.6.30 reveals patterns consistent with DNS tunneling. Key indicators include: high volume of TXT record queries, encoded subdomain labels, and high entropy in query labels.",
        iocType: "DNS Tunneling",
        threatIntel: "Domain update-service[.]xyz registered via NameCheap with WHOIS privacy. Domain age: 2 days. No legitimate services associated.",
        recommendation: "1. Block the suspicious domain at DNS resolver level. 2. Implement DNS query length restrictions. 3. Deploy DNS analytics for entropy-based detection. 4. Investigate host 10.0.6.30 for malware. 5. Review DNS logs for additional tunneling domains.",
        confidence: 73, relatedCves: [],
        geoLocation: { country: "Romania", city: "Bucharest" }, asnInfo: "AS9009 - M247 Europe SRL",
      },
    },
    {
      id: "ALR-008", timestamp: h(5), source: "Firewall-01", sourceIp: "10.0.1.100", destIp: "10.0.1.101",
      severity: "medium", title: "Lateral Movement - SMB Admin Share Access",
      description: "Internal host accessing admin shares on multiple hosts using service account credentials.",
      yaraMatch: null, mitreTactic: "Lateral Movement", mitreTechnique: "T1021.002 - Remote Services: SMB/Windows Admin Shares", status: "investigating",
      rawLog: 'Feb 15 05:42:00 DC-01 Microsoft-Windows-Security-Auditing[5140]: A network share object was accessed. Subject: Security ID: CORP\\svc_backup, Account Name: svc_backup, Share Name: \\\\*\\C$, Source Address: 10.0.1.100',
      enrichment: {
        aiAnalysis: "Host 10.0.1.100 has been observed accessing administrative shares (C$ and ADMIN$) on 12 internal hosts within the past hour using the service account svc_backup. The access pattern deviates from normal behavior and is consistent with lateral movement following credential compromise.",
        iocType: "Lateral Movement",
        threatIntel: "Abuse of service accounts for lateral movement is a hallmark of human-operated ransomware attacks.",
        recommendation: "1. Rotate svc_backup service account credentials. 2. Restrict admin share access to backup schedule windows. 3. Investigate the 3 hosts with PsExec artifacts. 4. Implement privileged access management for service accounts. 5. Enable enhanced logging on all accessed hosts.",
        confidence: 84, relatedCves: [], geoLocation: null, asnInfo: null,
      },
    },
    {
      id: "ALR-009", timestamp: h(8), source: "WAF-01", sourceIp: "45.33.32.156", destIp: "10.0.3.200",
      severity: "low", title: "Web Application Scanner Detected",
      description: "Automated vulnerability scanning detected from external IP. Nikto/OWASP ZAP signatures identified.",
      yaraMatch: null, mitreTactic: "Reconnaissance", mitreTechnique: "T1595.002 - Active Scanning: Vulnerability Scanning", status: "resolved",
      rawLog: 'Feb 15 02:42:00 waf-01 modsecurity: [id "920350"] [msg "Nikto Web App Scanner Detected"] [data "nikto/2.5.0"] [severity "WARNING"] [uri "/admin/config.php"] [unique_id "def456"]',
      enrichment: {
        aiAnalysis: "Automated web vulnerability scanning has been detected originating from IP 45.33.32.156. The scanning tool has been identified as Nikto v2.5.0. All attack attempts were blocked by the WAF.",
        iocType: "Reconnaissance",
        threatIntel: "IP 45.33.32.156 is associated with scanme.nmap.org and is commonly used for security research. Low threat level.",
        recommendation: "1. Continue monitoring for follow-up targeted attacks. 2. Review WAF effectiveness. 3. Consider rate-limiting the source IP.",
        confidence: 95, relatedCves: [],
        geoLocation: { country: "United States", city: "San Francisco" }, asnInfo: "AS63949 - Linode LLC",
      },
    },
    {
      id: "ALR-010", timestamp: h(10), source: "Sysmon-Agent-22", sourceIp: "10.0.7.50", destIp: "N/A",
      severity: "low", title: "Scheduled Task Created for Persistence",
      description: "New scheduled task created via schtasks.exe with suspicious parameters on developer workstation.",
      yaraMatch: null, mitreTactic: "Persistence", mitreTechnique: "T1053.005 - Scheduled Task/Job: Scheduled Task", status: "false_positive",
      rawLog: 'Feb 15 00:42:00 dev-050 Sysmon[EventID:1]: Process Create: schtasks /create /tn "SystemHealthCheck" /tr "powershell.exe -File C:\\ProgramData\\Microsoft\\Health\\check.ps1" /sc onstart /ru SYSTEM',
      enrichment: {
        aiAnalysis: "A new scheduled task named 'SystemHealthCheck' was created on workstation DEV-050. Investigation revealed this is a legitimate monitoring script deployed by the IT automation team.",
        iocType: "Persistence Mechanism",
        threatIntel: "Scheduled tasks are commonly used for persistence. However, this instance has been confirmed as authorized IT activity.",
        recommendation: "1. Document the IT automation deployment in change management. 2. Ensure proper script signing policies are enforced. 3. Close alert as false positive.",
        confidence: 98, relatedCves: [], geoLocation: null, asnInfo: null,
      },
    },
    {
      id: "ALR-011", timestamp: h(12), source: "Mail-Gateway", sourceIp: "192.0.2.100", destIp: "10.0.8.10",
      severity: "info", title: "Phishing Email Quarantined",
      description: "Email with malicious attachment quarantined by mail gateway. Macro-enabled document detected.",
      yaraMatch: "OLE_Macro_Suspicious", mitreTactic: "Initial Access",
      mitreTechnique: "T1566.001 - Phishing: Spearphishing Attachment", status: "resolved",
      rawLog: 'Feb 14 22:42:00 mail-gw-01 postfix/smtpd[12345]: NOQUEUE: quarantine: Malicious attachment detected (OLE_Macro_Suspicious) - From: billing@quickb00ks-support.com',
      enrichment: {
        aiAnalysis: "A phishing email targeting the finance department was intercepted. The email contained a macro-enabled Excel attachment. This is part of a broader campaign targeting financial services organizations.",
        iocType: "Phishing",
        threatIntel: "Campaign IOCs match the QakBot distribution network which has been resurging since January 2026.",
        recommendation: "1. Verify no similar emails bypassed the gateway. 2. Block the sender domain. 3. Update phishing awareness training. 4. Submit the attachment hash to VirusTotal.",
        confidence: 99, relatedCves: [],
        geoLocation: { country: "Nigeria", city: "Lagos" }, asnInfo: "AS37560 - Cynergy Business Solutions",
      },
    },
    {
      id: "ALR-012", timestamp: h(14), source: "Cloud-Trail", sourceIp: "54.239.28.85", destIp: "N/A",
      severity: "info", title: "AWS IAM Policy Change Detected",
      description: "Administrative IAM policy modification detected. New inline policy attached to service role.",
      yaraMatch: null, mitreTactic: "Privilege Escalation", mitreTechnique: "T1078.004 - Valid Accounts: Cloud Accounts", status: "resolved",
      rawLog: '{"eventVersion":"1.08","eventTime":"2026-02-14T16:42:00Z","eventSource":"iam.amazonaws.com","eventName":"PutRolePolicy","awsRegion":"us-east-1","sourceIPAddress":"54.239.28.85"}',
      enrichment: {
        aiAnalysis: "An IAM policy change was detected in the production AWS account. The change appears to be part of the scheduled data pipeline deployment documented in change request CR-2026-0215.",
        iocType: "Cloud Configuration",
        threatIntel: "IAM privilege escalation is the #1 cloud attack vector. However, this change appears authorized.",
        recommendation: "1. Verify the change aligns with CR-2026-0215. 2. Ensure least-privilege principles are maintained. 3. Document the policy change in the IAM audit log.",
        confidence: 95, relatedCves: [],
        geoLocation: { country: "United States", city: "Portland" }, asnInfo: "AS16509 - Amazon.com Inc.",
      },
    },
  ]

  const alertStmt = database.prepare(
    "INSERT INTO alerts (id, timestamp, source, source_ip, dest_ip, severity, title, description, yara_match, mitre_tactic, mitre_technique, status, incident_status, verdict, raw_log) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
  const enrichStmt = database.prepare(
    "INSERT INTO alert_enrichments (alert_id, ai_analysis, ioc_type, threat_intel, recommendation, confidence, ai_score, heuristics_score, related_cves, geo_country, geo_city, asn_info) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )

  for (const a of alertsData) {
    alertStmt.run([
      a.id, a.timestamp, a.source, a.sourceIp, a.destIp, a.severity,
      a.title, a.description, a.yaraMatch, a.mitreTactic, a.mitreTechnique,
      a.status,
      a.status === "investigating" ? "in_progress" : a.status === "resolved" ? "resolved" : "unassigned",
      a.status === "false_positive" ? "false_positive" : "suspicious",
      a.rawLog,
    ])
    enrichStmt.run([
      a.id, a.enrichment.aiAnalysis, a.enrichment.iocType, a.enrichment.threatIntel,
      a.enrichment.recommendation, a.enrichment.confidence, a.enrichment.confidence, a.enrichment.confidence,
      JSON.stringify(a.enrichment.relatedCves),
      a.enrichment.geoLocation?.country ?? null,
      a.enrichment.geoLocation?.city ?? null,
      a.enrichment.asnInfo,
    ])
  }
  alertStmt.free()
  enrichStmt.free()
}
