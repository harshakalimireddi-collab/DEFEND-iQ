export type Severity = "critical" | "high" | "medium" | "low" | "info"
export type IncidentStatus = "unassigned" | "in_progress" | "resolved"
export type AlertVerdict = "malicious" | "suspicious" | "false_positive"
export type LLMProvider = "openai" | "anthropic" | "local" | "custom"
export type LLMAgentId = "triage" | "ioc_detection" | "threat_intel" | "response" | "summary_header"

export interface LLMAgentConfig {
  id: LLMAgentId | string
  name: string
  description?: string
  enabled: boolean
  model: string
  prompt: string
  maxTokens?: number
  temperature?: number
}

export interface SigmaMatchDetail {
  selection: string
  field: string
  operator: string
  expected: string
  actual: string
}

export interface SigmaMatch {
  ruleId?: string
  title?: string
  level?: string
  description?: string
  author?: string
  status?: string
  references?: string[]
  tags?: string[]
  logsource?: Record<string, string>
  condition?: string
  selections?: string[]
  matchDetails?: SigmaMatchDetail[]
  source?: string
}

export interface ThreatIntelVendorResult {
  vendor: string
  indicator: string
  indicatorType: "ip" | "domain" | "url" | "hash"
  hit: boolean
  clean: boolean
  result: string
  error?: boolean
}

export interface AlertEnrichment {
  aiAnalysis: string
  aiSummaryShort?: string
  iocType: string
  threatIntel: string
  recommendation: string
  aiScore: number
  heuristicsScore: number
  confidence?: number
  relatedCves: string[]
  geoLocation: { country: string; city: string } | null
  asnInfo: string | null
  parseConfidence?: number
  extractedFields?: Record<string, unknown>
  fieldConfidence?: Record<string, number>
  verdictReason?: string
  verdictFactors?: Record<string, unknown>
  sigma?: SigmaMatch | null
  threatIntelVendors?: ThreatIntelVendorResult[]
}

export interface Alert {
  id: string
  timestamp: string
  ingestedAt: string
  lastAnalyzedAt?: string
  source: string
  sourceIp: string
  destIp: string
  severity: Severity
  title: string
  description: string
  yaraMatch: string | null
  mitreTactic: string
  mitreTechnique: string
  incidentStatus: IncidentStatus
  verdict: AlertVerdict
  enrichment: AlertEnrichment
  rawLog: string
}

export interface LogEntry {
  id: string
  timestamp: string
  source: string
  message: string
  severity: Severity
  parsed: boolean
}

export interface Settings {
  general: { instanceName: string; retentionDays: number }
  syslog: { enabled: boolean; port: number; protocol: "udp" | "tcp" | "both"; tls: boolean }
  api: { enabled: boolean; port: number; apiKey: string }
  llm: {
    provider: LLMProvider
    apiKey: string
    model: string
    endpoint: string
    maxTokens: number
    temperature: number
    autoEnrich: boolean
    analysisAgents?: number
    autoStatusConfidenceThreshold?: number
    verdictMaliciousThreshold?: number
    verdictSuspiciousThreshold?: number
    fpAutoResolveThreshold?: number
    neverAutoResolveLowEvidence?: boolean
    minAutoResolveEvidence?: number
    agents?: LLMAgentConfig[]
    sourceThresholds?: Record<string, {
      maliciousThreshold?: number
      suspiciousThreshold?: number
      fpAutoResolveThreshold?: number
      minAutoResolveEvidence?: number
    }>
  }
  yara: { enabled: boolean; autoUpdate: boolean }
  sigma: {
    enabled: boolean
    rulesPath: string
    maxRules: number
    lastSyncAt?: string
    lastSyncStatus?: "success" | "error"
    lastSyncError?: string
  }
  pipeline: {
    fieldConfidenceThreshold: number
  }
  syslogOutput: { enabled: boolean; host: string; port: number; format: "cef" | "leef" | "json" }
}

export interface YaraRule {
  id: string
  name: string
  content: string
  enabled: boolean
}

export interface ThreatFeed {
  id: string
  name: string
  url: string
  apiKey: string
  enabled: boolean
}

export type UserRole = "admin" | "analyst" | "client"

export interface UserAccount {
  id: string
  username: string
  role: UserRole
  createdAt: string
}

export interface AlertNote {
  id: string
  alertId: string
  username: string
  noteText: string
  imageData?: string | null
  imageMime?: string | null
  createdAt: string
}
