"use client"

import { useState, useCallback } from "react"
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  ShieldAlert,
  Terminal,
  Zap,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Clock,
  Radio,
  Cpu,
  Shield,
  FileCode,
  Layers,
  Copy,
  Check,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { submitAttackAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Alert } from "@/lib/types"
import { SeverityBadge } from "@/components/severity-badge"
import { VerdictBadge } from "@/components/verdict-badge"
import Link from "next/link"

const PRESET_SCENARIOS = [
  {
    title: "Military Drone C2 Hijack",
    source: "Tactical-UAV-Link-04",
    severity: "critical" as const,
    tactic: "Command and Control (TA0011)",
    description: "Malicious Cobalt Strike beacon callback detected on UAV ground station satellite link.",
    payload: "DROP: SRC=45.155.205.233 DST=10.0.1.50 PROTO=TCP SPT=443 DPT=8443 - Matched rule: Cobalt Strike beacon callback detected on UAV ground station link - C2 exfiltration attempt",
  },
  {
    title: "Air Defense Radar DDoS Attack",
    source: "Air-Defense-Perimeter-WAF",
    severity: "high" as const,
    tactic: "Impact / Denial of Service (TA0040)",
    description: "Volumetric SYN flood & scanner reconnaissance targeting radar telemetry port 8080.",
    payload: "ALERT: Volumetric SYN Flood detected: 142,000 pkts/sec targeting Radar-Telemetry port 8080 from botnet cluster 185.220.101.0/24 - CPU threshold 98%",
  },
  {
    title: "Defense HQ LSASS Credential Dump",
    source: "Military-HQ-EDR",
    severity: "critical" as const,
    tactic: "Credential Access (TA0006)",
    description: "Mimikatz LSASS process memory dump extracting military administrator hashes.",
    payload: "ALERT mimikatz sekurlsa lsass dump: procdump64.exe -ma lsass.exe C:\\Users\\Public\\lsass.dmp EventID=10 GrantedAccess=0x1fffff user=CORP\\commander src=10.0.2.88",
  },
  {
    title: "Tactical Logistics SQL Injection",
    source: "Defense-Logistics-DB",
    severity: "high" as const,
    tactic: "Initial Access & Exfiltration (TA0001)",
    description: "SQL injection payload extracting classified munitions and troop movement schedules.",
    payload: "ModSecurity: SQL Injection attack detected uri=/api/v2/munitions?id=1 UNION SELECT 1,2,username,password,clearance_level FROM military_personnel-- src=203.0.113.77 status=403",
  },
  {
    title: "Command Center Ransomware Lock",
    source: "Command-Node-07",
    severity: "critical" as const,
    tactic: "Impact & Encryption (TA0040)",
    description: "LockBit 3.0 mass encryption process detected on tactical operations server.",
    payload: "Ransomware: 4,120 classified operational files renamed with .lockbit extension in 45sec proc=tactical_update.exe user=admin - files encrypted bitcoin ransom note dropped",
  },
]

export function ClientUploadView({ recentSubmissions }: { recentSubmissions: Alert[] }) {
  const [activeTab, setActiveTab] = useState<string>("paste")
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [createdAlertId, setCreatedAlertId] = useState<string | null>(null)
  const [result, setResult] = useState<{ logCount: number; alertCount: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedSample, setCopiedSample] = useState(false)

  // Form State
  const [source, setSource] = useState("Defense-Tactical-Sensor-01")
  const [severity, setSeverity] = useState<"critical" | "high" | "medium" | "low" | "info">("high")
  const [attackPayload, setAttackPayload] = useState("")

  const router = useRouter()

  const handleFile = useCallback(
    async (file: File) => {
      setUploading(true)
      setError(null)
      setResult(null)
      setCreatedAlertId(null)

      try {
        const formData = new FormData()
        formData.append("file", file)

        const res = await fetch("/api/v1/upload", { method: "POST", body: formData })
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || "Upload failed")
        } else {
          setResult({ logCount: data.logCount, alertCount: data.alertCount })
          router.refresh()
        }
      } catch {
        setError("Network error during upload")
      } finally {
        setUploading(false)
      }
    },
    [router]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleDirectSubmit = async () => {
    if (!attackPayload.trim()) {
      setError("Please enter attack logs, suspicious PCAP telemetry, or an incident string.")
      return
    }

    setUploading(true)
    setError(null)
    setResult(null)
    setCreatedAlertId(null)

    try {
      const res = await submitAttackAction({
        source: source.trim() || "Defense-Tactical-Sensor",
        message: attackPayload.trim(),
        severity,
      })

      if (res.success && res.alertId) {
        setCreatedAlertId(res.alertId)
        setResult({ logCount: 1, alertCount: 1 })
        router.refresh()
      } else {
        setError(res.error || "Failed to analyze attack telemetry.")
      }
    } catch {
      setError("An unexpected error occurred while analyzing attack.")
    } finally {
      setUploading(false)
    }
  }

  const handleApplyPreset = (preset: (typeof PRESET_SCENARIOS)[0]) => {
    setSource(preset.source)
    setSeverity(preset.severity)
    setAttackPayload(preset.payload)
    setActiveTab("paste")
  }

  const loadSampleTelemetry = () => {
    const sample = PRESET_SCENARIOS[0]
    setSource(sample.source)
    setSeverity(sample.severity)
    setAttackPayload(sample.payload)
    setCopiedSample(true)
    setTimeout(() => setCopiedSample(false), 2000)
  }

  const resetForm = () => {
    setResult(null)
    setError(null)
    setCreatedAlertId(null)
    setAttackPayload("")
  }

  const severityColor =
    severity === "critical"
      ? "text-red-400 bg-red-500/10 border-red-500/30"
      : severity === "high"
      ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
      : severity === "medium"
      ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
      : "text-blue-400 bg-blue-500/10 border-blue-500/30"

  return (
    <div className="p-6 md:p-8 flex flex-col gap-6 max-w-[1500px] mx-auto">
      {/* ─────────────────── PAGE HEADER ─────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
              DEFEND iQ INGESTION MATRIX
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight font-sans">
              Cyber Attack Ingestion & Telemetry Center
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Submit intercepted network logs, suspicious PCAP telemetry, or command traces for instant multi-agent AI threat classification
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#080d1a] border border-slate-800 text-xs text-slate-300 font-mono">
            <Radio className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span>AI Pipeline: Ready</span>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => router.refresh()}
            className="text-xs h-8 gap-1.5 bg-[#0a1020] border-slate-800 hover:bg-slate-800 text-slate-300"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ─────────────────── MAIN INGESTION WORKSTATION ─────────────────── */}
      <div className="rounded-2xl bg-[#080d1a]/95 backdrop-blur-2xl border border-slate-800/90 shadow-[0_0_40px_rgba(0,0,0,0.4)] p-6 flex flex-col gap-6">
        {result && createdAlertId ? (
          /* ───────── SUCCESS SCREEN WITH DIRECT DOSSIER LINK ───────── */
          <div className="flex flex-col items-center justify-center py-10 text-center gap-5 bg-[#060a14] rounded-xl border border-emerald-500/40 p-8 shadow-[0_0_30px_rgba(34,197,94,0.15)]">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
              <CheckCircle className="w-9 h-9" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Cyber Attack Successfully Ingested & Analyzed!
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-lg leading-relaxed">
                The telemetry was correlated through YARA malware signatures, Sigma detection rules, Threat Intelligence feeds, and Multi-Agent AI enrichment.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
              <Button
                onClick={() => router.push(`/dashboard/alerts/${createdAlertId}`)}
                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-semibold text-xs h-10 px-6 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.4)] flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                View Deep-Dive Threat Intelligence Dossier ➔
              </Button>
              <Button
                variant="outline"
                onClick={resetForm}
                className="text-xs h-10 px-4 rounded-xl border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-300"
              >
                Submit Another Attack
              </Button>
            </div>
          </div>
        ) : (
          /* ───────── INGESTION TABS ───────── */
          <div className="w-full flex flex-col gap-5">
            {/* Segmented Tab Switcher (Pixel-Perfect Alignment) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1.5 bg-[#060a14] rounded-xl border border-slate-800/80 shadow-inner">
              <button
                type="button"
                onClick={() => setActiveTab("paste")}
                className={`py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer ${
                  activeTab === "paste"
                    ? "bg-slate-800/95 text-white shadow-[0_2px_10px_rgba(0,0,0,0.5)] border border-blue-500/50"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border border-transparent"
                }`}
              >
                <Terminal className={`w-4 h-4 ${activeTab === "paste" ? "text-blue-400" : "text-slate-400"}`} />
                <span>1. Direct Attack Telemetry</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className={`py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer ${
                  activeTab === "upload"
                    ? "bg-slate-800/95 text-white shadow-[0_2px_10px_rgba(0,0,0,0.5)] border border-indigo-500/50"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border border-transparent"
                }`}
              >
                <Upload className={`w-4 h-4 ${activeTab === "upload" ? "text-indigo-400" : "text-slate-400"}`} />
                <span>2. Upload PCAP / Log File</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("presets")}
                className={`py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer ${
                  activeTab === "presets"
                    ? "bg-slate-800/95 text-white shadow-[0_2px_10px_rgba(0,0,0,0.5)] border border-purple-500/50"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border border-transparent"
                }`}
              >
                <Zap className={`w-4 h-4 ${activeTab === "presets" ? "text-purple-400" : "text-slate-400"}`} />
                <span>3. Defense Scenarios (SIH Demos)</span>
              </button>
            </div>

            {/* ───────── TAB 1: DIRECT TELEMETRY PASTE ───────── */}
            {activeTab === "paste" && (
              <div className="space-y-5 animate-in fade-in-50 duration-200">
                {/* Telemetry Origin & Severity Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-blue-400" />
                      Defense Sensor / Telemetry Origin
                    </Label>
                    <Input
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      placeholder="e.g. Tactical-Radar-Node-01, Drone-Link, Perimeter-WAF"
                      className="h-10 text-xs font-mono bg-[#060a14] border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      Reported Threat Level
                    </Label>
                    <div className="flex items-center gap-2">
                      <select
                        value={severity}
                        onChange={(e) => setSeverity(e.target.value as typeof severity)}
                        className="h-10 flex-1 rounded-xl border border-slate-800 bg-[#060a14] px-3 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 font-medium cursor-pointer"
                      >
                        <option value="critical">Critical (Immediate Attack Vector)</option>
                        <option value="high">High (Active Unauthorized Intrusion)</option>
                        <option value="medium">Medium (Suspicious Probe / Anomaly)</option>
                        <option value="low">Low (Reconnaissance / Scanner)</option>
                        <option value="info">Info (Audit Log Telemetry)</option>
                      </select>
                      <span className={`px-2.5 py-2 rounded-xl text-[10px] uppercase font-mono font-bold border ${severityColor}`}>
                        {severity}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Terminal Code Editor Container */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-blue-400" />
                      <Label className="text-xs font-semibold text-slate-300">
                        Raw Attack Telemetry / Command Log Stream
                      </Label>
                    </div>

                    <button
                      type="button"
                      onClick={loadSampleTelemetry}
                      className="text-[11px] font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedSample ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Sample Loaded</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Load Sample Payload</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* macOS / Terminal styled code frame */}
                  <div className="rounded-xl border border-slate-800 overflow-hidden bg-[#050811] shadow-inner">
                    {/* Terminal Titlebar */}
                    <div className="flex items-center justify-between px-3.5 py-2 bg-[#080d1a] border-b border-slate-800/80 text-[11px] font-mono text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                        <span className="ml-2 text-slate-300">stream-input.log</span>
                      </div>
                      <span className="text-[10px] text-slate-500">Syslog / PowerShell / Bash / Suricata / Snort</span>
                    </div>

                    <Textarea
                      value={attackPayload}
                      onChange={(e) => setAttackPayload(e.target.value)}
                      placeholder="Paste raw attack logs, command traces, firewall drops, SQLi payloads, or Cobalt Strike beacon callbacks...&#10;&#10;Example: DROP: SRC=45.155.205.233 DST=10.0.1.50 - Cobalt Strike beacon callback detected on UAV ground station link"
                      className="h-40 text-xs font-mono bg-transparent border-0 rounded-none text-slate-200 placeholder:text-slate-600 resize-none leading-relaxed p-4 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>

                {/* Ingest CTA Button */}
                <Button
                  onClick={handleDirectSubmit}
                  disabled={uploading || !attackPayload.trim()}
                  className="w-full h-11 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-[0_0_25px_rgba(79,70,229,0.35)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Correlating Attack with Multi-Agent AI Engine...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>⚡ Ingest & Analyze Cyber Attack with AI Copilot</span>
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* ───────── TAB 2: FILE UPLOAD ───────── */}
            {activeTab === "upload" && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 ${
                    dragOver
                      ? "border-blue-500 bg-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.2)]"
                      : "border-slate-800 hover:border-blue-500/50 bg-[#060a14]/60"
                  }`}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-9 h-9 text-blue-400 animate-spin" />
                      <p className="text-sm font-bold text-white">
                        Processing and parsing attack telemetry dump...
                      </p>
                      <p className="text-xs text-slate-400">
                        Evaluating Sigma rules, YARA malware signatures, and threat intelligence feeds
                      </p>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-3 cursor-pointer">
                      <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-md">
                        <Upload className="w-7 h-7" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">
                          Drag and drop your attack file here or <span className="text-blue-400 underline">browse</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Supported formats: <code>.pcap</code>, <code>.log</code>, <code>.csv</code>, <code>.json</code>, <code>.ndjson</code>, <code>.txt</code>
                        </p>
                      </div>
                      <input
                        type="file"
                        accept=".csv,.json,.log,.txt,.ndjson,.pcap"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 bg-[#060a14] p-3.5 rounded-xl border border-slate-800">
                  <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>
                    Defense data is processed securely in memory and correlated in real-time with zero external leaks.
                  </span>
                </div>
              </div>
            )}

            {/* ───────── TAB 3: DEFENSE SCENARIOS (SIH DEMOS) ───────── */}
            {activeTab === "presets" && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <p className="text-xs text-slate-400">
                  Select a pre-configured military/defense cyber incident to simulate real-time detection for your Smart India Hackathon presentation:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {PRESET_SCENARIOS.map((preset, i) => (
                    <div
                      key={i}
                      onClick={() => handleApplyPreset(preset)}
                      className="group p-4 rounded-xl border border-slate-800 bg-[#060a14] hover:bg-[#091022] hover:border-blue-500/50 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                          {preset.title}
                        </span>
                        <span
                          className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded font-bold border ${
                            preset.severity === "critical"
                              ? "bg-red-500/10 text-red-400 border-red-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {preset.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                        {preset.description}
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[10px] font-mono text-slate-500">
                        <span>{preset.tactic}</span>
                        <div className="flex items-center gap-1 text-blue-400 font-semibold group-hover:translate-x-1 transition-transform">
                          <span>Load Attack</span>
                          <ArrowRight className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-400 font-medium">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ─────────────────── RECENT SUBMISSIONS TABLE ─────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
              Recently Ingested Cyber Attacks & Telemetry
            </h2>
          </div>
          <Link
            href="/dashboard/alerts"
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
          >
            View All in SOC Triage Queue ➔
          </Link>
        </div>

        <div className="rounded-xl overflow-hidden border border-slate-800 bg-[#080d1a] shadow-lg">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800/80 bg-[#0a1020] text-[11px] font-mono text-slate-400">
                <th className="px-4 py-3 font-semibold">Severity</th>
                <th className="px-4 py-3 font-semibold">Incident Title</th>
                <th className="px-4 py-3 font-semibold">Sensor / Origin</th>
                <th className="px-4 py-3 font-semibold">Verdict</th>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold text-right">Investigation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-xs">
              {recentSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No cyber attacks uploaded yet. Use the console above to submit your first attack.
                  </td>
                </tr>
              ) : (
                recentSubmissions.slice(0, 6).map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3.5">
                      <SeverityBadge severity={alert.severity} />
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-200">
                      <Link href={`/dashboard/alerts/${alert.id}`} className="hover:text-blue-400 transition-colors">
                        {alert.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-400 text-[11px]">
                      {alert.source}
                    </td>
                    <td className="px-4 py-3.5">
                      <VerdictBadge verdict={alert.verdict} />
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-400 text-[11px]">
                      {new Date(alert.timestamp).toLocaleTimeString("en-US", { hour12: false })}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/dashboard/alerts/${alert.id}`}
                        className="text-xs text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-1"
                      >
                        <span>Dossier</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
