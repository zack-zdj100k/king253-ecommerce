"use server"

import { z } from "zod"

import { db } from "@/server/db"
import { createAdminUser, deleteUser, setUserBlocked, setUserRole } from "@/server/admin/users"
import { adminAction } from "./_shared"

const id = z.uuid()
const paths = ["/admin/users"]

export async function setUserRoleAction(userId: string, role: "admin" | "customer") {
  return adminAction(
    async ({ actor }) => {
      await setUserRole(db, id.parse(userId), z.enum(["admin", "customer"]).parse(role), actor)
    },
    { revalidate: paths, message: role === "admin" ? "Now an admin." : "Now a customer account." }
  )
}

export async function setUserBlockedAction(userId: string, blocked: boolean) {
  return adminAction(
    async ({ actor }) => {
      await setUserBlocked(db, id.parse(userId), z.boolean().parse(blocked), actor)
    },
    { revalidate: paths, message: blocked ? "Account blocked and signed out." : "Account unblocked." }
  )
}

export async function deleteUserAction(userId: string) {
  return adminAction(
    async ({ actor }) => {
      await deleteUser(db, id.parse(userId), actor)
    },
    { revalidate: paths, message: "Account deleted." }
  )
}

export async function createAdminAction(input: { email: string; name: string; password: string }) {
  return adminAction(
    async ({ actor }) => {
      const data = z.object({ email: z.string().max(200), name: z.string().max(120), password: z.string().max(200) }).parse(input)
      await createAdminUser(db, data, actor)
    },
    { revalidate: paths, message: "Admin account created. They can sign in at /admin/login." }
  )
}
