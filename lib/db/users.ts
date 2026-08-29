import { getDb, persistDb } from "./index"
import { hashSync, compareSync } from "bcryptjs"
import { nanoid } from "nanoid"

function stmtToObjects(db: Awaited<ReturnType<typeof getDb>>, sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const stmt = db.prepare(sql)
  if (params.length) stmt.bind(params)
  const results: Record<string, unknown>[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  return results
}

import type { UserRole } from "@/lib/types"

function normalizeRole(r: unknown): UserRole {
  const s = String(r || "").toLowerCase()
  if (s === "admin") return "admin"
  if (s === "client") return "client"
  return "analyst"
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<{ id: string; username: string; role: UserRole } | null> {
  // Always get fresh DB instance so users added via manage-users.js or signup are immediately recognized
  const db = await getDb(true)

  const cleanUser = String(username || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()

  const rawPass = String(password || "").replace(/[\u200B-\u200D\uFEFF]/g, "")
  const cleanPass = rawPass.trim().replace(/^['"]|['"]$/g, "") // strip quotes if pasted from terminal

  const rows = stmtToObjects(
    db,
    "SELECT id, username, role, password_hash FROM users WHERE LOWER(username) = LOWER(?)",
    [cleanUser]
  )
  if (rows.length === 0) return null

  const user = rows[0]
  const storedHash = String(user.password_hash || "")

  // Test sanitized, trimmed, and raw variations
  const isMatch =
    compareSync(cleanPass, storedHash) ||
    compareSync(rawPass.trim(), storedHash) ||
    compareSync(rawPass, storedHash)

  if (!isMatch) return null

  return {
    id: user.id as string,
    username: user.username as string,
    role: normalizeRole(user.role),
  }
}

export async function changePassword(
  username: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb()
  const rows = stmtToObjects(db, "SELECT id, password_hash FROM users WHERE username = ?", [username])
  if (rows.length === 0) return { success: false, error: "User not found" }

  const user = rows[0]
  if (!compareSync(currentPassword.trim(), user.password_hash as string)) {
    return { success: false, error: "Current password is incorrect" }
  }

  const hash = hashSync(newPassword.trim(), 10)
  db.run("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?", [hash, user.id as string])
  persistDb()
  return { success: true }
}

export async function createUser(username: string, password: string, role: UserRole = "analyst"): Promise<string> {
  const db = await getDb()
  const id = nanoid()
  const cleanUser = username.trim().toLowerCase()
  const cleanPass = password.trim()
  const validRole = normalizeRole(role)

  const hash = hashSync(cleanPass, 10)
  db.run("INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)", [id, cleanUser, hash, validRole])
  persistDb()
  return id
}

export async function listUsers(): Promise<Array<{ id: string; username: string; role: UserRole; createdAt: string }>> {
  const db = await getDb()
  const rows = stmtToObjects(
    db,
    "SELECT id, username, role, created_at FROM users ORDER BY CASE WHEN role = 'admin' THEN 0 WHEN role = 'analyst' THEN 1 ELSE 2 END, username ASC"
  )
  return rows.map((r) => ({
    id: r.id as string,
    username: r.username as string,
    role: normalizeRole(r.role),
    createdAt: (r.created_at as string) || "",
  }))
}

export async function isDefaultAdminPassword(): Promise<boolean> {
  const db = await getDb()
  const rows = stmtToObjects(db, "SELECT username, password_hash FROM users WHERE username = ?", ["admin"])
  if (rows.length === 0) return false
  return compareSync("admin", rows[0].password_hash as string)
}

export async function forceSetPassword(username: string, newPassword: string): Promise<void> {
  const db = await getDb()
  const hash = hashSync(newPassword, 10)
  db.run("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE username = ?", [hash, username])
  persistDb()
}
