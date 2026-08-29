import { OverviewStats } from "@/components/overview-stats"
import { AlertTimeline } from "@/components/alert-timeline"
import { RecentAlerts } from "@/components/recent-alerts"
import { SourceDistribution } from "@/components/source-distribution"
import { MitreHeatmap } from "@/components/mitre-heatmap"
import { SystemStatus } from "@/components/system-status"
import { DetectionQuality } from "@/components/detection-quality"
import { getAlertCounts, getTimelineData, getSourceDistribution, getTopMitreTechniques, getAlerts } from "@/lib/db/alerts"
import { getAllSettings } from "@/lib/db/settings"
import { getDetectionQualityReport } from "@/lib/metrics/detection-quality"
import { Shield, Sparkles, Activity } from "lucide-react"

import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function DashboardOverview() {
  const session = await getSession()
  if (session?.role === "client") {
    redirect("/dashboard/upload")
  }

  const [counts, timeline, sources, mitre, recentAlerts, settings, quality] = await Promise.all([
    getAlertCounts(),
    getTimelineData(24),
    getSourceDistribution(),
    getTopMitreTechniques(6),
    getAlerts({ limit: 6 }),
    getAllSettings(),
    getDetectionQualityReport(2000),
  ])

  return (
    <div className="p-6 md:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Overview Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
              DEFEND iQ COMMAND
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight font-sans">
              Executive Security Posture & Real-Time Triage
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time defense intelligence correlating SIEM telemetry, YARA/Sigma rules, and multi-agent AI threat containment
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#080d1a] border border-slate-800 text-xs text-slate-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
            <span>Telemetry Ingestion: Active</span>
          </div>
        </div>
      </div>

      {/* KPI Stats Row */}
      <OverviewStats counts={counts} />

      {/* Detection Quality Index */}
      <DetectionQuality report={quality} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AlertTimeline data={timeline} />
        </div>
        <SourceDistribution data={sources} />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentAlerts alerts={recentAlerts} />
        </div>
        <div className="flex flex-col gap-6">
          <MitreHeatmap data={mitre} />
          <SystemStatus settings={settings} />
        </div>
      </div>
    </div>
  )
}
