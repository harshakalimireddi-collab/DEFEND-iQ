import { getAlertById } from "@/lib/db/alerts"
import { notFound } from "next/navigation"
import { AlertDetail } from "@/components/alert-detail"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { getSetting } from "@/lib/db/settings"
import { getThreatFeeds } from "@/lib/db/threat-feeds"
import { getSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function AlertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const alert = await getAlertById(id)
  if (!alert) notFound()

  const [llmSettings, sigmaSettings, yaraSettings, threatFeeds] = await Promise.all([
    getSetting<{ provider?: string; apiKey?: string; model?: string; analysisAgents?: number }>("llm", {}),
    getSetting<{ enabled?: boolean }>("sigma", {}),
    getSetting<{ enabled?: boolean }>("yara", {}),
    getThreatFeeds(),
  ])

  const activeThreatFeeds = threatFeeds.filter((f) => f.enabled).length
  const session = await getSession()

  const pipelineSettings = {
    sigmaEnabled: !!sigmaSettings?.enabled,
    yaraEnabled: !!yaraSettings?.enabled,
    llmConfigured: !!(llmSettings?.apiKey && llmSettings?.provider && llmSettings.provider !== "local"),
    llmProvider: llmSettings?.provider || "none",
    llmModel: llmSettings?.model || "",
    analysisAgents: llmSettings?.analysisAgents || 3,
    activeThreatFeeds,
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/alerts"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to Alerts
        </Link>
      </div>
      <AlertDetail
        alert={alert}
        pipelineSettings={pipelineSettings}
        currentUser={session?.user || "unknown"}
        role={session?.role || "analyst"}
      />
    </div>
  )
}
