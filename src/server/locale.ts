import "server-only"

/** The visitor's language during a request; Arabic/French/English, French when called outside one (scripts, tests). */
export async function requestLocale(): Promise<"ar" | "fr" | "en"> {
  try {
    const { currentLocale } = await import("@/i18n/request")
    return await currentLocale()
  } catch {
    return "fr"
  }
}
