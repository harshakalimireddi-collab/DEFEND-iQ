"use client"

import { useMemo, useState, useRef, useCallback, useEffect } from "react"
import Link from "next/link"
import type { Alert, Severity, IncidentStatus, AlertVerdict } from "@/lib/types"
import { SeverityBadge } from "@/components/severity-badge"
import { StatusBadge } from "@/components/status-badge"
import { VerdictBadge } from "@/components/verdict-badge"
import { ScoreRing } from "@/components/score-ring"
import { cn } from "@/lib/utils"
import { updateAlertIncidentStatusAction, updateAlertVerdictAction } from "@/app/actions"
import {
  Search,
  Filter,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  Columns3,
  X,
  Loader2,
  Upload,
  ShieldAlert,
  Sparkles,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { LogUploadDialog } from "@/components/log-upload-dialog"


// ──────────────────────────────────────────────────────────────────
// Types & Constants
// ──────────────────────────────────────────────────────────────────

const severityFilters: { key: Severity | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
  { key: "info", label: "Info" },
]

const incidentStatusFilters: { key: IncidentStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unassigned", label: "Unassigned" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
]

type SortKey =
  | "severity"
  | "id"
  | "title"
  | "source"
  | "mitreTactic"
  | "verdict"
  | "incidentStatus"
  | "aiScore"
  | "heuristicsScore"
  | "timestamp"
  | "ingestedAt"
  | "lastAnalyzedAt"

type SortDirection = "asc" | "desc"

type ColumnKey =
  | "severity"
  | "id"
  | "alert"
  | "source"
  | "mitreTactic"
  | "verdict"
  | "incident"
  | "aiScore"
  | "heuristicsScore"
  | "alertTime"
  | "ingestedAt"
  | "lastAnalyzed"

// ──────────────────────────────────────────────────────────────────
// Time Cell helper
// ──────────────────────────────────────────────────────────────────

function formatTs(ts: string): { date: string; time: string } {
  const d = new Date(ts)
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
  }
}

function TimeCell({ ts, label, dimmed, fallback }: { ts?: string; label: string; dimmed?: boolean; fallback?: string }) {
  if (!ts) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/40 font-medium">{label}</span>
        <span className="text-[11px] text-muted-foreground/30 font-mono">{fallback ?? "—"}</span>
      </div>
    )
  }
  const { date, time } = formatTs(ts)
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn("text-[9px] uppercase tracking-wider font-medium", dimmed ? "text-muted-foreground/40" : "text-muted-foreground/50")}>
        {label}
      </span>
      <span className={cn("text-[11px] font-mono tabular-nums whitespace-nowrap", dimmed ? "text-muted-foreground/60" : "text-foreground/75")}>
        {date}
      </span>
      <span className={cn("text-[10px] font-mono tabular-nums whitespace-nowrap", dimmed ? "text-muted-foreground/40" : "text-muted-foreground/60")}>
        {time}
      </span>
    </div>
  )
}

interface ColumnDef {
  key: ColumnKey
  label: string
  sortKey?: SortKey
  /** min breakpoint class for responsive hiding */
  minBreakpoint?: string
  defaultVisible: boolean
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "severity", label: "Severity", sortKey: "severity", defaultVisible: true },
  { key: "id", label: "ID", sortKey: "id", defaultVisible: true },
  { key: "alert", label: "Alert", sortKey: "title", defaultVisible: true },
  { key: "source", label: "Source", sortKey: "source", minBreakpoint: "md", defaultVisible: true },
  { key: "mitreTactic", label: "MITRE Tactic", sortKey: "mitreTactic", minBreakpoint: "lg", defaultVisible: false },
  { key: "verdict", label: "Verdict", sortKey: "verdict", minBreakpoint: "md", defaultVisible: true },
  { key: "incident", label: "Incident", sortKey: "incidentStatus", minBreakpoint: "md", defaultVisible: true },
  { key: "aiScore", label: "AI Score", sortKey: "aiScore", minBreakpoint: "xl", defaultVisible: true },
  { key: "heuristicsScore", label: "Heuristics", sortKey: "heuristicsScore", minBreakpoint: "xl", defaultVisible: true },
  { key: "alertTime", label: "Alert Time", sortKey: "timestamp", defaultVisible: true },
  { key: "ingestedAt", label: "Ingested", sortKey: "ingestedAt", defaultVisible: true },
  { key: "lastAnalyzed", label: "Last Analyzed", sortKey: "lastAnalyzedAt", defaultVisible: false },
]

const severityWeight: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

// ──────────────────────────────────────────────────────────────────
// Sorting
// ──────────────────────────────────────────────────────────────────

function sortAlerts(items: Alert[], key: SortKey, direction: SortDirection): Alert[] {
  const sorted = [...items].sort((a, b) => {
    let result = 0
    switch (key) {
      case "severity":
        result = severityWeight[a.severity] - severityWeight[b.severity]
        break
      case "id":
        result = a.id.localeCompare(b.id)
        break
      case "title":
        result = a.title.localeCompare(b.title)
        break
      case "source":
        result = a.source.localeCompare(b.source)
        break
      case "mitreTactic":
        result = a.mitreTactic.localeCompare(b.mitreTactic)
        break
      case "verdict":
        result = a.verdict.localeCompare(b.verdict)
        break
      case "incidentStatus":
        result = a.incidentStatus.localeCompare(b.incidentStatus)
        break
      case "aiScore":
        result = (a.enrichment.aiScore || 0) - (b.enrichment.aiScore || 0)
        break
      case "heuristicsScore":
        result = (a.enrichment.heuristicsScore || 0) - (b.enrichment.heuristicsScore || 0)
        break
      case "ingestedAt":
        result = new Date(a.ingestedAt || a.timestamp).getTime() - new Date(b.ingestedAt || b.timestamp).getTime()
        break
      case "lastAnalyzedAt":
        result = new Date(a.lastAnalyzedAt || a.ingestedAt || a.timestamp).getTime() - new Date(b.lastAnalyzedAt || b.ingestedAt || b.timestamp).getTime()
        break
      case "timestamp":
      default:
        result = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        break
    }
    return direction === "asc" ? result : -result
  })
  return sorted
}

// ──────────────────────────────────────────────────────────────────
// Column Manager Panel
// ──────────────────────────────────────────────────────────────────

interface ColumnManagerProps {
  columnOrder: ColumnKey[]
  visibleColumns: Set<ColumnKey>
  onToggle: (key: ColumnKey) => void
  onReorder: (newOrder: ColumnKey[]) => void
  onClose: () => void
}

function ColumnManager({ columnOrder, visibleColumns, onToggle, onReorder, onClose }: ColumnManagerProps) {
  const dragKey = useRef<ColumnKey | null>(null)
  const dragOver = useRef<ColumnKey | null>(null)
  const [, forceRender] = useState(0)

  const handleDragStart = (key: ColumnKey) => {
    dragKey.current = key
  }

  const handleDragEnter = (key: ColumnKey) => {
    if (dragKey.current === key) return
    dragOver.current = key
    forceRender((n) => n + 1)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!dragKey.current || !dragOver.current || dragKey.current === dragOver.current) {
      dragKey.current = null
      dragOver.current = null
      return
    }
    const newOrder = [...columnOrder]
    const fromIdx = newOrder.indexOf(dragKey.current)
    const toIdx = newOrder.indexOf(dragOver.current)
    newOrder.splice(fromIdx, 1)
    newOrder.splice(toIdx, 0, dragKey.current)
    onReorder(newOrder)
    dragKey.current = null
    dragOver.current = null
  }

  const handleDragEnd = () => {
    dragKey.current = null
    dragOver.current = null
    forceRender((n) => n + 1)
  }

  const columnMap = useMemo(() => {
    const m: Record<string, ColumnDef> = {}
    for (const c of ALL_COLUMNS) m[c.key] = c
    return m
  }, [])

  return (
    <div className="absolute right-0 top-9 z-30 w-64 rounded-lg border border-border/60 bg-card shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40 bg-muted/20">
        <span className="text-[11px] font-medium text-foreground">Manage Columns</span>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-foreground/10 text-muted-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="text-[10px] text-muted-foreground/50 px-3 pt-2 pb-1">
        Drag to reorder · Click eye to show/hide
      </div>
      {/* Sortable list */}
      <ul
        className="flex flex-col p-2 gap-0.5"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {columnOrder.map((key) => {
          const col = columnMap[key]
          if (!col) return null
          const isVisible = visibleColumns.has(key)
          const isDragTarget = dragOver.current === key && dragKey.current !== key
          return (
            <li
              key={key}
              draggable
              onDragStart={() => handleDragStart(key)}
              onDragEnter={() => handleDragEnter(key)}
              onDragEnd={handleDragEnd}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab select-none transition-colors",
                isDragTarget
                  ? "bg-foreground/10 border border-foreground/20 border-dashed"
                  : "hover:bg-foreground/5 border border-transparent"
              )}
            >
              <GripVertical className="w-3 h-3 text-muted-foreground/30 shrink-0" />
              <span
                className={cn(
                  "flex-1 text-[11px]",
                  isVisible ? "text-foreground/80" : "text-muted-foreground/40 line-through"
                )}
              >
                {col.label}
              </span>
              <button
                onClick={() => onToggle(key)}
                className={cn(
                  "p-0.5 rounded transition-colors",
                  isVisible
                    ? "text-foreground/50 hover:text-foreground"
                    : "text-muted-foreground/25 hover:text-muted-foreground"
                )}
                title={isVisible ? "Hide column" : "Show column"}
              >
                {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </li>
          )
        })}
      </ul>
      {/* Footer actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border/30 bg-muted/10">
        <button
          onClick={() => {
            for (const c of ALL_COLUMNS) {
              if (!visibleColumns.has(c.key)) onToggle(c.key)
            }
          }}
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          Show all
        </button>
        <span className="text-border/40">·</span>
        <button
          onClick={() => {
            const defaultVisible = new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key))
            for (const c of ALL_COLUMNS) {
              const shouldBeVisible = defaultVisible.has(c.key)
              if (shouldBeVisible !== visibleColumns.has(c.key)) onToggle(c.key)
            }
            onReorder(ALL_COLUMNS.map((c) => c.key))
          }}
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          Reset
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// Sort Indicator
// ──────────────────────────────────────────────────────────────────

function SortIcon({ colKey, sortKey, direction }: { colKey: SortKey; sortKey: SortKey; direction: SortDirection }) {
  if (colKey !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30" />
  return direction === "asc" ? (
    <ArrowUp className="w-3 h-3 text-foreground/70" />
  ) : (
    <ArrowDown className="w-3 h-3 text-foreground/70" />
  )
}

// ──────────────────────────────────────────────────────────────────
// Enrichment helpers
// ──────────────────────────────────────────────────────────────────

function isEnrichmentPending(alert: Alert): boolean {
  return !alert.enrichment.aiAnalysis?.trim()
}

// ──────────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────────

import type { Alert, Severity, IncidentStatus, AlertVerdict, UserRole } from "@/lib/types"

interface AlertsViewProps {
  initialAlerts: Alert[]
  role?: UserRole
}

export function AlertsView({ initialAlerts, role = "analyst" }: AlertsViewProps) {
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts)
  const [updatingRows, setUpdatingRows] = useState<Record<string, boolean>>({})
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all")
  const [incidentStatusFilter, setIncidentStatusFilter] = useState<IncidentStatus | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("timestamp")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(ALL_COLUMNS.map((c) => c.key))
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key))
  )

  useEffect(() => {
    setAlerts(initialAlerts)
  }, [initialAlerts])

  const hasPendingAlerts = alerts.some(isEnrichmentPending)
  useEffect(() => {
    if (!hasPendingAlerts) return
    const interval = setInterval(() => router.refresh(), 4000)
    return () => clearInterval(interval)
  }, [hasPendingAlerts, router])

  const markUpdating = useCallback((id: string, value: boolean) => {
    setUpdatingRows((prev) => {
      const next = { ...prev }
      if (value) next[id] = true
      else delete next[id]
      return next
    })
  }, [])

  const handleInlineIncidentChange = useCallback(async (id: string, next: IncidentStatus) => {
    const previous = alerts
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, incidentStatus: next } : a)))
    markUpdating(id, true)
    try {
      await updateAlertIncidentStatusAction(id, next)
      router.refresh()
    } catch {
      setAlerts(previous)
    } finally {
      markUpdating(id, false)
    }
  }, [alerts, markUpdating, router])

  const handleInlineVerdictChange = useCallback(async (id: string, next: AlertVerdict) => {
    const previous = alerts
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, verdict: next } : a)))
    markUpdating(id, true)
    try {
      await updateAlertVerdictAction(id, next)
      router.refresh()
    } catch {
      setAlerts(previous)
    } finally {
      markUpdating(id, false)
    }
  }, [alerts, markUpdating, router])

  const filtered = useMemo(() => {
    const base = alerts.filter((a) => {
      if (severityFilter !== "all" && a.severity !== severityFilter) return false
      if (incidentStatusFilter !== "all" && a.incidentStatus !== incidentStatusFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          a.title.toLowerCase().includes(q) ||
          a.source.toLowerCase().includes(q) ||
          a.sourceIp.toLowerCase().includes(q) ||
          a.mitreTechnique.toLowerCase().includes(q) ||
          a.mitreTactic.toLowerCase().includes(q) ||
          a.verdict.toLowerCase().includes(q)
        )
      }
      return true
    })
    return sortAlerts(base, sortKey, sortDirection)
  }, [alerts, incidentStatusFilter, searchQuery, severityFilter, sortDirection, sortKey])

  const severityCounts = useMemo(
    () =>
      alerts.reduce((acc, a) => {
        acc[a.severity] = (acc[a.severity] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    [alerts]
  )

  const toggleColumn = useCallback((key: ColumnKey) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size === 1) return prev // must keep at least one
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(nextKey)
      setSortDirection(nextKey === "timestamp" || nextKey === "ingestedAt" ? "desc" : "asc")
    }
  }

  // Ordered visible columns
  const orderedVisible = columnOrder.filter((k) => visibleColumns.has(k))
  const columnMap = useMemo(() => {
    const m: Record<string, ColumnDef> = {}
    for (const c of ALL_COLUMNS) m[c.key] = c
    return m
  }, [])

  function thClass(col: ColumnDef) {
    return cn(
      "text-[11px] font-medium text-muted-foreground text-left px-4 py-2.5 whitespace-nowrap select-none",
      col.minBreakpoint === "md" && "hidden md:table-cell",
      col.minBreakpoint === "lg" && "hidden lg:table-cell",
      col.minBreakpoint === "xl" && "hidden xl:table-cell"
    )
  }

  function tdClass(col: ColumnDef) {
    return cn(
      "px-4 py-3",
      col.minBreakpoint === "md" && "hidden md:table-cell",
      col.minBreakpoint === "lg" && "hidden lg:table-cell",
      col.minBreakpoint === "xl" && "hidden xl:table-cell"
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Severity filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {severityFilters.map((f) => {
          const count = f.key === "all" ? alerts.length : severityCounts[f.key] || 0
          return (
            <button
              key={f.key}
              onClick={() => setSeverityFilter(f.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors border",
                severityFilter === f.key
                  ? "border-foreground/30 bg-foreground/10 text-foreground"
                  : "border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/20"
              )}
            >
              {f.label}
              <span className="text-[10px] tabular-nums opacity-60">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Search + controls bar */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search alerts, IPs, tactics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-card/60 border-border/50 placeholder:text-muted-foreground/40"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Incident status filter */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-md glass-subtle shrink-0">
          <Filter className="w-3 h-3 text-muted-foreground shrink-0" />
          {incidentStatusFilters.map((s) => (
            <button
              key={s.key}
              onClick={() => setIncidentStatusFilter(s.key)}
              className={cn(
                "px-2 py-0.5 text-[11px] rounded transition-colors capitalize whitespace-nowrap",
                incidentStatusFilter === s.key
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Column manager toggle */}
        <div className="relative shrink-0">
          <button
            onClick={() => setColumnsOpen((v) => !v)}
            className={cn(
              "h-8 px-2.5 rounded-md border text-[11px] flex items-center gap-1.5 transition-colors",
              columnsOpen
                ? "border-foreground/30 bg-foreground/10 text-foreground"
                : "border-border/50 bg-card/60 text-muted-foreground hover:text-foreground"
            )}
          >
            <Columns3 className="w-3.5 h-3.5" />
            Columns
            <span className="text-[10px] opacity-50">
              {visibleColumns.size}/{ALL_COLUMNS.length}
            </span>
          </button>
          {columnsOpen && (
            <ColumnManager
              columnOrder={columnOrder}
              visibleColumns={visibleColumns}
              onToggle={toggleColumn}
              onReorder={setColumnOrder}
              onClose={() => setColumnsOpen(false)}
            />
          )}
        </div>

        {/* Upload / Ingest Attack Button (Clients and Admins only) */}
        {role !== "analyst" && (
          <Button
            size="sm"
            onClick={() => setUploadOpen(true)}
            className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium flex items-center gap-1.5 ml-auto shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Attack</span>
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="glass rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                {orderedVisible.map((key) => {
                  const col = columnMap[key]
                  if (!col) return null
                  const isSorted = col.sortKey === sortKey
                  return (
                    <th key={key} className={thClass(col)}>
                      {col.sortKey ? (
                        <button
                          onClick={() => handleSort(col.sortKey!)}
                          className={cn(
                            "inline-flex items-center gap-1 hover:text-foreground transition-colors",
                            isSorted && "text-foreground"
                          )}
                        >
                          {col.label}
                          <SortIcon colKey={col.sortKey} sortKey={sortKey} direction={sortDirection} />
                        </button>
                      ) : (
                        col.label
                      )}
                    </th>
                  )
                })}
                {/* Chevron column */}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((alert) => (
                <tr
                  key={alert.id}
                  className="border-b border-border/20 last:border-0 hover:bg-foreground/[0.025] transition-colors group cursor-pointer"
                  onClick={(e) => {
                    // Don't navigate if clicking interactive controls in the row
                    if ((e.target as HTMLElement).closest("a,select,option,button,input")) return
                    window.location.href = `/dashboard/alerts/${alert.id}`
                  }}
                >
                  {orderedVisible.map((key) => {
                    const col = columnMap[key]
                    if (!col) return null
                    return (
                      <td key={key} className={tdClass(col)}>
                        {key === "severity" && <SeverityBadge severity={alert.severity} />}

                        {key === "id" && (
                          <span className="text-[11px] font-mono text-muted-foreground">{alert.id}</span>
                        )}

                        {key === "alert" && (
                          <div className="flex flex-col">
                            <Link
                              href={`/dashboard/alerts/${alert.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-foreground/90 hover:text-foreground font-medium transition-colors"
                            >
                              {isEnrichmentPending(alert) ? (
                                <span className="inline-block h-3 w-36 rounded bg-muted animate-pulse align-middle" />
                              ) : (
                                alert.title
                              )}
                            </Link>
                            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-md truncate">
                              {alert.description}
                            </p>
                          </div>
                        )}

                        {key === "source" && (
                          <div className="flex flex-col">
                            <span className="text-[11px] font-mono text-foreground/70">{alert.source}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{alert.sourceIp}</span>
                          </div>
                        )}

                        {key === "mitreTactic" && (
                          <span className="text-[11px] text-muted-foreground">{alert.mitreTactic}</span>
                        )}

                        {key === "verdict" && (
                          <div className="flex items-center gap-2">
                            {isEnrichmentPending(alert) ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium leading-none border-border/30 text-muted-foreground bg-foreground/5 animate-pulse">
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                Analyzing…
                              </span>
                            ) : (
                              <>
                                <VerdictBadge verdict={alert.verdict} />
                                {role !== "client" && (
                                  <select
                                    value={alert.verdict}
                                    disabled={!!updatingRows[alert.id]}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      e.stopPropagation()
                                      handleInlineVerdictChange(alert.id, e.target.value as AlertVerdict)
                                    }}
                                    className="h-7 rounded-md border border-slate-800 bg-[#0a1020] px-2 text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 disabled:opacity-60 cursor-pointer"
                                  >
                                    <option value="malicious">Malicious</option>
                                    <option value="suspicious">Suspicious</option>
                                    <option value="false_positive">False Positive</option>
                                  </select>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {key === "incident" && (
                          <div className="flex items-center gap-2">
                            <StatusBadge status={alert.incidentStatus} />
                            {role !== "client" && (
                              <select
                                value={alert.incidentStatus}
                                disabled={!!updatingRows[alert.id]}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  handleInlineIncidentChange(alert.id, e.target.value as IncidentStatus)
                                }}
                                className="h-7 rounded-md border border-slate-800 bg-[#0a1020] px-2 text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 disabled:opacity-60 cursor-pointer"
                              >
                                <option value="unassigned">Unassigned</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                              </select>
                            )}
                          </div>
                        )}

                        {key === "aiScore" && (
                          <ScoreRing label="AI" score={alert.enrichment.aiScore} size={44} loading={isEnrichmentPending(alert)} />
                        )}

                        {key === "heuristicsScore" && (
                          <ScoreRing label="Heur" score={alert.enrichment.heuristicsScore} size={44} loading={isEnrichmentPending(alert)} />
                        )}

                        {key === "alertTime" && (
                          <TimeCell
                            ts={alert.timestamp}
                            label="Event"
                          />
                        )}

                        {key === "ingestedAt" && (
                          <TimeCell
                            ts={alert.ingestedAt || alert.timestamp}
                            label="Ingested"
                            dimmed
                          />
                        )}

                        {key === "lastAnalyzed" && (
                          <TimeCell
                            ts={alert.lastAnalyzedAt}
                            label="Analyzed"
                            dimmed
                            fallback="—"
                          />
                        )}
                      </td>
                    )
                  })}
                  <td className="px-2 py-3 w-8">
                    <Link href={`/dashboard/alerts/${alert.id}`} onClick={(e) => e.stopPropagation()}>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-foreground/60 transition-colors" />
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={orderedVisible.length + 1}
                    className="px-4 py-16 text-center"
                  >
                    <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
                      <div className="w-10 h-10 rounded-full bg-muted/30 border border-border/50 flex items-center justify-center text-muted-foreground">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">No alerts match your filters</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {alerts.length === 0
                            ? role === "analyst"
                              ? "No security incidents or attack alerts found. Sensor telemetry streams are monitored in real-time."
                              : "No cyber attacks or logs have been ingested yet. Upload a log or paste an attack to see instant AI threat intelligence."
                            : "Try adjusting your search query or severity filters."}
                        </p>
                      </div>
                      {alerts.length === 0 ? (
                        role !== "analyst" && (
                          <Button
                            size="sm"
                            onClick={() => setUploadOpen(true)}
                            className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium flex items-center gap-1.5 mt-1 shadow-sm"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload / Submit Cyber Attack</span>
                          </Button>
                        )
                      ) : (
                        searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className="mt-1 text-xs text-muted-foreground/60 hover:text-muted-foreground underline"
                          >
                            Clear search
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {filtered.length === alerts.length
            ? `${alerts.length} alert${alerts.length !== 1 ? "s" : ""}`
            : `${filtered.length} of ${alerts.length} alerts`}
        </p>
        {sortKey !== "timestamp" && (
          <button
            onClick={() => { setSortKey("timestamp"); setSortDirection("desc") }}
            className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground flex items-center gap-1"
          >
            <X className="w-2.5 h-2.5" />
            Clear sort
          </button>
        )}
      </div>

      {/* Dedicated Upload Dialog */}
      <LogUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  )
}
