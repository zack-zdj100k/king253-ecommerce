/** The admin's own language (separate from the storefront language the visitor picks). */
export const ADMIN_LANG_COOKIE = "k253_admin_lang"
export const ADMIN_LANGS = ["en", "fr", "ar"] as const
export type AdminLang = (typeof ADMIN_LANGS)[number]
export const isAdminLang = (v: unknown): v is AdminLang => typeof v === "string" && (ADMIN_LANGS as readonly string[]).includes(v)
