"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { forceChangeDefaultPasswordAction, logoutAction } from "@/app/actions"
import {
  LayoutDashboard,
  ShieldAlert,
  Settings,
  FileText,
  Lightbulb,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Lock,
  Sun,
  Moon,
  Upload,
  Shield,
  Activity,
  Zap,
  Radio,
  Search,
  User,
  Sparkles,
} from "lucide-react"
import { useState, useTransition } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import type { UserRole } from "@/lib/types"
import { LogUploadDialog } from "@/components/log-upload-dialog"

export function DashboardShell({
  children,
  user,
  role = "analyst",
  requirePasswordReset,
}: {
  children: React.ReactNode
  user: string
  role?: UserRole
  requirePasswordReset: boolean
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isPending, startTransition] = useTransition()
  const { resolvedTheme, setTheme } = useTheme()
  const darkMode = resolvedTheme !== "light"

  const activeNavItems =
    role === "client"
      ? [
          { href: "/dashboard/upload", label: "Upload & Ingest", icon: Upload, count: null },
          { href: "/dashboard/alerts", label: "My Submissions", icon: ShieldAlert, count: null },
          { href: "/dashboard/recommendations", label: "Defense Guidance", icon: Lightbulb, count: null },
        ]
      : role === "analyst"
      ? [
          { href: "/dashboard", label: "Security Overview", icon: LayoutDashboard, count: null },
          { href: "/dashboard/alerts", label: "Alerts Triage", icon: ShieldAlert, count: "Live" },
          { href: "/dashboard/recommendations", label: "Playbooks & Tuning", icon: Lightbulb, count: null },
          { href: "/dashboard/system-logs", label: "System Telemetry", icon: FileText, count: null },
        ]
      : [
          { href: "/dashboard", label: "Security Overview", icon: LayoutDashboard, count: null },
          { href: "/dashboard/upload", label: "Attack Ingestion", icon: Upload, count: null },
          { href: "/dashboard/alerts", label: "Alerts Triage", icon: ShieldAlert, count: "Live" },
          { href: "/dashboard/recommendations", label: "Playbooks & Tuning", icon: Lightbulb, count: null },
          { href: "/dashboard/system-logs", label: "System Telemetry", icon: FileText, count: null },
          { href: "/dashboard/settings", label: "Settings & Users", icon: Settings, count: null },
        ]

  const handleForcePasswordChange = () => {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    startTransition(async () => {
      const result = await forceChangeDefaultPasswordAction(newPassword)
      if (result.success) {
        toast.success("Password changed successfully")
        window.location.reload()
      } else {
        toast.error(result.error || "Failed to change password")
      }
    })
  }

  const roleLabel =
    role === "admin"
      ? "COMMAND CENTER"
      : role === "client"
      ? "DEFENSE CLIENT"
      : "SOC ANALYST"

  const roleBadgeStyle =
    role === "admin"
      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
      : role === "client"
      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
      : "bg-purple-500/10 text-purple-400 border-purple-500/20"

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-screen bg-[#050811] overflow-hidden">
        {/* Force Password Reset Modal */}
        <Dialog open={requirePasswordReset}>
          <DialogContent className="sm:max-w-md bg-[#080d1a] border-slate-800 text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-400 text-base">
                <Lock className="w-4 h-4" />
                Change Default Password
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                You are currently using the default system password. You must set a new secure password before continuing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium">New Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="bg-[#0a0f1d] border-slate-800 text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium">Confirm Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="bg-[#0a0f1d] border-slate-800 text-xs h-9"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleForcePasswordChange}
                disabled={isPending || newPassword.length < 8}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs h-9"
              >
                {isPending ? "Updating Password..." : "Save Secure Password"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─────────────────── DEFEND iQ SIDEBAR ─────────────────── */}
        <aside
          className={cn(
            "flex flex-col border-r border-slate-800/80 bg-[#070c18]/95 backdrop-blur-2xl transition-all duration-300 shrink-0 z-30 shadow-2xl",
            collapsed ? "w-16" : "w-60"
          )}
        >
          {/* Brand Header */}
          <div
            className={cn(
              "flex items-center h-16 border-b border-slate-800/70 px-4 shrink-0 transition-all",
              collapsed ? "justify-center" : "gap-3"
            )}
          >
            {/* DEFEND iQ Holographic Shield Icon */}
            <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
              <div className="absolute inset-0 rounded-lg bg-blue-500/20 blur-md" />
              <svg className="w-7 h-7 relative z-10 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" viewBox="0 0 48 48" fill="none">
                <path
                  d="M24 4L8 10V22C8 32.5 14.8 42.2 24 45C33.2 42.2 40 32.5 40 22V10L24 4Z"
                  stroke="url(#sideShieldGrad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="#080e1e"
                />
                <path d="M20 16L28 24L20 32" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="34" y="6" width="3.5" height="3.5" rx="1" fill="#38bdf8" />
                <defs>
                  <linearGradient id="sideShieldGrad" x1="8" y1="4" x2="40" y2="45" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#38bdf8" />
                    <stop offset="1" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-extrabold tracking-tight text-white font-sans">
                    DEFEND
                  </span>
                  <span className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    iQ
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn("text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase font-semibold", roleBadgeStyle)}>
                    {roleLabel}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Links with Clean Breathing Room */}
          <div className="px-3 pt-4 pb-1">
            {!collapsed && (
              <span className="text-[10px] font-bold uppercase font-mono tracking-wider text-slate-400 px-3">
                Security Navigation
              </span>
            )}
          </div>

          <nav className="flex-1 py-1.5 px-2.5 flex flex-col gap-1.5 overflow-y-auto">
            {activeNavItems.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href)

              const linkContent = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-xl text-xs font-medium transition-all duration-200 h-10 group relative",
                    collapsed ? "justify-center px-0" : "px-3.5 justify-between",
                    isActive
                      ? "bg-gradient-to-r from-blue-600/25 via-indigo-600/15 to-transparent text-white border border-blue-500/40 shadow-inner"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/40"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <item.icon
                      className={cn(
                        "w-4 h-4 shrink-0 transition-colors",
                        isActive ? "text-blue-400" : "text-slate-400 group-hover:text-slate-200"
                      )}
                    />
                    {!collapsed && <span className="truncate font-medium">{item.label}</span>}
                  </div>

                  {!collapsed && item.count && (
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 font-bold animate-pulse">
                      {item.count}
                    </span>
                  )}

                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-r-full shadow-[0_0_10px_#38bdf8]" />
                  )}
                </Link>
              )

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" className="bg-[#0b1120] border-slate-800 text-white text-xs">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return linkContent
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="border-t border-slate-800/70 p-2.5 shrink-0 flex flex-col gap-1 bg-[#060a14]/60">
            {/* Collapse Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                "h-8 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg text-xs",
                collapsed ? "w-full justify-center px-0" : "w-full justify-start px-2.5"
              )}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              {!collapsed && <span className="ml-2">Minimize</span>}
            </Button>

            {/* Logout Form */}
            <form action={logoutAction}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg text-xs w-full transition-colors",
                      collapsed ? "justify-center px-0" : "justify-start px-2.5"
                    )}
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="ml-2 truncate font-medium">Sign Out</span>}
                  </Button>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right" className="bg-[#0b1120] border-slate-800 text-red-400 text-xs">
                    Logout ({user})
                  </TooltipContent>
                )}
              </Tooltip>
            </form>
          </div>
        </aside>

        {/* ─────────────────── MAIN CONTENT WRAPPER ─────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* ─────────────────── DEFEND iQ TOP BAR ─────────────────── */}
          <header className="h-14 border-b border-slate-800/80 bg-[#070c18]/80 backdrop-blur-xl px-6 flex items-center justify-between shrink-0 z-20">
            {/* Left: Minimal Clean Status */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
                <span className="font-medium text-[11px]">System Live & Protected</span>
              </div>
            </div>

            {/* Right: Quick Ingestion + Active Profile */}
            <div className="flex items-center gap-3">
              {/* Quick Ingest Button */}
              {role !== "analyst" && (
                <Button
                  size="sm"
                  onClick={() => setUploadOpen(true)}
                  className="hidden sm:flex h-8 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold gap-1.5 px-3 rounded-lg cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-blue-400" />
                  <span>Quick Ingest</span>
                </Button>
              )}

              {/* User Profile Chip */}
              <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm font-bold text-xs">
                  {user.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-200 truncate max-w-[120px]">
                    {user}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono uppercase font-medium">
                    {role}
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* Page Main Content Area */}
          <main className="flex-1 overflow-y-auto bg-[#050811] relative">
            {/* Subtle background ambient glow */}
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/5 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-purple-600/5 blur-[120px] pointer-events-none" />
            {children}
          </main>
        </div>

        {/* Global Attack Ingestion Dialog (Client and Admin only) */}
        {role !== "analyst" && (
          <LogUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
        )}
      </div>
    </TooltipProvider>
  )
}
