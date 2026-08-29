"use client"

import { Radio, Server } from "lucide-react"

interface SourceDistributionProps {
  data: Array<{ name: string; value: number }>
}

export function SourceDistribution({ data }: SourceDistributionProps) {
  const total = data.reduce((acc, s) => acc + s.value, 0)

  return (
    <div className="rounded-xl bg-[#080d1a]/90 backdrop-blur-xl border border-slate-800/80 p-5 flex flex-col justify-between shadow-lg">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/70">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-blue-400" />
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Defense Sensor Feeds
            </h3>
            <p className="text-[11px] text-slate-400">Distribution by telemetry origin</p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
          {data.length} Active Nodes
        </span>
      </div>

      <div className="flex flex-col gap-3.5">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-slate-500 text-xs">
            <Server className="w-6 h-6 mb-1 text-slate-600" />
            <span>No sensor telemetry recorded</span>
          </div>
        ) : (
          data.map((source, i) => {
            const pct = total > 0 ? Math.round((source.value / total) * 100) : 0
            return (
              <div key={source.name} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-semibold truncate max-w-[160px]">
                    {source.name}
                  </span>
                  <span className="text-blue-400 font-bold">{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
