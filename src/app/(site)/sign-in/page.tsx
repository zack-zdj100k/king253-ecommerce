import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getCurrentUser } from "@/server/auth/session"
import { AuthShell } from "@/components/auth/auth-shell"
import { AuthForm } from "@/components/auth/auth-form"

export const metadata: Metadata = { title: "Sign in", robots: { index: false } }

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next } = await searchParams
  const user = await getCurrentUser()
  const target = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : undefined
  if (user) redirect(target ?? (user.role === "admin" ? "/admin" : "/account"))
  return (
    <AuthShell>
      <AuthForm mode="sign-in" next={typeof next === "string" ? next : undefined} />
    </AuthShell>
  )
}
