import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { authenticateUser } from "@/lib/db/users"
import crypto from "crypto"

import type { UserRole } from "@/lib/types"

const SESSION_COOKIE = "soc-beacon-session"
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

type SessionPayload = {
  user: string
  role: UserRole
  ts: number
  exp: number
}

function getSessionSecret(): string {
  const secret = (process.env.SOC_BEACON_SESSION_SECRET || "").trim()
  if (secret) return secret
  return "defend-iq-production-session-fallback-secret-2026"
}

function toB64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url")
}

function sign(data: string): string {
  return toB64Url(crypto.createHmac("sha256", getSessionSecret()).update(data).digest())
}

function encodeSession(payload: SessionPayload): string {
  const body = toB64Url(JSON.stringify(payload))
  const signature = sign(body)
  return `${body}.${signature}`
}

function decodeSession(token: string): SessionPayload | null {
  const [body, signature] = token.split(".")
  if (!body || !signature) return null

  const expected = sign(body)
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length) return null
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload
    if (!payload?.user || (payload.role !== "admin" && payload.role !== "analyst" && payload.role !== "client")) return null
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

export async function login(username: string, password: string): Promise<boolean> {
  const user = await authenticateUser(username, password)
  if (user) {
    const cookieStore = await cookies()
    const now = Date.now()
    const token = encodeSession({
      user: user.username,
      role: user.role,
      ts: now,
      exp: now + SESSION_TTL_SECONDS * 1000,
    })
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    })
    return true
  }
  return false
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function getSession(): Promise<{ user: string; role?: UserRole } | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE)
  if (!session?.value) return null
  const decoded = decodeSession(session.value)
  if (!decoded) return null
  return { user: decoded.user, role: decoded.role }
}

export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }
  return session
}
