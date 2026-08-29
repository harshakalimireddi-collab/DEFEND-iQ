import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { LoginForm } from "@/components/login-form"
import { Shield, Lock, ShieldCheck, Zap } from "lucide-react"

export default async function LoginPage() {
  const session = await getSession()
  if (session) {
    if (session.role === "client") {
      redirect("/dashboard/upload")
    } else if (session.role === "analyst") {
      redirect("/dashboard/alerts")
    } else {
      redirect("/dashboard")
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center bg-[#050811] relative overflow-hidden p-6 font-sans select-none">
      {/* ─────────────────── CYBER BACKGROUND GRID ─────────────────── */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#38bdf8 1px, transparent 1px), linear-gradient(90deg, #38bdf8 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Floating Starfield / Particle Matrix dots */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[18%] left-[12%] w-1.5 h-1.5 rounded-full bg-blue-400/50 shadow-[0_0_8px_#60a5fa] animate-pulse" />
        <div className="absolute top-[28%] right-[16%] w-1 h-1 rounded-full bg-purple-400/60 shadow-[0_0_6px_#c084fc] animate-ping" />
        <div className="absolute bottom-[24%] left-[22%] w-1 h-1 rounded-full bg-cyan-400/40 shadow-[0_0_6px_#22d3ee]" />
        <div className="absolute top-[65%] right-[25%] w-1.5 h-1.5 rounded-full bg-indigo-400/50 shadow-[0_0_8px_#818cf8]" />
      </div>

      {/* ─────────────────── DECORATIVE HEXAGONS (LEFT) ─────────────────── */}
      <div className="absolute left-[-20px] md:left-10 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 md:opacity-75">
        <svg width="220" height="400" viewBox="0 0 220 400" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Outer Large Hexagon */}
          <polygon
            points="60,20 180,20 220,100 180,180 60,180 20,100"
            stroke="url(#hexGrad1)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            fill="none"
          />
          {/* Inner Accent Hexagon */}
          <polygon
            points="70,40 150,40 180,95 150,150 70,150 40,95"
            stroke="#38bdf8"
            strokeWidth="1"
            strokeOpacity="0.25"
            fill="#0b1329"
            fillOpacity="0.4"
          />
          {/* Small Floating Hexagon */}
          <polygon
            points="35,260 85,260 105,300 85,340 35,340 15,300"
            stroke="url(#hexGrad2)"
            strokeWidth="1.5"
            fill="#0f172a"
            fillOpacity="0.3"
          />

          <defs>
            <linearGradient id="hexGrad1" x1="20" y1="20" x2="220" y2="180" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38bdf8" stopOpacity="0.6" />
              <stop offset="1" stopColor="#818cf8" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="hexGrad2" x1="15" y1="260" x2="105" y2="340" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6366f1" stopOpacity="0.5" />
              <stop offset="1" stopColor="#a855f7" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* ─────────────────── DECORATIVE HEXAGONS (RIGHT) ─────────────────── */}
      <div className="absolute right-[-20px] md:right-10 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 md:opacity-75">
        <svg width="220" height="400" viewBox="0 0 220 400" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Outer Large Hexagon */}
          <polygon
            points="60,220 180,220 220,300 180,380 60,380 20,300"
            stroke="url(#hexGrad3)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            fill="none"
          />
          {/* Inner Accent Hexagon */}
          <polygon
            points="70,240 150,240 180,295 150,350 70,350 40,295"
            stroke="#a855f7"
            strokeWidth="1"
            strokeOpacity="0.3"
            fill="#120e2a"
            fillOpacity="0.4"
          />
          {/* Small Top Floating Hexagon */}
          <polygon
            points="120,40 170,40 190,80 170,120 120,120 100,80"
            stroke="url(#hexGrad4)"
            strokeWidth="1.5"
            fill="#0f172a"
            fillOpacity="0.3"
          />

          <defs>
            <linearGradient id="hexGrad3" x1="20" y1="220" x2="220" y2="380" gradientUnits="userSpaceOnUse">
              <stop stopColor="#a855f7" stopOpacity="0.6" />
              <stop offset="1" stopColor="#38bdf8" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="hexGrad4" x1="100" y1="40" x2="190" y2="120" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38bdf8" stopOpacity="0.5" />
              <stop offset="1" stopColor="#6366f1" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* ─────────────────── CENTRAL AMBIENT RADIAL GLOW ─────────────────── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-gradient-to-tr from-blue-600/15 via-indigo-600/15 to-purple-600/15 blur-[120px] pointer-events-none" />

      {/* Top Spacer for perfect centering */}
      <div className="w-full h-2" />

      {/* ─────────────────── MAIN AUTHENTICATION CARD ─────────────────── */}
      <div className="relative z-10 w-full max-w-[440px] my-auto">
        <div className="rounded-2xl p-8 bg-[#080d1a]/85 border border-slate-800/80 shadow-[0_0_50px_rgba(30,58,138,0.25)] backdrop-blur-2xl transition-all duration-300 hover:border-slate-700/90">
          <LoginForm />
        </div>
      </div>

      {/* ─────────────────── FOOTER & TRUST BADGES ─────────────────── */}
      <div className="relative z-10 w-full max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4 pt-6 mt-4 border-t border-slate-900/80 text-xs text-slate-400">
        {/* Bottom Left: Powered by Defend iQ */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm">
            <Shield className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">Powered by</span>
            <span className="text-xs font-bold text-slate-200 tracking-tight">Defend iQ</span>
          </div>
        </div>

        {/* Bottom Center: Trust Indicators & Copyright */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-3.5 text-xs text-slate-300 font-medium">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Lock className="w-3.5 h-3.5 text-blue-400" />
              Secure.
            </span>
            <span className="text-slate-600 font-bold">•</span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              Trusted.
            </span>
            <span className="text-slate-600 font-bold">•</span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              Always Ahead.
            </span>
          </div>
          <p className="text-[11px] text-slate-500 tracking-wide">
            © 2026 Defend iQ. All rights reserved.
          </p>
        </div>

        {/* Bottom Right Spacer for symmetry */}
        <div className="hidden md:block w-28 text-right text-[11px] text-slate-600 font-mono">
          v2.4.0-SEC
        </div>
      </div>
    </div>
  )
}
