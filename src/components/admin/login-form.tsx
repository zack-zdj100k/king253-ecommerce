"use client"

import * as React from "react"
import { Crown, Loader2 } from "lucide-react"

import { signInAction } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const field = "h-12 rounded-xl border-white/12 bg-black/40 px-4 text-base text-king-white focus-visible:border-king-bright-red focus-visible:ring-2 focus-visible:ring-king-bright-red/25 md:text-sm dark:bg-black/40"

export function AdminLoginForm({ signedInAsCustomer }: { signedInAsCustomer: boolean }) {
  const [error, setError] = React.useState<string | null>(signedInAsCustomer ? "This account does not have admin access." : null)
  const [pending, startTransition] = React.useTransition()
  return (
    <form
      className="w-full max-w-[24rem] space-y-5 rounded-3xl border border-white/10 bg-king-black/75 px-6 py-8 shadow-2xl shadow-black/50 backdrop-blur-xl sm:px-9"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
          const r = await signInAction({ email: String(fd.get("email")), password: String(fd.get("password")), next: "/admin" })
          if (r && !r.ok) setError(r.error)
        })
      }}
    >
      <div className="flex flex-col items-center gap-2">
        <Crown className="size-8 -rotate-6 text-king-bright-red" strokeWidth={1.6} aria-hidden />
        <h1 className="text-sm font-semibold text-king-white">KING 253 — Admin</h1>
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-email" className="text-sm text-king-white">Email</Label>
        <Input id="admin-email" name="email" type="email" autoComplete="username" required className={field} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-password" className="text-sm text-king-white">Password</Label>
        <Input id="admin-password" name="password" type="password" autoComplete="current-password" required className={field} />
      </div>
      {error && <p role="alert" className="text-sm text-king-bright-red">{error}</p>}
      <Button type="submit" variant="king" disabled={pending} className="h-12 w-full rounded-full text-base normal-case tracking-tight">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Sign in
      </Button>
    </form>
  )
}
