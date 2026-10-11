/** Answers to "How did you find KING 253?" at sign-up. */
export const REFERRAL_SOURCES = [
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "friend", label: "A friend" },
  { key: "other", label: "Other" },
] as const

export type ReferralSource = (typeof REFERRAL_SOURCES)[number]["key"]

export const isReferralSource = (v: unknown): v is ReferralSource => REFERRAL_SOURCES.some((s) => s.key === v)

export const referralLabel = (key: string | null) => REFERRAL_SOURCES.find((s) => s.key === key)?.label ?? "Not asked"
