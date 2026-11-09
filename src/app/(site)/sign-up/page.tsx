import { getTranslations } from "next-intl/server"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getCurrentUser } from "@/server/auth/session"
import { AuthShell } from "@/components/auth/auth-shell"
import { AuthForm } from "@/components/auth/auth-form"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("pages"))("signUp"), robots: { index: false } }
}

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
