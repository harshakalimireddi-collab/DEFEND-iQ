"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { Activity } from "lucide-react"

interface AlertTimelineProps {
  data: Array<{ time: string; critical: number; high: number; medium: number; low: number }>
}

const COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
}

export function AlertTimeline({ data }: AlertTimelineProps) {
  return (
    <div className="rounded-xl bg-[#080d1a]/90 backdrop-blur-xl border border-slate-800/80 p-5 flex flex-col justify-between shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800/70">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Threat Velocity Timeline
            </h3>
            <p className="text-[11px] text-slate-400">24-hour incident volume by threat tier</p>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-[10px]">
          {[
            { label: "Critical", color: COLORS.critical },
            { label: "High", color: COLORS.high },
            { label: "Medium", color: COLORS.medium },
            { label: "Low", color: COLORS.low },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-slate-300">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="critGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.critical} stopOpacity={0.4} />
                <stop offset="95%" stopColor={COLORS.critical} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="highGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.high} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.high} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="medGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.medium} stopOpacity={0.2} />
                <stop offset="95%" stopColor={COLORS.medium} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="time"
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
              axisLine={{ stroke: "#1e293b" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#080d1a",
                border: "1px solid #334155",
                borderRadius: "8px",
                fontSize: "11px",
                color: "#f8fafc",
                boxShadow: "0 0 20px rgba(0,0,0,0.5)",
              }}
            />
            <Area type="monotone" dataKey="critical" stroke={COLORS.critical} fill="url(#critGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="high" stroke={COLORS.high} fill="url(#highGrad)" strokeWidth={1.5} />
            <Area type="monotone" dataKey="medium" stroke={COLORS.medium} fill="url(#medGrad)" strokeWidth={1.5} />
            <Area type="monotone" dataKey="low" stroke={COLORS.low} fill="transparent" strokeWidth={1} strokeDasharray="4 4" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
