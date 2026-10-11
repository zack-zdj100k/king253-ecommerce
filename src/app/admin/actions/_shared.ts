import "server-only"

import { revalidatePath } from "next/cache"

import { actorOf, requireAdmin, type CurrentUser } from "@/server/auth/session"
import { AppError, toUserMessage } from "@/server/errors"

export type AdminResult<T = undefined> = ({ ok: true; message?: string } & (T extends undefined ? object : { data: T })) | { ok: false; error: string }

/**
 * Every admin mutation goes through here: the session is re-checked on the
 * server (never trusting the UI), errors become safe messages, and the given
 * paths are revalidated.
 */
export async function adminAction<T>(
  run: (ctx: { user: CurrentUser; actor: ReturnType<typeof actorOf> }) => Promise<T>,
  opts: { revalidate?: string[]; message?: string } = {}
): Promise<AdminResult<T extends void ? undefined : T>> {
  try {
    const user = await requireAdmin()
    const data = await run({ user, actor: actorOf(user) })
    for (const path of opts.revalidate ?? []) revalidatePath(path)
    return { ok: true, message: opts.message, ...(data === undefined ? {} : { data }) } as never
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.userMessage }
    return { ok: false, error: toUserMessage(error) }
  }
}
