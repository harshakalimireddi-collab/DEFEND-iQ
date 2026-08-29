import { Activity, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react"

interface DetectionQualityProps {
  report: {
    labeledCount: number
    truePositiveCount: number
    falsePositiveCount: number
    detectors: Array<{ detector: string; tp: number; fp: number; precision: number; recall: number }>
    bySource: Array<{ source: string; tp: number; fp: number; precision: number; recall: number }>
  }
}

export function DetectionQuality({ report }: DetectionQualityProps) {
  const accuracy =
    report.labeledCount > 0
      ? Math.round((report.truePositiveCount / report.labeledCount) * 100)
      : 100

  return (
    <div className="rounded-xl bg-[#080d1a]/90 backdrop-blur-xl border border-slate-800/80 p-5 flex flex-col gap-4 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/70">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              AI Detection Quality & Tuning Index
            </h3>
            <p className="text-[11px] text-slate-400">
              Evaluated against {report.labeledCount} ground-truth incidents ({report.truePositiveCount} True Positives / {report.falsePositiveCount} Suppressed FP)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3" />
            {accuracy}% AI Accuracy
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Detectors Precision */}
        <div className="bg-[#0a1020] rounded-lg border border-slate-800/70 p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase font-mono text-slate-300">
              Detector Engine Performance
            </span>
            <span className="text-[10px] font-mono text-slate-500">P = Precision · R = Recall</span>
          </div>
          <div className="space-y-2">
            {report.detectors.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">No detector metrics recorded</p>
            ) : (
              report.detectors.map((d) => (
                <div key={d.detector} className="text-xs flex items-center justify-between py-1 border-b border-slate-800/40 last:border-0">
                  <span className="font-mono text-slate-300 font-medium">{d.detector}</span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-blue-400 font-semibold">P: {d.precision}%</span>
                    <span className="text-purple-400 font-semibold">R: {d.recall}%</span>
                    <span className="text-slate-500">({d.tp}TP/{d.fp}FP)</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Source Telemetry Performance */}
        <div className="bg-[#0a1020] rounded-lg border border-slate-800/70 p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase font-mono text-slate-300">
              Telemetry Source Accuracy
            </span>
            <span className="text-[10px] font-mono text-slate-500">Sensor Confidence</span>
          </div>
          <div className="space-y-2">
            {report.bySource.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">No sensor sources logged</p>
            ) : (
              report.bySource.map((s) => (
                <div key={s.source} className="text-xs flex items-center justify-between py-1 border-b border-slate-800/40 last:border-0">
                  <span className="font-mono text-slate-300 truncate max-w-[180px]" title={s.source}>
                    {s.source}
                  </span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-emerald-400 font-semibold">P: {s.precision}%</span>
                    <span className="text-slate-500">({s.tp} TP)</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
