import Link from "next/link"
import type { Alert } from "@/lib/types"
import { SeverityBadge } from "@/components/severity-badge"
import { StatusBadge } from "@/components/status-badge"
import { VerdictBadge } from "@/components/verdict-badge"
import { ArrowRight, ShieldAlert, Sparkles } from "lucide-react"

interface RecentAlertsProps {
  alerts: Alert[]
}

export function RecentAlerts({ alerts }: RecentAlertsProps) {
  return (
    <div className="rounded-xl bg-[#080d1a]/90 backdrop-blur-xl border border-slate-800/80 p-5 flex flex-col justify-between shadow-lg">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/70 mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            Live Incident Feed
          </h3>
        </div>
        <Link
          href="/dashboard/alerts"
          className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
        >
          View Full Triage Queue <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800/60">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-800/70 bg-[#0a1020] text-[11px] text-slate-400 font-mono">
              <th className="px-3.5 py-2.5 font-semibold">Severity</th>
              <th className="px-3.5 py-2.5 font-semibold">Incident Title</th>
              <th className="px-3.5 py-2.5 font-semibold hidden md:table-cell">Sensor / Source</th>
              <th className="px-3.5 py-2.5 font-semibold hidden lg:table-cell">Verdict</th>
              <th className="px-3.5 py-2.5 font-semibold hidden lg:table-cell">Status</th>
              <th className="px-3.5 py-2.5 font-semibold text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40 text-xs">
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-500">
                  No active incidents detected. Sensor telemetry streams are running and monitored in real-time.
                </td>
              </tr>
            ) : (
              alerts.map((alert) => (
                <tr
                  key={alert.id}
                  className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                >
                  <td className="px-3.5 py-3">
                    <SeverityBadge severity={alert.severity} />
                  </td>
                  <td className="px-3.5 py-3">
                    <Link
                      href={`/dashboard/alerts/${alert.id}`}
                      className="font-semibold text-slate-200 group-hover:text-blue-400 transition-colors block truncate max-w-xs"
                    >
                      {alert.title}
                    </Link>
                  </td>
                  <td className="px-3.5 py-3 hidden md:table-cell font-mono text-[11px] text-slate-400">
                    {alert.source}
                  </td>
                  <td className="px-3.5 py-3 hidden lg:table-cell">
                    <VerdictBadge verdict={alert.verdict} />
                  </td>
                  <td className="px-3.5 py-3 hidden lg:table-cell">
                    <StatusBadge status={alert.incidentStatus} />
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono text-[11px] text-slate-400">
                    {new Date(alert.timestamp).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
