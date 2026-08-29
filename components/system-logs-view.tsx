"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, RefreshCw, Trash2, Terminal, Radio } from "lucide-react"

interface SystemLogEntry {
  id: string
  ts: string
  level: "debug" | "info" | "warn" | "error"
  source: string
  message: string
  meta?: Record<string, unknown>
}

export function SystemLogsView() {
  const [logs, setLogs] = useState<SystemLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const loadLogs = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/v1/system-logs?limit=300", { cache: "no-store" })
      const data = await res.json()
      if (res.ok) setLogs(data.logs || [])
    } finally {
      setLoading(false)
    }
  }

  const clearLogs = async () => {
    setClearing(true)
    try {
      await fetch("/api/v1/system-logs", { method: "DELETE" })
      setLogs([])
    } finally {
      setClearing(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => {
      loadLogs()
    }, 5000)
    return () => clearInterval(id)
  }, [autoRefresh])

  return (
    <div className="rounded-xl bg-[#080d1a]/90 backdrop-blur-xl border border-slate-800/80 p-6 flex flex-col gap-5 shadow-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-800/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Engine Telemetry & Runtime Stream
            </h2>
            <p className="text-[11px] text-slate-400">
              Live daemon runtime logs for Sigma matching, LLM triage, and Syslog receiver
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`h-8 rounded-lg border px-3 text-[11px] font-mono font-semibold flex items-center gap-1.5 transition-all ${
              autoRefresh
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm"
                : "bg-slate-800/40 text-slate-400 border-slate-800 hover:text-white"
            }`}
          >
            <Radio className={`w-3 h-3 ${autoRefresh ? "animate-pulse text-emerald-400" : ""}`} />
            {autoRefresh ? "Live Tail: Active" : "Live Tail: Paused"}
          </button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2.5 bg-[#0a1020] border-slate-800 hover:bg-slate-800"
            onClick={loadLogs}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2.5 bg-[#0a1020] border-slate-800 hover:bg-red-500/10 hover:text-red-400"
            onClick={clearLogs}
            disabled={clearing}
          >
            {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800/80 overflow-hidden bg-[#070b16]">
        <Table>
          <TableHeader>
            <tr className="border-b border-slate-800/80 bg-[#0a1020] text-[11px] font-mono text-slate-400">
              <TableHead className="text-slate-400 font-semibold px-4 py-2.5">Time</TableHead>
              <TableHead className="text-slate-400 font-semibold px-4 py-2.5">Severity</TableHead>
              <TableHead className="text-slate-400 font-semibold px-4 py-2.5">Daemon Source</TableHead>
              <TableHead className="text-slate-400 font-semibold px-4 py-2.5">Log Payload</TableHead>
            </tr>
          </TableHeader>
          <TableBody className="divide-y divide-slate-800/40 font-mono text-xs">
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-xs text-slate-500 text-center py-10">
                  No engine telemetry recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} className="hover:bg-slate-800/20 transition-colors">
                  <TableCell className="text-[11px] text-slate-400 whitespace-nowrap px-4 py-2.5">
                    {new Date(log.ts).toLocaleTimeString("en-US", { hour12: false })}
                  </TableCell>
                  <TableCell className="text-[11px] uppercase px-4 py-2.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                        log.level === "error"
                          ? "bg-red-500/10 text-red-400 border-red-500/30"
                          : log.level === "warn"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : log.level === "debug"
                          ? "bg-slate-800/60 text-slate-400 border-slate-700/50"
                          : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      }`}
                    >
                      {log.level}
                    </span>
                  </TableCell>
                  <TableCell className="text-[11px] text-slate-300 font-semibold px-4 py-2.5">
                    {log.source}
                  </TableCell>
                  <TableCell className="text-[11px] text-slate-200 px-4 py-2.5 break-all leading-relaxed">
                    <span>{log.message}</span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
