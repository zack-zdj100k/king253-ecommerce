import { z } from "zod"

import { findCommune, findWilaya } from "@/lib/algeria"
import { normalizePhone } from "@/lib/phone"

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))

export const phoneSchema = z
  .string({ error: "Enter your phone number." })
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizePhone(value)
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Algerian mobile number (05, 06 or 07 followed by 8 digits)." })
      return z.NEVER
    }
    return normalized
  })

const customerFields = z.object({
  fullName: z.string({ error: "Enter your full name." }).trim().min(2, "Enter your full name.").max(120),
  age: z.coerce
    .number({ error: "Enter your age." })
    .int("Enter your age in years.")
    .min(13, "You must be at least 13 to order.")
    .max(110, "Enter a valid age."),
  phone: phoneSchema,
  email: z
    .union([z.literal(""), z.email("Enter a valid email address.")])
    .optional()
    .nullable()
    .transform((v) => (v ? v.toLowerCase() : null)),
  wilaya: z.string({ error: "Choose your wilaya." }).trim().min(1, "Choose your wilaya.").max(80),
  city: z.string({ error: "Choose your commune." }).trim().min(1, "Choose your commune.").max(120),
  address: z.string({ error: "Enter your street address." }).trim().min(4, "Enter your street address.").max(300),
  notes: optionalText(500),
})
/** Wilaya and commune must exist on the official map; stored with their official names. */
export const customerInfoSchema = customerFields.transform((info, ctx) => {
  const wilaya = findWilaya(info.wilaya)
  if (!wilaya) {
    ctx.addIssue({ code: "custom", path: ["wilaya"], message: "Choose your wilaya from the list." })
    return z.NEVER
  }
  const city = findCommune(wilaya, info.city)
  if (!city) {
    ctx.addIssue({ code: "custom", path: ["city"], message: `Choose your commune in ${wilaya.fr}.` })
    return z.NEVER
  }
  return { ...info, wilaya: wilaya.fr, city }
})
export type CustomerInfo = z.infer<typeof customerInfoSchema>

export const orderLineSchema = z.object({
  variantId: z.uuid("Invalid product option."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1.").max(20, "Maximum 20 per item."),
})

export const createOrderSchema = z.object({
  customer: customerInfoSchema,
  lines: z.array(orderLineSchema).min(1, "Your bag is empty.").max(30),
  idempotencyKey: z.string().min(16).max(100),
})
export type CreateOrderInput = z.input<typeof createOrderSchema>

export const discountSchema = z
  .object({
    type: z.enum(["fixed", "percent"]).nullable(),
    value: z.coerce.number().int("Use whole numbers.").min(0, "Discount cannot be negative."),
  })
  .refine((d) => d.type !== "percent" || d.value <= 100, { message: "A percentage discount cannot exceed 100%.", path: ["value"] })

export const trackSchema = z.object({
  number: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]+-\d{8}-\d{3,}$/, "Enter the order number exactly as shown, e.g. KING253-20261004-001."),
  phone: phoneSchema,
})

/** Flatten zod issues into { field: message } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form"
    if (!out[key]) out[key] = issue.message
  }
  return out
}
