"use client"

import * as React from "react"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { Crown, Eye, EyeOff, Lock, Mail, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { signInAction, signUpAction } from "@/app/actions/auth"
import { REFERRAL_SOURCES, type ReferralSource } from "@/lib/referral"
import { clearAuthReturn, markAuthReturn } from "@/components/ui/back-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Mode = "sign-in" | "sign-up"

const TABS: { mode: Mode; label: string }[] = [
  { mode: "sign-in", label: "Sign In" },
  { mode: "sign-up", label: "Sign Up" },
]

const SOCIAL_SOON = "Google and Apple sign-in are not available yet — use your email for now."

const fieldClass =
  "h-12 rounded-[6px] border-white/12 bg-black/40 pr-4 pl-11 text-base text-king-white placeholder:text-king-gray/80 focus-visible:border-king-bright-red focus-visible:ring-2 focus-visible:ring-king-bright-red/25 md:text-sm dark:bg-black/40"

const iconClass = "pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-king-gray"

export function AuthForm({ mode: initialMode, next }: { mode: Mode; next?: string }) {
  const [pending, startTransition] = React.useTransition()
  const [mode, setMode] = React.useState<Mode>(initialMode)
  const [showPassword, setShowPassword] = React.useState(false)
  const [referral, setReferral] = React.useState<ReferralSource | null>(null)
  const [status, setStatus] = React.useState<string | null>(null)
  const id = React.useId()
  const signIn = mode === "sign-in"

  // Switch tabs in place; keep the URL shareable without reloading the page.
  const switchTo = (next: Mode) => {
    if (next === mode) return
    setMode(next)
    setStatus(null)
    window.history.replaceState(null, "", `/${next}${window.location.search}`)
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative w-full max-w-[26rem] animate-in duration-700 fade-in-0 slide-in-from-bottom-4 motion-reduce:animate-none">
        {/* Red light catching the top edge of the card */}
        <div aria-hidden className="absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-king-bright-red to-transparent" />

        <div className="rounded-[14px] border border-white/10 bg-king-black/60 px-6 py-8 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:px-9 sm:py-10">
          {/* Mark */}
          <div className="flex flex-col items-center gap-2">
            <Crown className="size-9 -rotate-6 text-king-bright-red drop-shadow-[0_0_14px_rgba(255,26,26,0.55)]" strokeWidth={1.6} aria-hidden />
            <p className="text-sm font-black tracking-[-0.03em] text-king-white uppercase">
              King <span className="text-king-bright-red">253</span>
            </p>
          </div>
          <h1 className="sr-only">{signIn ? "Sign in to KING 253" : "Create a KING 253 account"}</h1>

          {/* Tabs */}
          <div role="tablist" aria-label="Account" className="mt-7 grid grid-cols-2 border-b border-white/10">
            {TABS.map((t) => {
              const active = t.mode === mode
              return (
                <button
                  key={t.mode}
                  type="button"
                  role="tab"
                  id={`${id}-tab-${t.mode}`}
                  aria-selected={active}
                  aria-controls={`${id}-panel`}
                  onClick={() => switchTo(t.mode)}
                  className={cn(
                    "relative pb-3.5 text-base font-medium transition-colors duration-300",
                    active ? "text-king-white" : "text-king-gray hover:text-king-muted"
                  )}
                >
                  {t.label}
                  {active && (
                    <motion.span
                      layoutId={`${id}-underline`}
                      className="absolute inset-x-0 -bottom-px h-[2px] bg-king-bright-red shadow-[0_0_12px_rgba(255,26,26,0.7)]"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                </button>
              )
            })}
          </div>

          {next?.startsWith("/checkout") && (
            <p className="mt-6 border border-king-red-line bg-king-red/10 p-3 text-sm text-king-white" role="status">
              Create an account (or sign in) to place your order — your bag is saved.
            </p>
          )}

          <form
            id={`${id}-panel`}
            role="tabpanel"
            aria-labelledby={`${id}-tab-${mode}`}
            className="mt-7 space-y-5"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const email = String(fd.get("email") ?? "")
              const password = String(fd.get("password") ?? "")
              setStatus(null)
              if (!signIn && !referral) return setStatus("Tell us how you found KING 253.")
              markAuthReturn(next)
              startTransition(async () => {
                const result = signIn
                  ? await signInAction({ email, password, next })
                  : await signUpAction({ name: String(fd.get("name") ?? ""), email, password, referralSource: referral ?? "", next })
                // On success the action redirects; anything returned is an error.
                if (result && !result.ok) {
                  clearAuthReturn()
                  setStatus(result.error)
                }
              })
            }}
          >
            <AnimatePresence initial={false}>
              {!signIn && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 pb-0.5">
                    <Label htmlFor={`${id}-name`} className="text-sm font-medium text-king-white">
                      Full name
                    </Label>
                    <div className="relative">
                      <User className={iconClass} aria-hidden />
                      <Input id={`${id}-name`} name="name" autoComplete="name" required placeholder="Your name" className={fieldClass} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <Label htmlFor={`${id}-email`} className="text-sm font-medium text-king-white">
                Email
              </Label>
              <div className="relative">
                <Mail className={iconClass} aria-hidden />
                <Input
                  id={`${id}-email`}
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${id}-password`} className="text-sm font-medium text-king-white">
                Password
              </Label>
              <div className="relative">
                <Lock className={iconClass} aria-hidden />
                <Input
                  id={`${id}-password`}
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={signIn ? "current-password" : "new-password"}
                  minLength={signIn ? 1 : 10}
                  required
                  placeholder="••••••••"
                  className={cn(fieldClass, "pr-12")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center text-king-gray transition-colors hover:text-king-white"
                >
                  {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
              </div>
              {signIn && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStatus("Password reset by email is not set up yet. Contact the store and we will reset it for you.")}
                    className="text-xs text-king-muted underline decoration-white/30 underline-offset-4 transition-colors hover:text-king-white hover:decoration-king-bright-red"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            {!signIn && (
              <fieldset className="space-y-2.5">
                <legend className="text-sm font-medium text-king-white">How did you find KING 253?</legend>
                <div className="flex flex-wrap gap-2">
                  {REFERRAL_SOURCES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setReferral(s.key)}
                      aria-pressed={referral === s.key}
                      className={cn(
                        "h-10 rounded-full border px-4 text-sm transition-colors",
                        referral === s.key ? "border-king-bright-red bg-king-red/20 text-king-white" : "border-white/15 text-king-muted hover:border-white/35 hover:text-king-white"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <Button type="submit" disabled={pending} variant="king" className="h-12 w-full rounded-[6px] text-base font-semibold tracking-tight normal-case">
              {signIn ? "Sign In" : "Create account"}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-king-gray">or continue with</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <div className="space-y-3">
            <SocialButton label="Continue with Google" onClick={() => setStatus(SOCIAL_SOON)}>
              <GoogleMark className="size-4" />
            </SocialButton>
            <SocialButton label="Continue with Apple" onClick={() => setStatus(SOCIAL_SOON)}>
              <AppleMark className="size-4" />
            </SocialButton>
          </div>

          <p role="status" aria-live="polite" className={cn("text-center text-xs text-king-muted", status ? "mt-5" : "sr-only")}>
            {status}
          </p>

          <p className="mt-7 text-center text-sm text-king-gray">
            {signIn ? "Don’t have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => switchTo(signIn ? "sign-up" : "sign-in")}
              className="font-semibold text-king-white transition-colors hover:text-king-bright-red"
            >
              {signIn ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </MotionConfig>
  )
}

function SocialButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-[6px] border border-white/12 bg-black/30 text-sm font-medium text-king-white transition-colors duration-300 hover:border-king-red-line hover:bg-black/50"
    >
      {children}
      {label}
    </button>
  )
}

/* Monochrome brand marks so they sit inside the black/red palette. */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
      />
    </svg>
  )
}

function AppleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      />
    </svg>
  )
}
