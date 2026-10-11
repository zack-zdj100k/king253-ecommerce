import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getCurrentUser } from "@/server/auth/session"
import { AuthShell } from "@/components/auth/auth-shell"
import { AdminLoginForm } from "@/components/admin/login-form"

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } }

export default async function AdminLoginPage() {
  const user = await getCurrentUser()
  if (user?.role === "admin") redirect("/admin")
  return (
    <AuthShell>
      <AdminLoginForm signedInAsCustomer={!!user} />
    </AuthShell>
  )
}
