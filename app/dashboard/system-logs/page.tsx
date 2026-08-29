import { SystemLogsView } from "@/components/system-logs-view"
import { requireAuth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function SystemLogsPage() {
  const session = await requireAuth()

  // Strict Role Guard: Clients cannot view internal system telemetry logs
  if (session.role === "client") {
    redirect("/dashboard/upload")
  }

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <SystemLogsView />
    </div>
  )
}
