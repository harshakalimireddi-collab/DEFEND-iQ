import { SettingsView } from "@/components/settings-view"
import { getAllSettings } from "@/lib/db/settings"
import { getThreatFeeds } from "@/lib/db/threat-feeds"
import { getYaraRules } from "@/lib/db/yara-rules"
import { requireAuth } from "@/lib/auth"
import { listUsers } from "@/lib/db/users"
import { redirect } from "next/navigation"

export default async function SettingsPage() {
  const session = await requireAuth()
  
  // Strict Role Guard: Only Admin can access Settings & User Management
  if (session.role !== "admin") {
    if (session.role === "client") {
      redirect("/dashboard/upload")
    } else {
      redirect("/dashboard/alerts")
    }
  }

  const settings = await getAllSettings()
  const feeds = await getThreatFeeds()
  const yaraRules = await getYaraRules()
  const users = await listUsers()

  return (
    <div className="p-6 md:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
            ADMIN ONLY
          </span>
          <h1 className="text-xl font-bold text-white tracking-tight font-sans">
            System Settings & User Management
          </h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Configure Defend iQ engine integrations, LLM providers, YARA/Sigma rules, and manage user accounts
        </p>
      </div>

      <SettingsView
        initialSettings={settings}
        initialFeeds={feeds}
        initialYaraRules={yaraRules}
        initialUsers={users}
        currentUser={session.user}
      />
    </div>
  )
}
