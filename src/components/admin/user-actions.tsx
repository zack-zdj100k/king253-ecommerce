"use client"

import * as React from "react"
import { Ban, Check, Eye, EyeOff, ShieldCheck, ShieldOff, UserPlus } from "lucide-react"

import { createAdminAction, deleteUserAction, setUserBlockedAction, setUserRoleAction } from "@/app/admin/actions/users"
import { DeleteButton } from "@/components/admin/delete-button"
import { Feedback, useAdminAction } from "@/components/admin/use-admin-action"
import { btnGhost, btnOutline, btnRed, inputClass, labelClass } from "@/components/admin/ui"
import { ConfirmButton } from "@/components/admin/confirm-button"

/** Make admin / customer, block / unblock, delete — for one account row. */
export function UserActions({ user, isMe }: { user: { id: string; name: string; role: "admin" | "customer"; blocked: boolean }; isMe: boolean }) {
  const { run, pending, feedback } = useAdminAction()
  if (isMe) return <span className="text-xs text-king-gray">You</span>
  const small = "h-8 px-3 text-xs"
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {user.role === "customer" ? (
        <ConfirmButton
          disabled={pending}
          confirm="Give full admin access?"
          confirmLabel="Yes, make admin"
          onConfirm={() => run(() => setUserRoleAction(user.id, "admin"))}
          className={`${btnOutline} ${small}`}
        >
          <ShieldCheck className="size-3.5" aria-hidden /> Make admin
        </ConfirmButton>
      ) : (
        <button type="button" disabled={pending} onClick={() => run(() => setUserRoleAction(user.id, "customer"))} className={`${btnOutline} ${small}`}>
          <ShieldOff className="size-3.5" aria-hidden /> Remove admin
        </button>
      )}
      <button type="button" disabled={pending} onClick={() => run(() => setUserBlockedAction(user.id, !user.blocked))} className={`${btnGhost} ${small}`}>
        {user.blocked ? <Check className="size-3.5" aria-hidden /> : <Ban className="size-3.5" aria-hidden />}
        {user.blocked ? "Unblock" : "Block"}
      </button>
      <DeleteButton compact label={`Delete ${user.name}`} confirm="Delete account?" action={deleteUserAction.bind(null, user.id)} />
      <div className="w-full text-right">
        <Feedback feedback={feedback} />
      </div>
    </div>
  )
}

/** Create a second admin (manager) with their own login. */
export function AddAdminForm() {
  const { run, pending, feedback } = useAdminAction()
  const [open, setOpen] = React.useState(false)
  const [show, setShow] = React.useState(false)
  const blank = { name: "", email: "", password: "" }
  const [v, setV] = React.useState(blank)

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnRed}>
        <UserPlus className="size-4" aria-hidden /> Add an admin
      </button>
    )
  }
  return (
    <form
      className="w-full space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => createAdminAction(v), () => {
          setV(blank)
          setOpen(false)
        })
      }}
    >
      <p className="text-sm font-semibold text-king-white">New admin (manager)</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="block">
          <span className={labelClass}>Name</span>
          <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoComplete="off" className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Email</span>
          <input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} autoComplete="off" className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Password (10+ characters, letters and a number)</span>
          <span className="relative block">
            <input
              type={show ? "text" : "password"}
              value={v.password}
              onChange={(e) => setV({ ...v, password: e.target.value })}
              autoComplete="new-password"
              className={`${inputClass} pr-10`}
            />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute top-1/2 right-3 -translate-y-1/2 text-king-gray hover:text-king-white">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
        </label>
      </div>
      <p className="text-xs text-king-gray">Give them their password in person. They sign in at /admin/login and have the same access as you.</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={btnRed}>
          Create admin
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
          Cancel
        </button>
        <Feedback feedback={feedback} />
      </div>
    </form>
  )
}
