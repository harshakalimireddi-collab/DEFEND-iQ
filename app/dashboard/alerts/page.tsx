import { AlertsView } from "@/components/alerts-view"
import { getAlerts } from "@/lib/db/alerts"
import { getSession } from "@/lib/auth"
import { ShieldAlert, Sparkles, Clock } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AlertsPage() {
  const session = await getSession()
  const role = session?.role || "analyst"
  const isClient = role === "client"

  const alerts = await getAlerts({ limit: 200 })

  return (
    <div className="p-6 md:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Alerts Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider font-mono border ${
                isClient
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  : "bg-purple-500/10 text-purple-400 border-purple-500/20"
              }`}
            >
              {isClient ? "CLIENT SUBMISSIONS" : "TRIAGE QUEUE"}
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight font-sans">
              {isClient ? "My Ingested Attacks & Verification Status" : "Cyber Incident & Attack Alert Management"}
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isClient
              ? "View status, AI triage classification, and mitigation results for your submitted telemetry"
              : "Real-time incident triage pipeline correlated with YARA/Sigma detections, Threat Intelligence feeds, and AI analysis"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold px-3 py-1 rounded-lg bg-[#080d1a] text-slate-300 border border-slate-800">
            {alerts.length} Total Incidents Loaded
          </span>
        </div>
      </div>

      <AlertsView initialAlerts={alerts} role={role} />
    </div>
  )
}
