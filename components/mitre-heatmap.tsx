import { Crosshair, ShieldAlert } from "lucide-react"

interface MitreHeatmapProps {
  data: Array<{ technique: string; count: number }>
}

export function MitreHeatmap({ data }: MitreHeatmapProps) {
  const max = data.length > 0 ? Math.max(...data.map((t) => t.count)) : 1

  return (
    <div className="rounded-xl bg-[#080d1a]/90 backdrop-blur-xl border border-slate-800/80 p-5 flex flex-col justify-between shadow-lg">
      <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-slate-800/70">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            MITRE ATT&CK Matrix
          </h3>
        </div>
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
          Kill-Chain Telemetry
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-slate-500 text-xs">
            <ShieldAlert className="w-6 h-6 mb-1 text-slate-600" />
            <span>No MITRE technique mapped yet</span>
          </div>
        ) : (
          data.slice(0, 6).map((item) => {
            const percentage = Math.round((item.count / max) * 100)
            return (
              <div
                key={item.technique}
                className="group p-2 rounded-lg bg-[#0a1020] border border-slate-800/70 hover:border-purple-500/40 transition-all flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200 truncate group-hover:text-purple-300 transition-colors">
                    {item.technique}
                  </span>
                  <span className="font-mono text-purple-400 font-bold ml-2 shrink-0">
                    {item.count} hits
                  </span>
                </div>
                {/* Visual Intensity Bar */}
                <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
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
