import { ClientUploadView } from "@/components/client-upload-view"
import { getAlerts } from "@/lib/db/alerts"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function ClientUploadPage() {
  const session = await getSession()
  if (session?.role === "analyst") {
    redirect("/dashboard")
  }

  const recentAlerts = await getAlerts({ limit: 10 })

  return <ClientUploadView recentSubmissions={recentAlerts} />
}
