"use client"

import type { Alert, IncidentStatus, AlertVerdict, ThreatIntelVendorResult, AlertNote } from "@/lib/types"
import type { YaraRuleResult } from "@/lib/yara"
import { SeverityBadge } from "@/components/severity-badge"
import { StatusBadge } from "@/components/status-badge"
import { VerdictBadge } from "@/components/verdict-badge"
import {
  Brain,
  Shield,
  Globe,
  Server,
  FileCode,
  Terminal,
  Target,
  Lightbulb,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  ChevronDown,
  ChevronUp,
  Cpu,
  ShieldCheck,
  DatabaseZap,
  Zap,
  Network,
  Hash,
  ShieldBan,
  ShieldOff,
  ExternalLink,
  MessageSquare,
  ImagePlus,
} from "lucide-react"
import { useState, useTransition, useMemo, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  deleteAlertAction,
  updateAlertIncidentStatusAction,
  updateAlertVerdictAction,
  getYaraDetailsAction,
  getAlertNotesAction,
  addAlertNoteAction,
} from "@/app/actions"
import { CombinedScoreDisplay } from "@/components/score-ring"
import { extractStructuredFields, getDisplayFields } from "@/lib/ingestion/structured-fields"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"

interface PipelineSettings {
  sigmaEnabled: boolean
  yaraEnabled: boolean
  llmConfigured: boolean
  llmProvider: string
  llmModel: string
  analysisAgents: number
  activeThreatFeeds: number
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="p-1 rounded hover:bg-foreground/10 transition-colors text-muted-foreground hover:text-foreground"
      aria-label="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

// ──────────────────────────────────────────────────────────────────
// Pipeline Status Panel
// ──────────────────────────────────────────────────────────────────

type CheckStatus = "ok" | "match" | "no_match" | "skipped" | "pending" | "error" | "disabled" | "running" | "queued"

interface PipelineCheck {
  id: string
  label: string
  icon: typeof CheckCircle2
  status: CheckStatus
  detail: string
}

function buildPipelineChecks(alert: Alert, settings: PipelineSettings): PipelineCheck[] {
  const { enrichment, severity, mitreTactic, mitreTechnique, yaraMatch } = alert

  const hasAiAnalysis = !!(enrichment.aiAnalysis && enrichment.aiAnalysis.trim())
  const hasThreatIntel = !!(enrichment.threatIntel && enrichment.threatIntel.trim() && enrichment.threatIntel !== "No threat intelligence data available.")

  return [
    {
      id: "severity",
      label: "Severity Detection",
      icon: Zap,
      status: "ok",
      detail: severity.charAt(0).toUpperCase() + severity.slice(1),
    },
    {
      id: "classifier",
      label: "Built-in Classifier",
      icon: ShieldCheck,
      status: "ok",
      detail: mitreTactic !== "Unknown" ? `Executed · mapped: ${mitreTactic}` : "Executed · no mapping",
    },
    {
      id: "sigma",
      label: "Sigma Rules",
      icon: FileCode,
      status: !settings.sigmaEnabled
        ? "disabled"
        : "ok",
      detail: !settings.sigmaEnabled
        ? "Disabled"
        : enrichment.sigma?.title
          ? `Executed · matched: ${enrichment.sigma.title}`
          : "Executed · no match",
    },
    {
      id: "yara",
      label: "YARA Scan",
      icon: Hash,
      status: !settings.yaraEnabled
        ? "disabled"
        : "ok",
      detail: !settings.yaraEnabled
        ? "Disabled"
        : yaraMatch
          ? `Executed · matched: ${yaraMatch}`
          : "Executed · no match",
    },
    {
      id: "fields",
      label: "Field Extraction",
      icon: DatabaseZap,
      status: (enrichment.parseConfidence ?? 0) > 50 ? "ok" : "no_match",
      detail: `${Math.round(enrichment.parseConfidence ?? 0)}% confidence`,
    },
    {
      id: "threatintel",
      label: "Threat Intel",
      icon: Network,
      status:
        settings.activeThreatFeeds === 0
          ? "disabled"
          : hasThreatIntel
            ? "ok"
            : "pending",
      detail:
        settings.activeThreatFeeds === 0
          ? "No feeds configured"
          : hasThreatIntel
            ? `${settings.activeThreatFeeds} feed${settings.activeThreatFeeds > 1 ? "s" : ""}`
            : "Pending / no hits",
    },
    {
      id: "ai",
      label: "AI Analysis",
      icon: Brain,
      status: !settings.llmConfigured
        ? "disabled"
        : hasAiAnalysis
          ? "ok"
          : "pending",
      detail: !settings.llmConfigured
        ? `Not configured (${settings.llmProvider || "none"})`
        : hasAiAnalysis
          ? `${settings.analysisAgents} agent${settings.analysisAgents > 1 ? "s" : ""} · score ${enrichment.aiScore}`
          : "Pending",
    },
    {
      id: "heuristics",
      label: "Heuristic Score",
      icon: Cpu,
      status: enrichment.heuristicsScore > 0 ? "ok" : "no_match",
      detail: `Score ${enrichment.heuristicsScore}`,
    },
  ]
}

const statusConfig: Record<
  CheckStatus,
  { icon: typeof CheckCircle2; color: string; bgColor: string; borderColor: string }
> = {
  ok: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/8",
    borderColor: "border-emerald-500/20",
  },
  match: {
    icon: CheckCircle2,
    color: "text-amber-400",
    bgColor: "bg-amber-500/8",
    borderColor: "border-amber-500/20",
  },
  no_match: {
    icon: MinusCircle,
    color: "text-muted-foreground/50",
    bgColor: "bg-background/30",
    borderColor: "border-border/20",
  },
  skipped: {
    icon: MinusCircle,
    color: "text-muted-foreground/40",
    bgColor: "bg-background/20",
    borderColor: "border-border/10",
  },
  pending: {
    icon: AlertTriangle,
    color: "text-sky-400",
    bgColor: "bg-sky-500/8",
    borderColor: "border-sky-500/20",
  },
  error: {
    icon: XCircle,
    color: "text-red-400",
    bgColor: "bg-red-500/8",
    borderColor: "border-red-500/20",
  },
  disabled: {
    icon: XCircle,
    color: "text-muted-foreground/35",
    bgColor: "bg-background/20",
    borderColor: "border-border/15",
  },
  running: {
    icon: Loader2,
    color: "text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/30",
  },
  queued: {
    icon: MinusCircle,
    color: "text-muted-foreground/25",
    bgColor: "bg-background/10",
    borderColor: "border-border/10",
  },
}

function PipelinePanel({
  checks,
  scanState = "idle",
  liveSteps,
  onRescan,
}: {
  checks: PipelineCheck[]
  scanState?: "idle" | "scanning" | "complete"
  liveSteps?: Record<string, { status: CheckStatus; detail: string }> | null
  onRescan?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isScanning = scanState === "scanning"
  const isComplete = scanState === "complete"
  const isExpanded = expanded || isScanning || isComplete

  // Merge base checks with live step overrides
  const displayChecks = useMemo(
    () => liveSteps ? checks.map((c) => liveSteps[c.id] ? { ...c, ...liveSteps[c.id] } : c) : checks,
    [checks, liveSteps]
  )

  const summary = useMemo(() => {
    const matches = displayChecks.filter((c) => c.status === "match" || c.status === "ok").length
    const disabled = displayChecks.filter((c) => c.status === "disabled").length
    const pending = displayChecks.filter((c) => c.status === "pending" || c.status === "queued").length
    return { matches, disabled, pending, total: displayChecks.length }
  }, [displayChecks])

  const doneCount = useMemo(
    () => displayChecks.filter((c) => c.status !== "queued" && c.status !== "running" && c.status !== "pending").length,
    [displayChecks]
  )
  const activeTotal = displayChecks.filter((c) => c.status !== "disabled").length

  const wrapperCls = isScanning
    ? "border-sky-500/25 bg-sky-500/[0.03]"
    : isComplete
    ? "border-emerald-500/25 bg-emerald-500/[0.03]"
    : "border-border/30 bg-background/30"

  return (
    <div className={cn("rounded-lg border overflow-hidden transition-colors duration-500", wrapperCls)}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <button
          onClick={() => { if (!isScanning) setExpanded((v) => !v) }}
          disabled={isScanning}
          className="flex items-center gap-2 flex-1 text-left min-w-0"
        >
          {isScanning ? (
            <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0" />
          ) : isComplete ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          )}
          <span className={cn(
            "text-[11px] font-medium uppercase tracking-wider shrink-0",
            isScanning ? "text-sky-300" : isComplete ? "text-emerald-300" : "text-muted-foreground"
          )}>
            {isScanning ? "Scanning..." : isComplete ? "Scan Complete" : "Scan Pipeline"}
          </span>
          <span className={cn(
            "text-[10px] truncate",
            isScanning ? "text-sky-400/70" : isComplete ? "text-emerald-400/70" : "text-muted-foreground/50"
          )}>
            {isScanning || isComplete
              ? `${doneCount} / ${activeTotal} steps`
              : `${summary.matches}/${summary.total - summary.disabled} checks passed${summary.pending > 0 ? ` · ${summary.pending} pending` : ""}`}
          </span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {!isScanning && !isComplete && (
            <>
              <div className="flex items-center gap-1">
                {displayChecks.map((c) => {
                  const cfg = statusConfig[c.status]
                  const StatusIcon = cfg.icon
                  return (
                    <span key={c.id} title={`${c.label}: ${c.detail}`}>
                      <StatusIcon className={cn("w-2.5 h-2.5", cfg.color)} />
                    </span>
                  )
                })}
              </div>
              {onRescan && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRescan() }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-foreground/5 transition-colors ml-1"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  Re-scan
                </button>
              )}
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/40" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" />
              )}
            </>
          )}
        </div>
      </div>

      {/* Progress bar (visible while scanning or briefly after) */}
      {(isScanning || isComplete) && (
        <div className="px-4 pb-2">
          <div className="h-0.5 bg-border/20 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                isComplete ? "bg-emerald-500" : "bg-sky-500"
              )}
              style={{ width: `${(doneCount / Math.max(1, activeTotal)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Expanded checks grid */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-border/20">
          {displayChecks.map((check) => {
            const cfg = statusConfig[check.status]
            const StatusIcon = cfg.icon
            const CheckIcon = check.icon
            const isRunning = check.status === "running"
            return (
              <div
                key={check.id}
                className={cn(
                  "rounded-md px-3 py-2.5 border flex flex-col gap-1.5 transition-all duration-300",
                  cfg.bgColor,
                  cfg.borderColor,
                  isRunning && "shadow-[0_0_8px_0_rgba(14,165,233,0.15)]"
                )}
              >
                <div className="flex items-center justify-between">
                  <CheckIcon className="w-3 h-3 text-muted-foreground/50" />
                  <StatusIcon className={cn("w-3 h-3", cfg.color, isRunning && "animate-spin")} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-foreground/70 leading-tight">
                    {check.label}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] leading-tight truncate",
                      check.status === "disabled" || check.status === "no_match" || check.status === "queued"
                        ? "text-muted-foreground/40"
                        : check.status === "running"
                        ? "text-sky-400/70"
                        : "text-muted-foreground/70"
                    )}
                    title={check.detail}
                  >
                    {check.detail}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// Extracted Fields Display
// ──────────────────────────────────────────────────────────────────

function ExtractedFieldsGrid({ rawLog }: { rawLog: string }) {
  const fields = useMemo(() => {
    const result = extractStructuredFields(rawLog)
    return getDisplayFields(result.fields)
  }, [rawLog])

  if (fields.length === 0) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
      {fields.map(({ key, value }) => (
        <div key={key} className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium leading-tight truncate">
            {key}
          </span>
          <span
            className="text-[11px] font-mono text-foreground/75 truncate"
            title={value}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// YARA Results Panel
// ──────────────────────────────────────────────────────────────────

function YaraResultsPanel({
  alert,
  results,
  loading,
  onLoad,
}: {
  alert: Alert
  results: YaraRuleResult[] | null
  loading: boolean
  onLoad: () => void
}) {
  const matched = results?.filter((r) => r.matched) ?? []
  const noMatch = results?.filter((r) => !r.matched) ?? []

  return (
    <div className="glass rounded-lg p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-foreground/60" />
          <h3 className="text-sm font-medium text-foreground">YARA Rule Scan</h3>
          {results && (
            <span className="text-[10px] text-muted-foreground/50">
              {matched.length} match{matched.length !== 1 ? "es" : ""} / {results.length} rules
            </span>
          )}
        </div>
        {!results && (
          <button
            onClick={onLoad}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Hash className="w-3 h-3" />}
            {loading ? "Scanning..." : "Run YARA Scan"}
          </button>
        )}
      </div>

      {alert.yaraMatch && !results && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3 flex items-center gap-2">
          <ShieldBan className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-xs text-amber-300/90">
            Alert triggered by: <code className="font-mono">{alert.yaraMatch}</code>
          </span>
        </div>
      )}

      {results === null && !loading && (
        <div className="text-xs text-muted-foreground/50 text-center py-6">
          Click &quot;Run YARA Scan&quot; to test all enabled rules against this alert&apos;s raw log.
        </div>
      )}

      {results && results.length === 0 && (
        <div className="text-xs text-muted-foreground/50 text-center py-6">
          No YARA rules are currently enabled.
        </div>
      )}

      {results && results.length > 0 && (
        <div className="flex flex-col gap-2">
          {matched.map((rule) => (
            <div
              key={rule.name}
              className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3 flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-2">
                <ShieldBan className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-xs font-mono text-amber-300/90 font-medium">{rule.name}</span>
                <span className="ml-auto text-[10px] text-amber-400/70 font-medium uppercase tracking-wide">Match</span>
              </div>
              {rule.matchedStrings.length > 0 && (
                <div className="pl-5 flex flex-wrap gap-1.5">
                  {rule.matchedStrings.slice(0, 6).map((s, i) => (
                    <code
                      key={i}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-200/70"
                    >
                      {s}
                    </code>
                  ))}
                  {rule.matchedStrings.length > 6 && (
                    <span className="text-[10px] text-muted-foreground/40">
                      +{rule.matchedStrings.length - 6} more
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
          {noMatch.map((rule) => (
            <div
              key={rule.name}
              className="bg-background/30 border border-border/20 rounded-md px-3 py-2 flex items-center gap-2"
            >
              <ShieldOff className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
              <span className="text-[11px] font-mono text-muted-foreground/50">{rule.name}</span>
              <span className="ml-auto text-[10px] text-muted-foreground/30 uppercase tracking-wide">No Match</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function toShortAiSummary(text: string, maxWords = 30): string {
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/^Agent\s+\d+:\s*/i, "")
    .trim()
  if (!cleaned) return "AI summary unavailable for this alert."
  const words = cleaned.split(" ").filter(Boolean)
  if (words.length <= maxWords) return cleaned
  return words.slice(0, maxWords).join(" ")
}

function NotesPanel({
  alertId,
  currentUser,
}: {
  alertId: string
  currentUser: string
}) {
  const [notes, setNotes] = useState<AlertNote[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [noteText, setNoteText] = useState("")
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageMime, setImageMime] = useState<string | null>(null)

  const loadNotes = async () => {
    setLoading(true)
    const result = await getAlertNotesAction(alertId)
    if (result.success && result.notes) setNotes(result.notes)
    setLoading(false)
  }

  useEffect(() => {
    loadNotes()
  }, [alertId])

  const onFileChange = (file: File | null) => {
    if (!file) {
      setImageData(null)
      setImageMime(null)
      return
    }
    if (!file.type.startsWith("image/")) return
    if (file.size > 2 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      if (result) {
        setImageData(result)
        setImageMime(file.type)
      }
    }
    reader.readAsDataURL(file)
  }

  const submitNote = async () => {
    if (!noteText.trim()) return
    setSubmitting(true)
    const res = await addAlertNoteAction(alertId, noteText, imageData, imageMime)
    if (res.success) {
      setNoteText("")
      setImageData(null)
      setImageMime(null)
      await loadNotes()
    }
    setSubmitting(false)
  }

  return (
    <div className="glass rounded-lg p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-foreground/60" />
        <h3 className="text-sm font-medium text-foreground">Incident Notes</h3>
      </div>

      <div className="bg-background/50 rounded-md p-3 border border-border/30 flex flex-col gap-2">
        <div className="text-[11px] text-muted-foreground">Posting as {currentUser}</div>
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add analyst note, finding, or investigation update..."
          className="min-h-24 text-xs bg-background/70 border-border/50"
        />
        <div className="flex items-center justify-between">
          <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 cursor-pointer">
            <ImagePlus className="w-3.5 h-3.5" />
            Attach image (optional)
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFileChange(e.target.files?.[0] || null)}
            />
          </label>
          <button
            onClick={submitNote}
            disabled={submitting || !noteText.trim()}
            className="px-3 py-1.5 rounded-md border border-border/40 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-50"
          >
            {submitting ? "Posting..." : "Post Note"}
          </button>
        </div>
        {imageData && (
          <div className="rounded-md overflow-hidden border border-border/30 max-w-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageData} alt="note attachment preview" className="w-full h-auto" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {loading ? (
          <div className="text-xs text-muted-foreground/70">Loading notes...</div>
        ) : notes.length === 0 ? (
          <div className="text-xs text-muted-foreground/70">No notes yet.</div>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="bg-background/50 rounded-md p-3 border border-border/30 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-foreground/80">{n.username}</span>
                <span className="text-[10px] text-muted-foreground/60">
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{n.noteText}</p>
              {n.imageData && (
                <div className="rounded-md overflow-hidden border border-border/30 max-w-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={n.imageData} alt="note attachment" className="w-full h-auto" />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// Threat Intel Vendor Panel
// ──────────────────────────────────────────────────────────────────

function ThreatIntelVendorPanel({
  vendors,
  summary,
}: {
  vendors?: ThreatIntelVendorResult[]
  summary?: string
}) {
  if (!vendors || vendors.length === 0) {
    return (
      <div className="bg-background/50 rounded-md p-4 border border-border/30">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-3.5 h-3.5 text-foreground/60" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Threat Intelligence
          </span>
        </div>
        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          {summary || "No threat intelligence data available for this alert."}
        </p>
      </div>
    )
  }

  const hits = vendors.filter((v) => v.hit)

  // Group by indicator
  const byIndicator = vendors.reduce<Record<string, ThreatIntelVendorResult[]>>((acc, v) => {
    const key = `${v.indicatorType}:${v.indicator}`
    if (!acc[key]) acc[key] = []
    acc[key].push(v)
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-foreground/60" />
        <h3 className="text-sm font-medium text-foreground">Threat Intelligence</h3>
        <span className="text-[10px] text-muted-foreground/50">
          {hits.length} hit{hits.length !== 1 ? "s" : ""} · {vendors.length} checks
        </span>
      </div>

      {Object.entries(byIndicator).map(([key, results]) => {
        const colonIdx = key.indexOf(":")
        const indicatorType = key.slice(0, colonIdx)
        const indicator = key.slice(colonIdx + 1)
        const hasHit = results.some((r) => r.hit)

        return (
          <div
            key={key}
            className={cn(
              "rounded-md border p-3 flex flex-col gap-2",
              hasHit ? "bg-red-500/8 border-red-500/20" : "bg-background/40 border-border/25"
            )}
          >
            <div className="flex items-center gap-2">
              {hasHit ? (
                <ShieldBan className="w-3.5 h-3.5 text-red-400 shrink-0" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/70 shrink-0" />
              )}
              <code className="text-[11px] font-mono text-foreground/80 flex-1 truncate" title={indicator}>
                {indicator}
              </code>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/40 shrink-0">
                {indicatorType}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 pl-5">
              {results.map((r) => (
                <div
                  key={r.vendor}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded text-[10px]",
                    r.hit
                      ? "bg-red-500/10 border border-red-500/20 text-red-300/90"
                      : r.error
                      ? "bg-background/30 border border-border/20 text-muted-foreground/40"
                      : "bg-emerald-500/5 border border-emerald-500/15 text-emerald-400/60"
                  )}
                >
                  {r.hit ? (
                    <XCircle className="w-3 h-3 shrink-0" />
                  ) : r.error ? (
                    <MinusCircle className="w-3 h-3 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                  )}
                  <span className="font-medium truncate">{r.vendor}</span>
                  <span className="ml-auto opacity-70 truncate pl-1">{r.result}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────────

export function AlertDetail({
  alert,
  pipelineSettings,
  currentUser,
  role = "analyst",
}: {
  alert: Alert
  pipelineSettings?: PipelineSettings
  currentUser: string
  role?: UserRole
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deleting, setDeleting] = useState(false)
  const [scanState, setScanState] = useState<"idle" | "scanning" | "complete">("idle")
  const [liveSteps, setLiveSteps] = useState<Record<string, { status: CheckStatus; detail: string }> | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const [yaraResults, setYaraResults] = useState<YaraRuleResult[] | null>(null)
  const [yaraLoading, setYaraLoading] = useState(false)

  const defaultPipelineSettings: PipelineSettings = {
    sigmaEnabled: false,
    yaraEnabled: false,
    llmConfigured: false,
    llmProvider: "none",
    llmModel: "",
    analysisAgents: 3,
    activeThreatFeeds: 0,
  }
  const settings = pipelineSettings ?? defaultPipelineSettings
  const pipelineChecks = buildPipelineChecks(alert, settings)
  const aiHeaderSummary = useMemo(
    () => toShortAiSummary(alert.enrichment.aiSummaryShort || alert.enrichment.aiAnalysis || alert.description, 30),
    [alert.enrichment.aiSummaryShort, alert.enrichment.aiAnalysis, alert.description]
  )

  const isEnrichmentPending = !alert.enrichment.aiAnalysis?.trim()
  useEffect(() => {
    if (!isEnrichmentPending) return
    const interval = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(interval)
  }, [isEnrichmentPending, router])

  const handleIncidentStatusChange = (incidentStatus: IncidentStatus) => {
    startTransition(() => {
      updateAlertIncidentStatusAction(alert.id, incidentStatus)
    })
  }

  const handleVerdictChange = (verdict: AlertVerdict) => {
    startTransition(() => {
      updateAlertVerdictAction(alert.id, verdict)
    })
  }

  const handleRescan = () => {
    if (scanState !== "idle") return

    // Close any existing SSE connection
    esRef.current?.close()

    // Init all steps as queued
    const initial: Record<string, { status: CheckStatus; detail: string }> = {}
    for (const check of pipelineChecks) {
      initial[check.id] = { status: "queued", detail: "Queued..." }
    }
    setLiveSteps(initial)
    setScanState("scanning")

    const es = new EventSource(`/api/alerts/${alert.id}/rescan`)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as { step?: string; status?: string; detail?: string; done?: boolean; error?: string }
        if (data.done) {
          es.close()
          setScanState("complete")
          // Show complete state briefly, then refresh
          setTimeout(() => {
            setScanState("idle")
            setLiveSteps(null)
            router.refresh()
          }, 1800)
          return
        }
        if (data.error) {
          es.close()
          setScanState("idle")
          setLiveSteps(null)
          return
        }
        if (data.step) {
          setLiveSteps((prev) =>
            prev ? { ...prev, [data.step!]: { status: data.status as CheckStatus, detail: data.detail ?? "" } } : prev
          )
        }
      } catch {}
    }

    es.onerror = () => {
      es.close()
      setScanState("idle")
      setLiveSteps(null)
    }
  }

  // Cleanup on unmount
  useEffect(() => () => { esRef.current?.close() }, [])

  const handleLoadYara = async () => {
    if (yaraResults || yaraLoading) return
    setYaraLoading(true)
    const result = await getYaraDetailsAction(alert.id)
    setYaraLoading(false)
    if (result.success && result.rules) setYaraResults(result.rules)
  }

  const handleDeleteAlert = async () => {
    const confirmed = window.confirm(`Delete alert ${alert.id}? This cannot be undone.`)
    if (!confirmed) return
    setDeleting(true)
    try {
      const result = await deleteAlertAction(alert.id)
      if (result.success) {
        router.push("/dashboard/alerts")
        router.refresh()
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header Card ── */}
      <div className="glass rounded-lg p-5 flex flex-col gap-5">

        {/* Top row: info left, scores right */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

          {/* Left: badges, title, description, controls */}
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={alert.severity} />
              {isEnrichmentPending ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium leading-none border-border/30 text-muted-foreground bg-foreground/5 animate-pulse">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  Analyzing…
                </span>
              ) : (
                <VerdictBadge verdict={alert.verdict} />
              )}
              <StatusBadge status={alert.incidentStatus} />
              <span className="text-[11px] font-mono text-muted-foreground/60">{alert.id}</span>
            </div>

            <div className="flex flex-col gap-1">
              <h1 className="text-base font-semibold text-foreground leading-snug">{alert.title}</h1>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                {alert.description}
              </p>
            </div>

            {/* Controls row (Analysts and Admins only) */}
            {role !== "client" && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={alert.verdict}
                  onChange={(e) => handleVerdictChange(e.target.value as AlertVerdict)}
                  disabled={isPending}
                  className="h-8 rounded-md border border-border/50 bg-background/60 px-2 text-[11px] text-foreground cursor-pointer"
                >
                  <option value="malicious">Malicious</option>
                  <option value="suspicious">Suspicious</option>
                  <option value="false_positive">False Positive</option>
                </select>
                <select
                  value={alert.incidentStatus}
                  onChange={(e) => handleIncidentStatusChange(e.target.value as IncidentStatus)}
                  disabled={isPending}
                  className="h-8 rounded-md border border-border/50 bg-background/60 px-2 text-[11px] text-foreground cursor-pointer"
                >
                  <option value="unassigned">Unassigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
                <button
                  onClick={handleRescan}
                  disabled={scanState !== "idle"}
                  className="h-8 rounded-md border border-border/50 px-2.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
                >
                  {scanState === "scanning" ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : scanState === "complete" ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  Re-scan
                </button>
                <button
                  onClick={handleDeleteAlert}
                  disabled={deleting}
                  className="h-8 rounded-md border border-[hsl(var(--severity-critical))]/40 bg-[hsl(var(--severity-critical))]/10 px-2.5 text-[11px] text-[hsl(var(--severity-critical))] hover:bg-[hsl(var(--severity-critical))]/20 disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
                >
                  {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Delete
                </button>
              </div>
            )}

            {/* Timestamps */}
            <div className="flex flex-wrap items-center gap-4">
              <TimestampPill label="Alert" ts={alert.timestamp} />
              <TimestampPill label="Ingested" ts={alert.ingestedAt || alert.timestamp} />
              {alert.lastAnalyzedAt && (
                <TimestampPill label="Last Analyzed" ts={alert.lastAnalyzedAt} highlight />
              )}
            </div>

            <div className="rounded-md border border-sky-500/20 bg-sky-500/[0.06] px-3.5 py-2.5 max-w-3xl">
              <div className="flex items-center gap-1.5 mb-1">
                <Brain className="w-3.5 h-3.5 text-sky-300/80" />
                <span className="text-[10px] uppercase tracking-wider text-sky-200/80 font-medium">
                  AI Summary
                </span>
              </div>
              {isEnrichmentPending ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  <span>Enrichment in progress…</span>
                </div>
              ) : (
                <p className="text-xs text-foreground/85 leading-relaxed">{aiHeaderSummary}</p>
              )}
            </div>
          </div>

          {/* Right: Score display */}
          <div className="flex flex-col items-center lg:items-end shrink-0">
            <CombinedScoreDisplay
              aiScore={alert.enrichment.aiScore}
              heuristicsScore={alert.enrichment.heuristicsScore}
              loading={scanState === "scanning" || isEnrichmentPending}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/25" />

        {/* Extracted Fields from raw log */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <DatabaseZap className="w-3 h-3 text-muted-foreground/40" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium">
              Extracted Fields
            </span>
            <span className="text-[10px] text-muted-foreground/35">
              · {Math.round(alert.enrichment.parseConfidence ?? 0)}% confidence
            </span>
          </div>
          <ExtractedFieldsGrid rawLog={alert.rawLog} />
          {/* Fallback static fields */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-1">
            <MetaItem icon={Server} label="Source" value={alert.source} />
            <MetaItem icon={Globe} label="Source IP" value={alert.sourceIp} mono />
            <MetaItem icon={Target} label="Dest IP" value={alert.destIp} mono />
            <MetaItem icon={Shield} label="IOC Type" value={alert.enrichment.iocType} />
            <MetaItem
              icon={FileCode}
              label="MITRE"
              value={alert.mitreTechnique !== "Unknown" ? alert.mitreTechnique : alert.mitreTactic}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/25" />

        {/* Pipeline Status Panel */}
        <PipelinePanel
          checks={pipelineChecks}
          scanState={scanState}
          liveSteps={liveSteps}
          onRescan={handleRescan}
        />
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="analysis" className="w-full">
        <TabsList className="bg-card/60 border border-border/50 h-9 p-1">
          <TabsTrigger
            value="analysis"
            className="text-xs data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground h-7"
          >
            <Brain className="w-3.5 h-3.5 mr-1.5" />
            AI Analysis
          </TabsTrigger>
          <TabsTrigger
            value="mitre"
            className="text-xs data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground h-7"
          >
            <Shield className="w-3.5 h-3.5 mr-1.5" />
            MITRE ATT&CK
          </TabsTrigger>
          <TabsTrigger
            value="sigma"
            className="text-xs data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground h-7"
          >
            <FileCode className="w-3.5 h-3.5 mr-1.5" />
            Sigma Results
          </TabsTrigger>
          <TabsTrigger
            value="yara"
            className="text-xs data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground h-7"
          >
            <Hash className="w-3.5 h-3.5 mr-1.5" />
            YARA
          </TabsTrigger>
          <TabsTrigger
            value="enrichment"
            className="text-xs data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground h-7"
          >
            <Lightbulb className="w-3.5 h-3.5 mr-1.5" />
            Enrichment
          </TabsTrigger>
          <TabsTrigger
            value="notes"
            className="text-xs data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground h-7"
          >
            <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
            Notes
          </TabsTrigger>
          <TabsTrigger
            value="raw"
            className="text-xs data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground h-7"
          >
            <Terminal className="w-3.5 h-3.5 mr-1.5" />
            Raw Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="mt-4">
          <div className="glass rounded-lg p-5 flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <button
                onClick={handleRescan}
                disabled={scanState !== "idle"}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
              >
                {scanState === "scanning" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : scanState === "complete" ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                {scanState === "scanning" ? "Scanning..." : scanState === "complete" ? "Scan Complete" : "Re-scan Pipeline"}
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-foreground/60" />
                <h3 className="text-sm font-medium text-foreground">LLM Analysis</h3>
              </div>
              <div className="bg-background/50 rounded-md p-4 border border-border/30">
                {isEnrichmentPending ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>Analysis pending… checking again in a moment</span>
                  </div>
                ) : (
                  <p className="text-xs text-foreground/80 leading-relaxed">{alert.enrichment.aiAnalysis}</p>
                )}
              </div>
            </div>

            {alert.enrichment.verdictReason && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-foreground/60" />
                  <h3 className="text-sm font-medium text-foreground">Verdict Rationale</h3>
                </div>
                <div className="bg-background/50 rounded-md p-4 border border-border/30">
                  <p className="text-xs text-foreground/80 leading-relaxed">{alert.enrichment.verdictReason}</p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-foreground/60" />
                <h3 className="text-sm font-medium text-foreground">Recommendations</h3>
              </div>
              <div className="bg-background/50 rounded-md p-4 border border-border/30">
                {isEnrichmentPending ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>Recommendations pending…</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {alert.enrichment.recommendation
                      .split(/\d+\.\s/)
                      .filter(Boolean)
                      .map((rec, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5 w-4 text-right">
                            {i + 1}.
                          </span>
                          <span className="text-xs text-foreground/80 leading-relaxed">{rec.trim()}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-foreground/60" />
                <h3 className="text-sm font-medium text-foreground">Threat Intelligence</h3>
              </div>
              <div className="bg-background/50 rounded-md p-4 border border-border/30">
                {isEnrichmentPending ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>Threat intelligence lookup pending…</span>
                  </div>
                ) : (
                  <p className="text-xs text-foreground/80 leading-relaxed">{alert.enrichment.threatIntel}</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="mitre" className="mt-4">
          <div className="glass rounded-lg p-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-background/50 rounded-md p-4 border border-border/30">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tactic</span>
                <p className="text-sm text-foreground mt-1">{alert.mitreTactic}</p>
              </div>
              <div className="bg-background/50 rounded-md p-4 border border-border/30">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Technique</span>
                <p className="text-sm text-foreground mt-1 font-mono text-xs">{alert.mitreTechnique}</p>
              </div>
            </div>
            {alert.yaraMatch && (
              <div className="bg-background/50 rounded-md p-4 border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <FileCode className="w-3.5 h-3.5 text-foreground/60" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    YARA Rule Match
                  </span>
                </div>
                <code className="text-xs font-mono text-foreground/80">{alert.yaraMatch}</code>
              </div>
            )}
            {alert.enrichment.relatedCves.length > 0 && (
              <div className="bg-background/50 rounded-md p-4 border border-border/30">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Related CVEs
                </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {alert.enrichment.relatedCves.map((cve) => (
                    <span
                      key={cve}
                      className="text-xs font-mono px-2 py-0.5 rounded bg-foreground/5 border border-border/30 text-foreground/70"
                    >
                      {cve}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sigma" className="mt-4">
          <div className="glass rounded-lg p-5 flex flex-col gap-4">
            {alert.enrichment.sigma ? (
              <>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-foreground/60" />
                    <h3 className="text-sm font-medium text-foreground">Matched Sigma Rule</h3>
                  </div>
                  <div className="bg-background/50 rounded-md p-4 border border-border/30">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-foreground">{alert.enrichment.sigma.title}</span>
                      {alert.enrichment.sigma.ruleId && (
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {alert.enrichment.sigma.ruleId}
                        </span>
                      )}
                      {alert.enrichment.sigma.description && (
                        <p className="text-[11px] text-foreground/70 mt-2">
                          {alert.enrichment.sigma.description}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                      <div className="bg-background/70 rounded-md p-3 border border-border/30">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Level</span>
                        <p className="text-xs text-foreground mt-1">{alert.enrichment.sigma.level || "Unknown"}</p>
                      </div>
                      <div className="bg-background/70 rounded-md p-3 border border-border/30">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</span>
                        <p className="text-xs text-foreground mt-1">{alert.enrichment.sigma.status || "Unknown"}</p>
                      </div>
                      <div className="bg-background/70 rounded-md p-3 border border-border/30">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Source</span>
                        <p className="text-[11px] font-mono text-foreground/70 mt-1 truncate">
                          {alert.enrichment.sigma.source || "Local"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {alert.enrichment.sigma.tags && alert.enrichment.sigma.tags.length > 0 && (
                  <div className="bg-background/50 rounded-md p-4 border border-border/30">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tags</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {alert.enrichment.sigma.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] font-mono px-2 py-0.5 rounded bg-foreground/5 border border-border/30 text-foreground/70"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {alert.enrichment.sigma.references && alert.enrichment.sigma.references.length > 0 && (
                  <div className="bg-background/50 rounded-md p-4 border border-border/30">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      References
                    </span>
                    <div className="flex flex-col gap-1 mt-2">
                      {alert.enrichment.sigma.references.map((ref) => (
                        <code key={ref} className="text-[11px] font-mono text-foreground/70 break-all">
                          {ref}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {alert.enrichment.sigma.condition && (
                  <div className="bg-background/50 rounded-md p-4 border border-border/30">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Condition
                    </span>
                    <p className="text-[11px] font-mono text-foreground/70 mt-2">{alert.enrichment.sigma.condition}</p>
                  </div>
                )}

                {alert.enrichment.sigma.matchDetails && alert.enrichment.sigma.matchDetails.length > 0 && (
                  <div className="bg-background/50 rounded-md p-4 border border-border/30">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Matched Fields
                    </span>
                    <div className="mt-2 space-y-2">
                      {alert.enrichment.sigma.matchDetails.map((detail, i) => (
                        <div
                          key={`${detail.field}-${i}`}
                          className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-background/70 rounded-md p-3 border border-border/30"
                        >
                          <div className="flex flex-col">
                            <span className="text-[11px] text-muted-foreground">Selection</span>
                            <span className="text-xs text-foreground">{detail.selection}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] text-muted-foreground">Field</span>
                            <span className="text-xs font-mono text-foreground/80">{detail.field}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] text-muted-foreground">Operator</span>
                            <span className="text-xs font-mono text-foreground/80">{detail.operator}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] text-muted-foreground">Expected</span>
                            <span className="text-xs font-mono text-foreground/80">{detail.expected}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] text-muted-foreground">Actual</span>
                            <span className="text-xs font-mono text-foreground/80">{detail.actual}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-background/50 rounded-md p-4 border border-border/30 text-xs text-muted-foreground">
                No Sigma rule matched this alert.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="yara" className="mt-4">
          <YaraResultsPanel
            alert={alert}
            results={yaraResults}
            loading={yaraLoading}
            onLoad={handleLoadYara}
          />
        </TabsContent>

        <TabsContent value="enrichment" className="mt-4">
          <div className="glass rounded-lg p-5 flex flex-col gap-4">
            {/* Geo / ASN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {alert.enrichment.geoLocation && (
                <div className="bg-background/50 rounded-md p-4 border border-border/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-3.5 h-3.5 text-foreground/60" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Geolocation</span>
                  </div>
                  <p className="text-sm text-foreground">
                    {alert.enrichment.geoLocation.city}, {alert.enrichment.geoLocation.country}
                  </p>
                </div>
              )}
              {alert.enrichment.asnInfo && (
                <div className="bg-background/50 rounded-md p-4 border border-border/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="w-3.5 h-3.5 text-foreground/60" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">ASN Information</span>
                  </div>
                  <p className="text-xs font-mono text-foreground/80">{alert.enrichment.asnInfo}</p>
                </div>
              )}
              <div className="bg-background/50 rounded-md p-4 border border-border/30">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">IOC Classification</span>
                <p className="text-sm text-foreground mt-1">{alert.enrichment.iocType || "Unknown"}</p>
              </div>
            </div>

            {/* Threat Intel Vendor Results */}
            <ThreatIntelVendorPanel vendors={alert.enrichment.threatIntelVendors} summary={alert.enrichment.threatIntel} />

            {alert.enrichment.fieldConfidence && Object.keys(alert.enrichment.fieldConfidence).length > 0 && (
              <div className="bg-background/50 rounded-md p-4 border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <DatabaseZap className="w-3.5 h-3.5 text-foreground/60" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Confidence Provenance (Field-Level)
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(alert.enrichment.fieldConfidence)
                    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
                    .map(([field, value]) => (
                      <div key={field} className="flex items-center justify-between text-[11px] bg-background/70 rounded px-2.5 py-1.5 border border-border/20">
                        <span className="font-mono text-foreground/75">{field}</span>
                        <span className="text-muted-foreground">{Math.round(value || 0)}%</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <NotesPanel alertId={alert.id} currentUser={currentUser} />
        </TabsContent>

        <TabsContent value="raw" className="mt-4">
          <div className="glass rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Raw Log Entry
              </span>
              <CopyButton text={alert.rawLog} />
            </div>
            <pre className="bg-background/80 rounded-md p-4 border border-border/30 overflow-x-auto">
              <code className="text-[11px] font-mono text-foreground/70 leading-relaxed whitespace-pre-wrap break-all">
                {alert.rawLog}
              </code>
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TimestampPill({ label, ts, highlight }: { label: string; ts: string; highlight?: boolean }) {
  const d = new Date(ts)
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
  return (
    <div className={cn(
      "flex flex-col gap-0.5 px-2.5 py-1.5 rounded-md border",
      highlight
        ? "border-sky-500/20 bg-sky-500/5"
        : "border-border/20 bg-background/30"
    )}>
      <span className={cn(
        "text-[9px] uppercase tracking-wider font-medium",
        highlight ? "text-sky-400/70" : "text-muted-foreground/40"
      )}>
        {label}
      </span>
      <span className={cn(
        "text-[11px] font-mono tabular-nums",
        highlight ? "text-sky-300/80" : "text-foreground/65"
      )}>
        {date} <span className="opacity-60">{time}</span>
      </span>
    </div>
  )
}

function MetaItem({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof Server
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <Icon className="w-3 h-3 text-muted-foreground/40" />
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium">{label}</span>
      </div>
      <span className={cn("text-[11px] text-foreground/75 truncate", mono ? "font-mono" : "")} title={value}>
        {value}
      </span>
    </div>
  )
}
