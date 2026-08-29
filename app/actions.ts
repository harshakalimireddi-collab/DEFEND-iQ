"use server"

import { login, logout, getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { getSetting, setSetting } from "@/lib/db/settings"
import { changePassword, createUser, forceSetPassword, isDefaultAdminPassword, listUsers } from "@/lib/db/users"
import { deleteAlert as dbDeleteAlert, updateAlertIncidentStatus as dbUpdateAlertIncidentStatus, updateAlertVerdict as dbUpdateAlertVerdict } from "@/lib/db/alerts"
import { addThreatFeed, removeThreatFeed, toggleThreatFeed, updateThreatFeedApiKey } from "@/lib/db/threat-feeds"
import { toggleYaraRule } from "@/lib/db/yara-rules"
import { createAlertNote, getAlertNotes } from "@/lib/db/alert-notes"
import type { IncidentStatus, AlertVerdict, UserRole } from "@/lib/types"
import { systemLog } from "@/lib/system-log"
import path from "path"
import fs from "fs"
import { execFile } from "child_process"
import { promisify } from "util"
import { getSigmaStatus } from "@/lib/sigma"
import { consumeRateLimit, hashActor } from "@/lib/security/rate-limit"
import { ingestLog } from "@/lib/pipeline"

const execFileAsync = promisify(execFile)

async function requireSessionState() {
  const session = await getSession()
  if (!session) return { ok: false as const, error: "Not authenticated" }
  return { ok: true as const, session }
}

function isAdminSession(session: { role?: UserRole } | null): boolean {
  return !!session && session.role === "admin"
}

// Auth actions

export async function loginAction(_prevState: { error: string } | null, formData: FormData) {
  const username = String(formData.get("username") || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
  const password = String(formData.get("password") || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")

  if (!username || !password) {
    return { error: "Username and password are required" }
  }

  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown"
  const actor = hashActor(`${ip}:${username.toLowerCase()}`)
  const rl = consumeRateLimit({
    scope: "auth:login",
    actor,
    limit: 25, // Generous limit for testing & local development
    windowMs: 15 * 60_000,
  })
  if (!rl.allowed) {
    return { error: "Too many login attempts. Try again in a few minutes." }
  }

  const success = await login(username, password)

  if (!success) {
    return { error: "Invalid credentials. Please check your username and password." }
  }

  const session = await getSession()
  if (session?.role === "client") {
    redirect("/dashboard/upload")
  } else if (session?.role === "analyst") {
    redirect("/dashboard/alerts")
  } else {
    redirect("/dashboard")
  }
}

export async function registerClientAction(_prevState: { error: string } | null, formData: FormData) {
  const username = (formData.get("username") as string || "").trim().toLowerCase()
  const password = (formData.get("password") as string || "").trim()
  const confirmPassword = (formData.get("confirmPassword") as string || "").trim()

  if (!username || !password) {
    return { error: "Username and password are required" }
  }
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return { error: "Username must be 3-32 characters (letters, numbers, ., _, -)" }
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" }
  }
  if (confirmPassword && password !== confirmPassword) {
    return { error: "Passwords do not match" }
  }

  try {
    await createUser(username, password, "client")
    await login(username, password)
  } catch (err) {
    const msg = String(err)
    if (/unique|constraint/i.test(msg)) {
      return { error: "Username already taken. Please choose another." }
    }
    return { error: "Registration failed: " + msg }
  }

  redirect("/dashboard/upload")
}

export async function logoutAction() {
  await logout()
  redirect("/login")
}

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: "Not authenticated" }

  if (newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" }
  }

  return changePassword(session.user, currentPassword, newPassword)
}

export async function forceChangeDefaultPasswordAction(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: "Not authenticated" }
  if (!isAdminSession(session)) return { success: false, error: "Only admin can change default password" }
  if (newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" }
  }

  const isDefault = await isDefaultAdminPassword()
  if (!isDefault) return { success: false, error: "Default password already changed" }

  await forceSetPassword("admin", newPassword)
  return { success: true }
}

export async function listUsersAction(): Promise<{ success: boolean; users?: Awaited<ReturnType<typeof listUsers>>; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: "Not authenticated" }
  if (!isAdminSession(session)) return { success: false, error: "Only admin can view users" }
  try {
    const users = await listUsers()
    return { success: true, users }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function createAnalystUserAction(
  username: string,
  password: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: "Not authenticated" }
  if (!isAdminSession(session)) return { success: false, error: "Only admin can create users" }

  const cleanUsername = username.trim().toLowerCase()
  if (!/^[a-z0-9._-]{3,32}$/.test(cleanUsername)) {
    return { success: false, error: "Username must be 3-32 chars (a-z, 0-9, ., _, -)" }
  }
  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" }
  }

  try {
    const userId = await createUser(cleanUsername, password, "analyst")
    revalidatePath("/dashboard/settings")
    return { success: true, userId }
  } catch (err) {
    const msg = String(err)
    if (/unique|constraint/i.test(msg)) return { success: false, error: "Username already exists" }
    return { success: false, error: msg }
  }
}

export async function submitAttackAction(data: {
  source: string
  message: string
  severity?: "critical" | "high" | "medium" | "low" | "info"
}): Promise<{ success: boolean; alertId?: string; logId?: string; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: "Not authenticated" }
  if (!data.message?.trim()) return { success: false, error: "Attack telemetry/message is required" }

  try {
    const result = await ingestLog({
      source: data.source?.trim() || "Defense-Tactical-Sensor",
      message: data.message.trim(),
      severity: data.severity,
      parsed: true,
    })
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/alerts")
    return { success: true, logId: result.logId, alertId: result.alertId }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// Settings actions

export async function saveSettingsAction(
  section: string,
  data: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireSessionState()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!isAdminSession(auth.session)) return { success: false, error: "Only admin can update settings" }

  try {
    const parsed = JSON.parse(data) as Record<string, unknown>

    if (section === "llm") {
      const clampNum = (value: unknown, min: number, max: number, fallback: number) => {
        const n = Number(value)
        if (Number.isNaN(n)) return fallback
        return Math.max(min, Math.min(max, n))
      }
      const apiKey = String(parsed.apiKey || "").trim()
      if (/\s/.test(apiKey)) {
        return { success: false, error: "LLM API key looks invalid (contains spaces/newlines). Paste only the key value." }
      }
      parsed.provider = "openai"
      parsed.apiKey = apiKey
      parsed.neverAutoResolveLowEvidence = parsed.neverAutoResolveLowEvidence !== false
      parsed.minAutoResolveEvidence = clampNum(parsed.minAutoResolveEvidence, 0, 100, 55)
      parsed.fpAutoResolveThreshold = clampNum(parsed.fpAutoResolveThreshold, 0, 100, 30)

      const sourceThresholds = parsed.sourceThresholds
      if (sourceThresholds && typeof sourceThresholds === "object" && !Array.isArray(sourceThresholds)) {
        const cleaned: Record<string, Record<string, number>> = {}
        for (const [source, raw] of Object.entries(sourceThresholds as Record<string, unknown>)) {
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue
          const src = source.trim().toLowerCase()
          if (!src) continue
          const row = raw as Record<string, unknown>
          const out: Record<string, number> = {}
          if (row.maliciousThreshold !== undefined) out.maliciousThreshold = clampNum(row.maliciousThreshold, 1, 100, 80)
          if (row.suspiciousThreshold !== undefined) out.suspiciousThreshold = clampNum(row.suspiciousThreshold, 1, 99, 45)
          if (row.fpAutoResolveThreshold !== undefined) out.fpAutoResolveThreshold = clampNum(row.fpAutoResolveThreshold, 0, 100, 30)
          if (row.minAutoResolveEvidence !== undefined) out.minAutoResolveEvidence = clampNum(row.minAutoResolveEvidence, 0, 100, 55)
          if (Object.keys(out).length > 0) cleaned[src] = out
        }
        parsed.sourceThresholds = cleaned
      } else {
        parsed.sourceThresholds = {}
      }

      const agents = parsed.agents
      if (Array.isArray(agents)) {
        parsed.agents = agents
          .filter((v) => !!v && typeof v === "object")
          .map((raw, idx) => {
            const row = raw as Record<string, unknown>
            const model = String(row.model || parsed.model || "gpt-4.1-nano").trim()
            const prompt = String(row.prompt || "").trim()
            return {
              id: String(row.id || `agent_${idx + 1}`).trim().toLowerCase(),
              name: String(row.name || `Agent ${idx + 1}`).trim().slice(0, 80),
              description: String(row.description || "").trim().slice(0, 220),
              enabled: row.enabled !== false,
              model: model || "gpt-4.1-nano",
              prompt: prompt.slice(0, 4000),
              maxTokens: clampNum(row.maxTokens, 64, 4096, clampNum(parsed.maxTokens, 64, 4096, 700)),
              temperature: clampNum(row.temperature, 0, 2, clampNum(parsed.temperature, 0, 2, 0.1)),
            }
          })
          .filter((a) => a.prompt.length > 0)
          .slice(0, 8)
      } else {
        parsed.agents = []
      }
    }

    if (section === "api") {
      const enabled = parsed.enabled !== false
      const apiKey = String(parsed.apiKey || "").trim()
      if (enabled && apiKey.length < 24) {
        return { success: false, error: "API key must be set and at least 24 characters long." }
      }
      parsed.apiKey = apiKey
    }

    await setSetting(section, parsed)
    revalidatePath("/dashboard/settings")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function getSigmaStatusAction(): Promise<{ success: boolean; status?: Awaited<ReturnType<typeof getSigmaStatus>>; error?: string }> {
  const auth = await requireSessionState()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!isAdminSession(auth.session)) return { success: false, error: "Only admin can view Sigma status" }

  try {
    const status = await getSigmaStatus()
    return { success: true, status }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function syncSigmaRulesAction(): Promise<{ success: boolean; status?: Awaited<ReturnType<typeof getSigmaStatus>>; error?: string }> {
  const auth = await requireSessionState()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!isAdminSession(auth.session)) return { success: false, error: "Only admin can sync Sigma rules" }

  try {
    const baseDir = path.join(process.cwd(), "data", "sigma")
    const rulesPath = path.join(baseDir, "rules")

    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true })

    const isRepo = fs.existsSync(path.join(baseDir, ".git"))

    systemLog("info", "sigma", isRepo ? "Updating SigmaHQ repository" : "Cloning SigmaHQ repository", { baseDir })

    if (isRepo) {
      await execFileAsync("git", ["-C", baseDir, "pull"])
    } else {
      await execFileAsync("git", ["clone", "https://github.com/SigmaHQ/sigma.git", baseDir])
    }

    const existing = await getSetting<Record<string, unknown>>("sigma", { enabled: true, rulesPath, maxRules: 500 })
    const updated = {
      ...existing,
      enabled: true,
      rulesPath,
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: "success",
      lastSyncError: "",
    }
    await setSetting("sigma", updated)

    const status = await getSigmaStatus()
    systemLog("info", "sigma", "SigmaHQ sync complete", { compiled: status.compiled, totalFiles: status.totalFiles })
    return { success: true, status }
  } catch (err) {
    const existing = await getSetting<Record<string, unknown>>("sigma", { enabled: false, rulesPath: "", maxRules: 500 })
    await setSetting("sigma", {
      ...existing,
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: "error",
      lastSyncError: String(err),
    })
    systemLog("error", "sigma", "SigmaHQ sync failed", { error: String(err) })
    return { success: false, error: String(err) }
  }
}

// Alert actions

export async function updateAlertIncidentStatusAction(
  alertId: string,
  incidentStatus: IncidentStatus
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session || session.role === "client") {
    return { success: false, error: "Unauthorized: Clients have read-only access to alerts" }
  }
  await dbUpdateAlertIncidentStatus(alertId, incidentStatus)
  revalidatePath("/dashboard/alerts")
  revalidatePath(`/dashboard/alerts/${alertId}`)
  revalidatePath("/dashboard")
  return { success: true }
}

export async function updateAlertVerdictAction(
  alertId: string,
  verdict: AlertVerdict
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session || session.role === "client") {
    return { success: false, error: "Unauthorized: Clients have read-only access to alerts" }
  }
  await dbUpdateAlertVerdict(alertId, verdict)
  revalidatePath("/dashboard/alerts")
  revalidatePath(`/dashboard/alerts/${alertId}`)
  revalidatePath("/dashboard")
  return { success: true }
}

export async function deleteAlertAction(alertId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session || session.role === "client") {
    return { success: false, error: "Unauthorized: Clients cannot delete alerts" }
  }
  try {
    await dbDeleteAlert(alertId)
    revalidatePath("/dashboard/alerts")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// Threat feed actions

export async function addThreatFeedAction(data: {
  name: string
  url: string
  apiKey?: string
}): Promise<{ success: boolean; id?: string }> {
  const auth = await requireSessionState()
  if (!auth.ok || !isAdminSession(auth.session)) return { success: false }
  const id = await addThreatFeed(data)
  revalidatePath("/dashboard/settings")
  return { success: true, id }
}

export async function removeThreatFeedAction(id: string): Promise<{ success: boolean }> {
  const auth = await requireSessionState()
  if (!auth.ok || !isAdminSession(auth.session)) return { success: false }
  await removeThreatFeed(id)
  revalidatePath("/dashboard/settings")
  return { success: true }
}

export async function toggleThreatFeedAction(
  id: string,
  enabled: boolean
): Promise<{ success: boolean }> {
  const auth = await requireSessionState()
  if (!auth.ok || !isAdminSession(auth.session)) return { success: false }
  await toggleThreatFeed(id, enabled)
  revalidatePath("/dashboard/settings")
  return { success: true }
}

export async function updateThreatFeedApiKeyAction(
  id: string,
  apiKey: string
): Promise<{ success: boolean }> {
  const auth = await requireSessionState()
  if (!auth.ok || !isAdminSession(auth.session)) return { success: false }
  await updateThreatFeedApiKey(id, apiKey)
  revalidatePath("/dashboard/settings")
  return { success: true }
}

// YARA rule actions

export async function toggleYaraRuleAction(
  id: string,
  enabled: boolean
): Promise<{ success: boolean }> {
  const auth = await requireSessionState()
  if (!auth.ok || !isAdminSession(auth.session)) return { success: false }
  await toggleYaraRule(id, enabled)
  revalidatePath("/dashboard/settings")
  return { success: true }
}

// YARA details action
export async function getYaraDetailsAction(
  alertId: string
): Promise<{ success: boolean; rules?: import("@/lib/yara").YaraRuleResult[]; error?: string }> {
  try {
    const { getAlertById } = await import("@/lib/db/alerts")
    const { scanAllRules } = await import("@/lib/yara")
    const alert = await getAlertById(alertId)
    if (!alert) return { success: false, error: "Alert not found" }
    const rules = await scanAllRules(alert.rawLog)
    return { success: true, rules }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// Enrichment action (trigger LLM enrichment)
export async function triggerEnrichmentAction(
  alertId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { enrichAlertWithLLM } = await import("@/lib/llm/enrich")
    await enrichAlertWithLLM(alertId)
    revalidatePath(`/dashboard/alerts/${alertId}`)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// Trigger threat intel enrichment
export async function triggerThreatIntelAction(
  alertId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { enrichAlertWithThreatIntel } = await import("@/lib/threat-intel/enrich")
    await enrichAlertWithThreatIntel(alertId)
    revalidatePath(`/dashboard/alerts/${alertId}`)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function getAlertNotesAction(
  alertId: string
): Promise<{ success: boolean; notes?: Awaited<ReturnType<typeof getAlertNotes>>; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: "Not authenticated" }
  try {
    const notes = await getAlertNotes(alertId)
    return { success: true, notes }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function addAlertNoteAction(
  alertId: string,
  noteText: string,
  imageData?: string | null,
  imageMime?: string | null
): Promise<{ success: boolean; noteId?: string; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: "Not authenticated" }

  const text = noteText.trim()
  if (!text) return { success: false, error: "Note text is required" }
  if (text.length > 4000) return { success: false, error: "Note is too long (max 4000 chars)" }

  const safeMime = (imageMime || "").trim().toLowerCase()
  const safeData = (imageData || "").trim()
  if (safeData) {
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(safeData)) {
      return { success: false, error: "Invalid image format" }
    }
    if (safeData.length > 3_000_000) {
      return { success: false, error: "Image is too large" }
    }
  }

  try {
    const noteId = await createAlertNote({
      alertId,
      username: session.user,
      noteText: text,
      imageData: safeData || null,
      imageMime: safeMime || null,
    })
    revalidatePath(`/dashboard/alerts/${alertId}`)
    return { success: true, noteId }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
