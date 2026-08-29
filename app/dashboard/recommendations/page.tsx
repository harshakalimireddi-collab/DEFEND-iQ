import { generateSiemRecommendations } from "@/lib/recommendations/siem-recommendations"
import { Lightbulb, Sparkles, ShieldCheck, CheckCircle2, Sliders } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function RecommendationsPage() {
  const recs = await generateSiemRecommendations()

  return (
    <div className="p-6 md:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
              DEFENSE INTELLIGENCE
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight font-sans">
              AI Security Playbooks & Tuning Recommendations
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated recommendations to minimize alert fatigue, suppress false positives, and harden network defense
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="px-2.5 py-1 rounded-lg bg-[#080d1a] border border-slate-800">
            Engine: {recs.mode === "ai" ? "Multi-Agent AI" : "Heuristic"}
          </span>
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-xl bg-[#080d1a]/90 backdrop-blur-xl border border-slate-800/80 p-6 flex flex-col gap-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                SIEM Rule Optimization Plan
              </h2>
              <p className="text-[11px] text-slate-400">
                Generated {new Date(recs.generatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Metric Overview Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#0a1020] rounded-xl border border-slate-800/80 p-4">
            <p className="text-[10px] text-slate-400 uppercase font-mono font-semibold">Evaluated Incidents</p>
            <p className="text-2xl text-white font-extrabold font-mono mt-1">{recs.context.labeledAlerts}</p>
          </div>
          <div className="bg-[#0a1020] rounded-xl border border-slate-800/80 p-4">
            <p className="text-[10px] text-red-400 uppercase font-mono font-semibold">Malicious Confirmed</p>
            <p className="text-2xl text-red-400 font-extrabold font-mono mt-1">{recs.context.malicious}</p>
          </div>
          <div className="bg-[#0a1020] rounded-xl border border-slate-800/80 p-4">
            <p className="text-[10px] text-emerald-400 uppercase font-mono font-semibold">False Positives Caught</p>
            <p className="text-2xl text-emerald-400 font-extrabold font-mono mt-1">{recs.context.falsePositive}</p>
          </div>
          <div className="bg-[#0a1020] rounded-xl border border-slate-800/80 p-4">
            <p className="text-[10px] text-amber-400 uppercase font-mono font-semibold">Open Criticals</p>
            <p className="text-2xl text-amber-400 font-extrabold font-mono mt-1">{recs.context.criticalOpen}</p>
          </div>
        </div>

        {/* Actionable Playbook Steps */}
        <div className="bg-[#0a1020] rounded-xl border border-slate-800/80 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase font-mono tracking-wider">
              Recommended Action Items
            </h3>
          </div>
          <div className="space-y-3">
            {recs.bullets.map((bullet, index) => (
              <div
                key={`${index}-${bullet.slice(0, 16)}`}
                className="p-3 rounded-lg bg-[#080d1a] border border-slate-800/70 text-xs text-slate-300 leading-relaxed flex items-start gap-3 hover:border-slate-700 transition-colors"
              >
                <span className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  {index + 1}
                </span>
                <span className="flex-1">{bullet}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
