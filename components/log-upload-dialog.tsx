"use client"

import { useState, useCallback } from "react"
import {
  Upload,
  FileText,
  Loader2,
  X,
  CheckCircle,
  ShieldAlert,
  Terminal,
  Zap,
  ArrowRight,
  Sparkles,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { submitAttackAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface LogUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PRESET_SCENARIOS = [
  {
    title: "Military Drone C2 Hijack",
    source: "Tactical-UAV-Link-04",
    severity: "critical" as const,
    description: "Malicious Cobalt Strike beacon callback on UAV ground control station.",
    payload: "DROP: SRC=45.155.205.233 DST=10.0.1.50 PROTO=TCP SPT=443 DPT=8443 - Matched rule: Cobalt Strike beacon callback detected on UAV ground station link - C2 exfiltration attempt",
  },
  {
    title: "Air Defense Radar DDoS Attack",
    source: "Air-Defense-Perimeter-WAF",
    severity: "high" as const,
    description: "SYN flood & scanner reconnaissance targeting radar control telemetry.",
    payload: "ALERT: Volumetric SYN Flood detected: 142,000 pkts/sec targeting Radar-Telemetry port 8080 from botnet cluster 185.220.101.0/24 - CPU threshold 98%",
  },
  {
    title: "Defense HQ LSASS Credential Dump",
    source: "Military-HQ-EDR",
    severity: "critical" as const,
    description: "Mimikatz LSASS process injection targeting classified admin credentials.",
    payload: "ALERT mimikatz sekurlsa lsass dump: procdump64.exe -ma lsass.exe C:\\Users\\Public\\lsass.dmp EventID=10 GrantedAccess=0x1fffff user=CORP\\commander src=10.0.2.88",
  },
  {
    title: "Tactical Logistics SQL Injection",
    source: "Defense-Logistics-DB",
    severity: "high" as const,
    description: "SQL injection extracting sensitive military convoy & munitions records.",
    payload: "ModSecurity: SQL Injection attack detected uri=/api/v2/munitions?id=1 UNION SELECT 1,2,username,password,clearance_level FROM military_personnel-- src=203.0.113.77 status=403",
  },
  {
    title: "Command Center Ransomware Lock",
    source: "Command-Node-07",
    severity: "critical" as const,
    description: "LockBit mass encryption detected on tactical operations server.",
    payload: "Ransomware: 4,120 classified operational files renamed with .lockbit extension in 45sec proc=tactical_update.exe user=admin - files encrypted bitcoin ransom note dropped",
  },
]

export function LogUploadDialog({ open, onOpenChange }: LogUploadDialogProps) {
  const [activeTab, setActiveTab] = useState<string>("paste")
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [createdAlertId, setCreatedAlertId] = useState<string | null>(null)
  const [result, setResult] = useState<{ logCount: number; alertCount: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Direct paste state
  const [source, setSource] = useState("Defense-Tactical-Sensor")
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
      setError("Please enter attack logs or incident telemetry.")
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

  const resetModal = () => {
    setResult(null)
    setError(null)
    setCreatedAlertId(null)
    setAttackPayload("")
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground rounded-xl w-full max-w-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground tracking-tight">
                Defense Cyber Attack Submission & Analysis Portal
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Submit raw telemetry, incident dumps, or attack logs for instant AI threat intelligence
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onOpenChange(false)
              resetModal()
            }}
            className="p-1.5 rounded-md hover:bg-foreground/10 transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {result && createdAlertId ? (
            <div className="flex flex-col items-center justify-center py-6 text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Cyber Attack Successfully Ingested & Analyzed!</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-md">
                  The AI pipeline, YARA/Sigma rules, and threat feeds correlated this event into a structured threat intelligence report.
                </p>
              </div>

              <div className="flex items-center gap-3 mt-2">
                <Button
                  size="sm"
                  onClick={() => {
                    onOpenChange(false)
                    resetModal()
                    router.push(`/dashboard/alerts/${createdAlertId}`)
                  }}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs h-9 px-4 flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  View Deep-Dive Threat Intelligence ➔
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetModal}
                  className="text-xs h-9 border-border/60"
                >
                  Submit Another Attack
                </Button>
              </div>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-3 w-full mb-5 bg-muted/40 p-1">
                <TabsTrigger value="paste" className="text-xs flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5" />
                  Direct Attack Telemetry
                </TabsTrigger>
                <TabsTrigger value="upload" className="text-xs flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5" />
                  Upload Log/PCAP File
                </TabsTrigger>
                <TabsTrigger value="presets" className="text-xs flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5" />
                  Defense Scenarios (Demo)
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: Direct Attack Submission */}
              <TabsContent value="paste" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground font-medium">Defense Unit / Source</Label>
                    <Input
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      placeholder="e.g. Air-Defense-Grid-Sensor-01"
                      className="h-8 text-xs font-mono bg-background/60 border-border/60"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground font-medium">Reported Severity</Label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as typeof severity)}
                      className="h-8 rounded-md border border-border/60 bg-background/60 px-2.5 text-xs text-foreground focus:outline-none font-medium"
                    >
                      <option value="critical">Critical (Immediate Action)</option>
                      <option value="high">High (Active Threat)</option>
                      <option value="medium">Medium (Suspicious Anomaly)</option>
                      <option value="low">Low (Reconnaissance)</option>
                      <option value="info">Info (Audit Log)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground font-medium">
                      Attack Log / Malicious Command / Telemetry
                    </Label>
                    <span className="text-[10px] text-muted-foreground/60">Supports raw logs, syslog, commands, URLs, IPs</span>
                  </div>
                  <Textarea
                    value={attackPayload}
                    onChange={(e) => setAttackPayload(e.target.value)}
                    placeholder="Paste attack command trace, firewall breach log, malicious IP traffic, SQLi payload, or incident summary...&#10;&#10;Example: DROP: SRC=45.155.205.233 DST=10.0.1.50 - Cobalt Strike beacon callback detected"
                    className="h-32 text-xs font-mono bg-background/60 border-border/60 resize-none leading-relaxed"
                  />
                </div>

                <Button
                  onClick={handleDirectSubmit}
                  disabled={uploading || !attackPayload.trim()}
                  className="w-full h-9 bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Analyzing Attack with AI & Threat Intel...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Analyze Cyber Attack with AI
                    </>
                  )}
                </Button>
              </TabsContent>

              {/* TAB 2: File Upload */}
              <TabsContent value="upload" className="space-y-4">
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    dragOver
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:border-primary/40 bg-muted/5"
                  }`}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-7 h-7 text-primary animate-spin" />
                      <p className="text-xs font-medium text-foreground">Processing and correlating attack files...</p>
                      <p className="text-[10px] text-muted-foreground">Evaluating Sigma rules, YARA signatures, and AI models</p>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-2.5 cursor-pointer">
                      <div className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/70">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">
                          Drop attack file here or <span className="text-primary underline">browse</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Supports <code>.csv</code>, <code>.json</code>, <code>.log</code>, <code>.txt</code>, <code>.ndjson</code>
                        </p>
                      </div>
                      <input
                        type="file"
                        accept=".csv,.json,.log,.txt,.ndjson"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/20 p-3 rounded-lg border border-border/30">
                  <FileText className="w-4 h-4 shrink-0 text-muted-foreground/70" />
                  <span>
                    Upload firewall captures, SIEM dumps, endpoint EDR exports, or network traffic dumps.
                  </span>
                </div>
              </TabsContent>

              {/* TAB 3: Defense Scenarios */}
              <TabsContent value="presets" className="space-y-3">
                <p className="text-xs text-muted-foreground mb-2">
                  Select a realistic military/defense cyber attack scenario to test instant AI threat analysis:
                </p>
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
                  {PRESET_SCENARIOS.map((preset, i) => (
                    <div
                      key={i}
                      onClick={() => handleApplyPreset(preset)}
                      className="group p-3 rounded-lg border border-border/50 bg-background/50 hover:bg-muted/20 hover:border-primary/50 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                            {preset.title}
                          </span>
                          <span className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded border ${
                            preset.severity === "critical"
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}>
                            {preset.severity}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{preset.description}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}

          {error && (
            <div className="mt-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-400 font-medium">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
