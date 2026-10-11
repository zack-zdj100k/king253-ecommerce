import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getCurrentUser } from "@/server/auth/session"
import { AuthShell } from "@/components/auth/auth-shell"
import { AuthForm } from "@/components/auth/auth-form"

export const metadata: Metadata = { title: "Create account", robots: { index: false } }

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const { next } = await searchParams
  const target = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : undefined
  if (await getCurrentUser()) redirect(target ?? "/account")
  return (
    <AuthShell>
      <AuthForm mode="sign-up" next={target} />
    </AuthShell>
  )
}
