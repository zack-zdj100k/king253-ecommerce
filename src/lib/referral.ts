/** Answers to "Where did you hear about us?" (sign-up and checkout). */
export const REFERRAL_SOURCES = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "facebook", label: "Facebook" },
  { key: "friend", label: "A friend" },
  { key: "google", label: "Google" },
  { key: "other", label: "Other" },
] as const

export type ReferralSource = (typeof REFERRAL_SOURCES)[number]["key"]

export const isReferralSource = (v: unknown): v is ReferralSource => REFERRAL_SOURCES.some((s) => s.key === v)

export const referralLabel = (key: string | null) => REFERRAL_SOURCES.find((s) => s.key === key)?.label ?? "Not asked"
