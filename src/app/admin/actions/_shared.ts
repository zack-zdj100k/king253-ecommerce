import "server-only"

import { revalidatePath, revalidateTag } from "next/cache"

import { actorOf, requireAdmin, type CurrentUser } from "@/server/auth/session"
import { AppError, toUserMessage } from "@/server/errors"

export type AdminResult<T = undefined> = ({ ok: true; message?: string } & (T extends undefined ? object : { data: T })) | { ok: false; error: string }

/**
 * Every admin mutation goes through here: the session is re-checked on the
 * server (never trusting the UI), errors become safe messages, and the given
 * paths are revalidated.
 */
export async function adminAction<T>(
  run: (ctx: { user: CurrentUser; actor: ReturnType<typeof actorOf>; warn: (text: string) => void }) => Promise<T>,
  opts: { revalidate?: string[]; message?: string } = {}
): Promise<AdminResult<T extends void ? undefined : T>> {
  try {
    const user = await requireAdmin()
    // Things that did not stop the save but the admin should know (e.g. automatic translation failed).
    const warnings: string[] = []
    const data = await run({ user, actor: actorOf(user), warn: (text) => warnings.push(text) })
    for (const path of opts.revalidate ?? []) revalidatePath(path)
    // Any admin change can move the Overview numbers.
    revalidateTag("overview", "max")
    const message = warnings.length ? [opts.message, ...warnings].filter(Boolean).join(" ") : opts.message
    return { ok: true, message, ...(data === undefined ? {} : { data }) } as never
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.userMessage }
    return { ok: false, error: toUserMessage(error) }
  }
}
