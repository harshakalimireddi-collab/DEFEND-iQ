"use client"

import { useState, useActionState } from "react"
import { loginAction, registerClientAction } from "@/app/actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react"

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  const [loginState, loginFormAction, isLoginPending] = useActionState(loginAction, null)
  const [signupState, signupFormAction, isSignupPending] = useActionState(registerClientAction, null)

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center gap-2">
        {/* Glowing Shield Logo with Digital Pixel Accents */}
        <div className="relative flex items-center justify-center w-16 h-16 mb-1">
          {/* Ambient Glow */}
          <div className="absolute inset-0 rounded-2xl bg-blue-500/20 blur-xl animate-pulse" />
          
          <svg className="w-14 h-14 relative z-10 drop-shadow-[0_0_12px_rgba(59,130,246,0.5)]" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Outer Shield */}
            <path
              d="M24 4L8 10V22C8 32.5 14.8 42.2 24 45C33.2 42.2 40 32.5 40 22V10L24 4Z"
              stroke="url(#shieldGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="#080e1e"
            />
            {/* Inner Cyber Chevron / D */}
            <path
              d="M20 16L28 24L20 32"
              stroke="url(#innerGrad)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Digital Pixel Accents */}
            <rect x="34" y="6" width="3.5" height="3.5" rx="1" fill="#38bdf8" />
            <rect x="39" y="10" width="3" height="3" rx="1" fill="#818cf8" />
            <rect x="34" y="14" width="2.5" height="2.5" rx="0.5" fill="#a855f7" />

            <defs>
              <linearGradient id="shieldGrad" x1="8" y1="4" x2="40" y2="45" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38bdf8" />
                <stop offset="0.5" stopColor="#6366f1" />
                <stop offset="1" stopColor="#a855f7" />
              </linearGradient>
              <linearGradient id="innerGrad" x1="20" y1="16" x2="28" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38bdf8" />
                <stop offset="1" stopColor="#818cf8" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* DEFEND iQ Title */}
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-extrabold tracking-tight text-white font-sans">
            DEFEND
          </h1>
          <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            iQ
          </span>
        </div>

        {/* Tagline */}
        <p className="text-[10px] font-bold tracking-[0.25em] text-slate-400 uppercase">
          SMARTER DEFENSE. STRONGER FUTURE.
        </p>
      </div>

      {/* Tab Switcher: Sign In | Create Account */}
      <div className="grid grid-cols-2 p-1 bg-[#090e1a]/90 rounded-xl border border-slate-800/80 shadow-inner">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
            mode === "signin"
              ? "bg-slate-800/90 text-white shadow-md border-b-2 border-blue-500"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
            mode === "signup"
              ? "bg-slate-800/90 text-white shadow-md border-b-2 border-indigo-500"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Create Account
        </button>
      </div>

      {mode === "signin" ? (
        /* ───────────────── SIGN IN FORM ───────────────── */
        <form action={loginFormAction} className="flex flex-col gap-4">
          {/* Username / Email Field */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username" className="text-xs font-medium text-slate-300">
              Email / Username
            </Label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                placeholder="Enter your email or username"
                className="bg-[#0a0f1d]/80 border border-slate-800/90 rounded-xl pl-10 pr-4 h-11 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="text-xs font-medium text-slate-300">
              Password
            </Label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="Enter your password"
                className="bg-[#0a0f1d]/80 border border-slate-800/90 rounded-xl pl-10 pr-11 h-11 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-200 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password Row */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center gap-2 text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500/30 cursor-pointer"
              />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              onClick={() => alert("Contact system administrator or use interactive CLI (node manage-users.js) to reset passwords.")}
              className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              Forgot password?
            </button>
          </div>

          {/* Error Banner */}
          {loginState?.error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>{loginState.error}</span>
            </div>
          )}

          {/* Gradient Action Button */}
          <Button
            type="submit"
            disabled={isLoginPending}
            className="w-full h-11 mt-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-semibold text-sm rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.35)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] transition-all duration-200 flex items-center justify-center gap-2"
          >
            {isLoginPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                <span>Login</span>
              </>
            )}
          </Button>

          {/* Bottom Switcher */}
          <p className="text-xs text-slate-400 text-center mt-2">
            New to Defend iQ?{" "}
            <button
              type="button"
              onClick={() => setMode("signup")}
              className="text-indigo-400 hover:text-indigo-300 font-semibold underline-offset-4 hover:underline transition-colors"
            >
              Create an account
            </button>
          </p>
        </form>
      ) : (
        /* ───────────────── CREATE ACCOUNT FORM ───────────────── */
        <form action={signupFormAction} className="flex flex-col gap-3.5">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center gap-2.5 text-[11px] text-blue-300">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Create a defense client account to ingest logs and run AI threat triage.</span>
          </div>

          {/* Client Username */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="signup-username" className="text-xs font-medium text-slate-300">
              Username
            </Label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <Input
                id="signup-username"
                name="username"
                type="text"
                autoComplete="username"
                required
                placeholder="e.g. defense_lead or radar_unit_01"
                className="bg-[#0a0f1d]/80 border border-slate-800/90 rounded-xl pl-10 pr-4 h-10 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="signup-password" className="text-xs font-medium text-slate-300">
              Create Password
            </Label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <Input
                id="signup-password"
                name="password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                placeholder="At least 6 characters"
                className="bg-[#0a0f1d]/80 border border-slate-800/90 rounded-xl pl-10 pr-10 h-10 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="signup-confirm" className="text-xs font-medium text-slate-300">
              Confirm Password
            </Label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <Input
                id="signup-confirm"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                placeholder="Re-enter password"
                className="bg-[#0a0f1d]/80 border border-slate-800/90 rounded-xl pl-10 pr-4 h-10 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
              />
            </div>
          </div>

          {/* Error Banner */}
          {signupState?.error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5">
              {signupState.error}
            </div>
          )}

          {/* Create Button */}
          <Button
            type="submit"
            disabled={isSignupPending}
            className="w-full h-10 mt-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-semibold text-xs rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.35)] transition-all flex items-center justify-center gap-2"
          >
            {isSignupPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create Defend iQ Account</span>
              </>
            )}
          </Button>

          {/* Switcher */}
          <p className="text-xs text-slate-400 text-center">
            Already registered?{" "}
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="text-indigo-400 hover:text-indigo-300 font-semibold underline-offset-4 hover:underline transition-colors"
            >
              Login
            </button>
          </p>
        </form>
      )}
    </div>
  )
}
