import { sql } from "drizzle-orm"

import { AppError } from "./errors"

type ProductPrices = { price: number | null; salePrice: number | null }
type ColourPrices = { priceOverride: number | null; salePriceOverride?: number | null }

/*
 * Pricing rule (one place, used everywhere):
 *   • A colour without its own prices sells at the product price, with the
 *     product promo if there is one.
 *   • A colour with its own price sells at that price, with ITS OWN promo if
 *     set — the product promo is a fixed amount for the product price, so it
 *     does not apply to a differently priced colour.
 *   • A promo only counts when it is lower than the regular price.
 */
export function offerOf(product: ProductPrices, variant: ColourPrices): { price: number | null; compareAt: number | null } {
  const ownPrices = variant.priceOverride !== null || (variant.salePriceOverride ?? null) !== null
  const regular = variant.priceOverride ?? product.price
  const promo = ownPrices ? (variant.salePriceOverride ?? null) : product.salePrice
  if (promo !== null && (regular === null || promo < regular)) return { price: promo, compareAt: regular }
  return { price: regular, compareAt: null }
}

/** What the customer pays for one unit. */
export function unitPriceOf(product: ProductPrices, variant: ColourPrices): number | null {
  return offerOf(product, variant).price
}

/** Same rule in SQL, for listing/sorting. `v` and `p` are the variant and product table aliases. */
export function effectivePriceSql(v: string, p: string) {
  const regular = `coalesce(${v}.price_override, ${p}.price)`
  return sql.raw(`(case
    when ${v}.price_override is null and ${v}.sale_price_override is null then
      (case when ${p}.sale_price is not null and (${p}.price is null or ${p}.sale_price < ${p}.price) then ${p}.sale_price else ${p}.price end)
    when ${v}.sale_price_override is not null and (${regular} is null or ${v}.sale_price_override < ${regular}) then ${v}.sale_price_override
    else ${regular} end)`)
}

export type DiscountInput = { type: "fixed" | "percent" | null; value: number }

/** Validates a discount against the subtotal and returns the amount in DA. */
export function discountAmountOf(subtotal: number, discount: DiscountInput): number {
  if (!discount.type || discount.value === 0) return 0
  if (!Number.isInteger(discount.value) || discount.value < 0) {
    throw new AppError("INVALID_DISCOUNT", "Discount must be a positive whole number.")
  }
  if (discount.type === "percent") {
    if (discount.value > 100) throw new AppError("INVALID_DISCOUNT", "A percentage discount cannot exceed 100%.")
    return Math.round((subtotal * discount.value) / 100)
  }
  if (discount.value > subtotal) {
    throw new AppError("INVALID_DISCOUNT", "The discount cannot be larger than the products subtotal.")
  }
  return discount.value
}

/**
 * Order money. Delivery is never part of the clothes price:
 *   clothes   = subtotal − discount            (the shop's sales)
 *   total     = what the courier collects     = clothes + delivery, or clothes only when delivery is free
 *   shopKeeps = clothes, minus the delivery the shop pays when it offers free delivery
 */
export function computeTotals(input: { subtotal: number; deliveryFee: number; discount: DiscountInput; freeDelivery?: boolean }) {
  const discountAmount = discountAmountOf(input.subtotal, input.discount)
  const clothes = input.subtotal - discountAmount
  const total = clothes + (input.freeDelivery ? 0 : input.deliveryFee)
  if (total < 0) throw new AppError("INVALID_TOTAL", "The order total cannot be negative.")
  return { discountAmount, total }
}

export function orderMoney(o: { subtotal: number; discountAmount: number; deliveryFee: number; freeDelivery: boolean }) {
  const clothes = o.subtotal - o.discountAmount
  const customerDelivery = o.freeDelivery ? 0 : o.deliveryFee
  return {
    clothes,
    deliveryFee: o.deliveryFee,
    customerDelivery,
    toCollect: clothes + customerDelivery,
    shopKeeps: clothes - (o.freeDelivery ? o.deliveryFee : 0),
  }
}

/**
 * Money given back for returned units: what the customer actually paid for
 * them (unit price less their share of the order discount). Delivery is not
 * refunded — it was never the shop's revenue.
 */
export function refundFor(item: { unitPrice: number }, quantity: number, order: { subtotal: number; discountAmount: number }) {
  const paidShare = order.subtotal > 0 ? (order.subtotal - order.discountAmount) / order.subtotal : 1
  return Math.round(item.unitPrice * quantity * paidShare)
}

/** Refunds of completed returns for an order row in SQL (same formula as refundFor). */
export function refundsSql(o: string) {
  return `coalesce((select sum(coalesce(r.refund_amount, round(oi.unit_price * r.quantity * (${o}.subtotal - ${o}.discount_amount)::numeric / nullif(${o}.subtotal, 0))))
    from return_requests r join order_items oi on oi.id = r.order_item_id
    where r.order_id = ${o}.id and r.type = 'return' and r.status = 'completed'), 0)`
}

/**
 * The shop's revenue for an order row in SQL (`o` = orders alias): clothes,
 * minus delivery the shop pays (free delivery), minus refunds of completed returns.
 */
export function netRevenueSql(o = "orders") {
  return sql.raw(`(${o}.subtotal - ${o}.discount_amount - case when ${o}.free_delivery then ${o}.delivery_fee else 0 end - ${refundsSql(o)})`)
}

/** Free-delivery promotion from settings, judged on the clothes total of the whole delivery. */
export function qualifiesForFreeDelivery(settings: { freeDelivery: boolean; freeDeliveryMin: number }, clothesTotal: number) {
  return settings.freeDelivery && clothesTotal >= settings.freeDeliveryMin
}
