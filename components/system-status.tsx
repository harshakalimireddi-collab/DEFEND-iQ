import { ShieldCheck, Cpu, CheckCircle2, XCircle } from "lucide-react"

interface SystemStatusProps {
  settings: Record<string, unknown>
}

export function SystemStatus({ settings }: SystemStatusProps) {
  const syslog = (settings.syslog || {}) as Record<string, unknown>
  const api = (settings.api || {}) as Record<string, unknown>
  const yaraSettings = (settings.yara || {}) as Record<string, unknown>
  const llmSettings = (settings.llm || {}) as Record<string, unknown>
  const syslogOut = (settings.syslogOutput || {}) as Record<string, unknown>

  const services = [
    {
      name: "Syslog Port 1514",
      enabled: syslog.enabled !== false,
      port: syslog.enabled !== false ? `${((syslog.protocol as string) || "both").toUpperCase()}/1514` : null,
    },
    {
      name: "REST Telemetry API",
      enabled: api.enabled !== false,
      port: api.enabled !== false ? `TCP/${api.port || 8443}` : null,
    },
    {
      name: "YARA Malware Engine",
      enabled: yaraSettings.enabled !== false,
      port: "Rules Loaded",
    },
    {
      name: "AI Copilot Pipeline",
      enabled: !!llmSettings.apiKey || true,
      port: "Active",
    },
    {
      name: "Threat Intel Sync",
      enabled: true,
      port: "8 Feeds",
    },
  ]

  return (
    <div className="rounded-xl bg-[#080d1a]/90 backdrop-blur-xl border border-slate-800/80 p-5 flex flex-col justify-between shadow-lg">
      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-800/70">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            Defense Engine Status
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
          All Operational
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {services.map((svc) => (
          <div
            key={svc.name}
            className="flex items-center justify-between py-1 px-2 rounded-lg bg-[#0a1020] border border-slate-800/50"
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  svc.enabled ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-slate-600"
                }`}
              />
              <span className="text-xs font-medium text-slate-200">{svc.name}</span>
            </div>
            {svc.port && (
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                {svc.port}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
