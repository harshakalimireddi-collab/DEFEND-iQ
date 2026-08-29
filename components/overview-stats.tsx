import { ShieldAlert, ShieldCheck, Search, AlertTriangle, ArrowUpRight, TrendingUp } from "lucide-react"

interface OverviewStatsProps {
  counts: {
    severity: Record<string, number>
    status: Record<string, number>
    total: number
  }
}

export function OverviewStats({ counts }: OverviewStatsProps) {
  const critCount = counts.severity.critical || 0
  const highCount = counts.severity.high || 0
  const critHigh = critCount + highCount
  const inProgress = counts.status.in_progress || 0
  const unassigned = counts.status.unassigned || 0
  const resolved = counts.status.resolved || 0

  const stats = [
    {
      label: "TOTAL INCIDENTS",
      value: counts.total,
      sub: "Telemetry Ingested (24h)",
      icon: ShieldAlert,
      badge: "Real-Time",
      glowColor: "border-blue-500/30 hover:border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.1)]",
      iconBg: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
      accentBar: "bg-blue-500",
    },
    {
      label: "CRITICAL / HIGH THREATS",
      value: critHigh,
      sub: `${critCount} Critical · ${highCount} High`,
      icon: AlertTriangle,
      badge: critHigh > 0 ? "Action Required" : "Nominal",
      glowColor: critHigh > 0
        ? "border-red-500/40 hover:border-red-500/70 shadow-[0_0_25px_rgba(239,68,68,0.18)]"
        : "border-slate-800/80 hover:border-slate-700/80",
      iconBg: critHigh > 0
        ? "bg-red-500/10 text-red-400 border border-red-500/30 animate-pulse"
        : "bg-slate-800/40 text-slate-400",
      accentBar: critHigh > 0 ? "bg-red-500" : "bg-slate-600",
    },
    {
      label: "ACTIVE INVESTIGATIONS",
      value: inProgress,
      sub: `${unassigned} Unassigned in Queue`,
      icon: Search,
      badge: inProgress > 0 ? "In Triage" : "Clear",
      glowColor: inProgress > 0
        ? "border-amber-500/40 hover:border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
        : "border-slate-800/80 hover:border-slate-700/80",
      iconBg: inProgress > 0
        ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
        : "bg-slate-800/40 text-slate-400",
      accentBar: inProgress > 0 ? "bg-amber-500" : "bg-slate-600",
    },
    {
      label: "CONTAINED & RESOLVED",
      value: resolved,
      sub: `${((resolved / (counts.total || 1)) * 100).toFixed(0)}% Mitigation Rate`,
      icon: ShieldCheck,
      badge: "Protected",
      glowColor: "border-emerald-500/30 hover:border-emerald-500/60 shadow-[0_0_20px_rgba(34,197,94,0.12)]",
      iconBg: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
      accentBar: "bg-emerald-500",
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`relative overflow-hidden rounded-xl bg-[#080d1a]/90 backdrop-blur-xl border p-5 flex flex-col justify-between gap-4 transition-all duration-300 ${stat.glowColor}`}
        >
          {/* Top subtle accent line */}
          <div className={`absolute top-0 left-0 right-0 h-0.5 ${stat.accentBar}`} />

          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono">
              {stat.label}
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.iconBg}`}>
              <stat.icon className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight tabular-nums font-mono">
                {stat.value}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/60 font-mono">
                {stat.badge}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
              <span>{stat.sub}</span>
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
