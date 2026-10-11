import { sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

/* ------------------------------------------------------------------ */
/* Enums                                                              */
/* ------------------------------------------------------------------ */

export const userRole = pgEnum("user_role", ["admin", "customer"])
export const productStatus = pgEnum("product_status", ["draft", "published", "archived"])
export const gender = pgEnum("gender", ["men", "women", "unisex"])
export const orderStatus = pgEnum("order_status", [
  "pending",
  "contacting",
  "confirmed",
  "preparing",
  "ready_for_delivery",
  "delivered",
  "cancelled",
])
export const discountType = pgEnum("discount_type", ["fixed", "percent"])
export const paymentMethod = pgEnum("payment_method", ["cod"])
export const reservationStatus = pgEnum("reservation_status", ["active", "released", "consumed"])
export const movementType = pgEnum("movement_type", [
  "adjustment", // admin changed physical stock
  "reserve", // order created / edited
  "release", // order cancelled / edited / exchange rejected
  "deliver", // order delivered: physical and reserved both decrease
  "return_restock", // returned item received in resellable condition
  "exchange_ship", // replacement for an exchange handed over
])
export const returnType = pgEnum("return_type", ["return", "exchange"])
export const returnStatus = pgEnum("return_status", ["requested", "approved", "rejected", "received", "completed"])
export const itemCondition = pgEnum("item_condition", ["resellable", "damaged"])
export const reviewStatus = pgEnum("review_status", ["pending", "approved", "rejected"])
export const notificationStatus = pgEnum("notification_status", ["sent", "failed", "skipped"])

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

/* ------------------------------------------------------------------ */
/* Auth                                                               */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("customer"),
    customerId: uuid("customer_id").references(() => customers.id),
    /** Sign-up answer to "How did you find us?" (tiktok, instagram, facebook, friend, other). */
    referralSource: text("referral_source"),
    /** Saved delivery details from the account page (prefill checkout). */
    phone: text("phone"),
    wilaya: text("wilaya"),
    city: text("city"),
    address: text("address"),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_unique").on(sql`lower(${t.email})`)]
)

/** Session id = SHA-256 of the cookie token, so a DB leak cannot hijack sessions. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
)

/* ------------------------------------------------------------------ */
/* Customers                                                          */
/* ------------------------------------------------------------------ */

/** One record per real person, identified by normalised phone (+213…). */
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: text("phone").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email"),
    age: smallint("age"),
    wilaya: text("wilaya"),
    city: text("city"),
    address: text("address"),
    ...timestamps,
  },
  (t) => [uniqueIndex("customers_phone_unique").on(t.phone), index("customers_name_idx").on(t.fullName)]
)

/* ------------------------------------------------------------------ */
/* Physical shops                                                     */
/* ------------------------------------------------------------------ */

/** KING 253 shops shown on the Location page; visitors pick the closest one. */
export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  wilaya: text("wilaya").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  phone: text("phone"),
  /** One line per row: "Days | Hours". */
  hours: text("hours"),
  /** Google Maps link for directions (optional). */
  mapUrl: text("map_url"),
  /** Coordinates enable "closest shop" and the map (optional). */
  latitude: real("latitude"),
  longitude: real("longitude"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
})

/* ------------------------------------------------------------------ */
/* Catalog                                                            */
/* ------------------------------------------------------------------ */

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    tagline: text("tagline"),
    /** Main category this one belongs to (e.g. Pants › Baggy jeans); null = main category. Two levels only. */
    parentId: integer("parent_id").references((): AnyPgColumn => categories.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("categories_slug_unique").on(t.slug), index("categories_parent_idx").on(t.parentId)]
)

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    categoryId: integer("category_id").references(() => categories.id),
    gender: gender("gender").notNull().default("men"),
    status: productStatus("status").notNull().default("draft"),
    /** Prices are whole Algerian dinars (DA). */
    price: integer("price"),
    salePrice: integer("sale_price"),
    material: text("material"),
    fit: text("fit"),
    style: text("style"),
    collection: text("collection"),
    quality: text("quality"),
    care: text("care"),
    shortDescription: text("short_description"),
    description: text("description"),
    story: text("story"),
    inspiration: text("inspiration"),
    brandNote: text("brand_note"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    videoUrl: text("video_url"),
    featured: boolean("featured").notNull().default(false),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    ogImageUrl: text("og_image_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("products_slug_unique").on(t.slug),
    index("products_status_idx").on(t.status),
    index("products_category_idx").on(t.categoryId),
    check("products_price_non_negative", sql`${t.price} is null or ${t.price} >= 0`),
    check(
      "products_sale_price_valid",
      sql`${t.salePrice} is null or (${t.salePrice} >= 0 and (${t.price} is null or ${t.salePrice} <= ${t.price}))`
    ),
  ]
)

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt"),
    /** Colour this photo shows (matches product_variants.color); null = all colours. */
    color: text("color"),
    sortOrder: integer("sort_order").notNull().default(0),
    isMain: boolean("is_main").notNull().default(false),
    /** Focal point and zoom for cropping campaign shots into product frames. */
    focusX: real("focus_x").notNull().default(50),
    focusY: real("focus_y").notNull().default(50),
    zoom: real("zoom").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("product_images_product_idx").on(t.productId, t.sortOrder)]
)

/**
 * Inventory lives here, per size + colour.
 * available = physical - reserved (never stored; always derived).
 */
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    size: text("size").notNull(),
    color: text("color").notNull(),
    colorHex: text("color_hex"),
    physical: integer("physical").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    /** Colour price (applies to every size of the colour); null = product price. */
    priceOverride: integer("price_override"),
    /** Colour promo price; null = no colour promo (product promo applies only to colours without their own price). */
    salePriceOverride: integer("sale_price_override"),
    lowStockThreshold: integer("low_stock_threshold"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("product_variants_sku_unique").on(t.sku),
    uniqueIndex("product_variants_barcode_unique").on(t.barcode),
    uniqueIndex("product_variants_option_unique").on(t.productId, t.size, t.color),
    index("product_variants_product_idx").on(t.productId),
    // The database itself refuses negative or impossible stock.
    check("variants_physical_non_negative", sql`${t.physical} >= 0`),
    check("variants_reserved_non_negative", sql`${t.reserved} >= 0`),
    check("variants_reserved_within_physical", sql`${t.reserved} <= ${t.physical}`),
    check("variants_price_override_non_negative", sql`${t.priceOverride} is null or ${t.priceOverride} >= 0`),
    check("variants_sale_price_override_non_negative", sql`${t.salePriceOverride} is null or ${t.salePriceOverride} >= 0`),
  ]
)

/* ------------------------------------------------------------------ */
/* Cart, checkout session                                             */
/* ------------------------------------------------------------------ */

/** Shopping intent only — never reserves stock. Also feeds abandoned-cart reports. */
export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    customerId: uuid("customer_id").references(() => customers.id),
    /** Saved checkout details entered with this cart (for abandoned-cart reports). */
    profileId: text("profile_id"),
    checkoutStartedAt: timestamp("checkout_started_at", { withTimezone: true }),
    infoEnteredAt: timestamp("info_entered_at", { withTimezone: true }),
    orderId: uuid("order_id"),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index("carts_activity_idx").on(t.lastActivityAt)]
)

export const cartItems = pgTable(
  "cart_items",
  {
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.cartId, t.variantId] }), check("cart_items_quantity_positive", sql`${t.quantity} > 0`)]
)

/**
 * Guest checkout details kept server-side (keyed by a hashed httpOnly cookie)
 * so Buy Now can be prefilled without putting personal data in localStorage.
 */
export const checkoutProfiles = pgTable("checkout_profiles", {
  id: text("id").primaryKey(),
  fullName: text("full_name"),
  age: smallint("age"),
  phone: text("phone"),
  email: text("email"),
  wilaya: text("wilaya"),
  city: text("city"),
  address: text("address"),
  notes: text("notes"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
})

/* ------------------------------------------------------------------ */
/* Orders                                                             */
/* ------------------------------------------------------------------ */

export const orderCounters = pgTable("order_counters", {
  day: text("day").primaryKey(), // YYYYMMDD in Africa/Algiers
  last: integer("last").notNull().default(0),
})

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull(),
    /** Client-generated per checkout; a retry with the same key returns the same order. */
    idempotencyKey: text("idempotency_key").notNull(),
    /** Random secret for the confirmation link. */
    accessToken: text("access_token").notNull(),
    /** Null if the customer profile was removed — the order keeps its own snapshot. */
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    status: orderStatus("status").notNull().default("pending"),
    paymentMethod: paymentMethod("payment_method").notNull().default("cod"),
    // Customer snapshot at order time
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    customerAge: smallint("customer_age"),
    // Delivery snapshot
    /** Wilaya as typed by the customer. */
    wilayaName: text("wilaya_name").notNull(),
    city: text("city").notNull(),
    address: text("address").notNull(),
    estimatedDays: text("estimated_days"),
    /** What the courier charges. Paid by the customer — unless freeDelivery, then the shop pays it. */
    deliveryFee: integer("delivery_fee").notNull(),
    freeDelivery: boolean("free_delivery").notNull().default(false),
    /**
     * Same customer ordered again before the first order was delivered: both
     * go in one delivery. The fee sits on the first ("lead") order only.
     */
    /** Customer removed this (cancelled) order from their account list. The shop keeps it. */
    hiddenByCustomerAt: timestamp("hidden_by_customer_at", { withTimezone: true }),
    shipsWithOrderId: uuid("ships_with_order_id").references((): AnyPgColumn => orders.id, { onDelete: "set null" }),
    // Money (DA)
    subtotal: integer("subtotal").notNull(),
    discountType: discountType("discount_type"),
    discountValue: integer("discount_value").notNull().default(0),
    discountAmount: integer("discount_amount").notNull().default(0),
    total: integer("total").notNull(),
    customerNotes: text("customer_notes"),
    adminNotes: text("admin_notes"),
    cartId: uuid("cart_id"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("orders_number_unique").on(t.number),
    uniqueIndex("orders_idempotency_unique").on(t.idempotencyKey),
    index("orders_status_idx").on(t.status),
    index("orders_created_idx").on(t.createdAt),
    index("orders_customer_idx").on(t.customerId),
    index("orders_phone_idx").on(t.customerPhone),
    check("orders_money_non_negative", sql`${t.subtotal} >= 0 and ${t.deliveryFee} >= 0 and ${t.discountAmount} >= 0 and ${t.total} >= 0`),
    check("orders_discount_within_subtotal", sql`${t.discountAmount} <= ${t.subtotal}`),
  ]
)

/** Snapshot of what was sold — later product edits never change history. */
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Null if the product/variant was later deleted — the snapshot below stays. */
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    sku: text("sku").notNull(),
    size: text("size").notNull(),
    color: text("color").notNull(),
    imageUrl: text("image_url"),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotal: integer("line_total").notNull(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    index("order_items_product_idx").on(t.productId),
    check("order_items_quantity_positive", sql`${t.quantity} > 0`),
    check("order_items_price_non_negative", sql`${t.unitPrice} >= 0`),
  ]
)

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatus("from_status"),
    toStatus: orderStatus("to_status").notNull(),
    note: text("note"),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    actorLabel: text("actor_label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_status_history_order_idx").on(t.orderId, t.createdAt)]
)

/* ------------------------------------------------------------------ */
/* Inventory ledger                                                   */
/* ------------------------------------------------------------------ */

export const stockReservations = pgTable(
  "stock_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id").references(() => orderItems.id, { onDelete: "cascade" }),
    returnRequestId: uuid("return_request_id"),
    quantity: integer("quantity").notNull(),
    status: reservationStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("stock_reservations_variant_idx").on(t.variantId, t.status),
    index("stock_reservations_item_idx").on(t.orderItemId),
    check("stock_reservations_quantity_positive", sql`${t.quantity} > 0`),
  ]
)

/** Every stock change, with before/after values and who/why. Doubles as StockAdjustment history. */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    type: movementType("type").notNull(),
    physicalBefore: integer("physical_before").notNull(),
    physicalAfter: integer("physical_after").notNull(),
    reservedBefore: integer("reserved_before").notNull(),
    reservedAfter: integer("reserved_after").notNull(),
    reason: text("reason"),
    refType: text("ref_type"),
    refId: text("ref_id"),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stock_movements_variant_idx").on(t.variantId, t.createdAt), index("stock_movements_type_idx").on(t.type)]
)

/* ------------------------------------------------------------------ */
/* Returns & exchanges                                                */
/* ------------------------------------------------------------------ */

export const returnRequests = pgTable(
  "return_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    type: returnType("type").notNull(),
    reason: text("reason").notNull(),
    details: text("details"),
    quantity: integer("quantity").notNull(),
    status: returnStatus("status").notNull().default("requested"),
    replacementVariantId: uuid("replacement_variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    condition: itemCondition("condition"),
    /** Money given back when a return (not an exchange) is completed; deducted from revenue. */
    refundAmount: integer("refund_amount"),
    adminNote: text("admin_note"),
    ...timestamps,
  },
  (t) => [index("return_requests_order_idx").on(t.orderId), index("return_requests_status_idx").on(t.status)]
)

/* ------------------------------------------------------------------ */
/* Social proof                                                       */
/* ------------------------------------------------------------------ */

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    authorName: text("author_name").notNull(),
    rating: smallint("rating").notNull(),
    body: text("body").notNull(),
    status: reviewStatus("status").notNull().default("pending"),
    /** Only true when the server matched a delivered order containing this product. */
    verifiedPurchase: boolean("verified_purchase").notNull().default(false),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    moderatedBy: uuid("moderated_by").references(() => users.id),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reviews_product_idx").on(t.productId, t.status), check("reviews_rating_range", sql`${t.rating} between 1 and 5`)]
)

/** Admin-curated customer words. Nothing is shown until an admin publishes it. */
export const testimonials = pgTable("testimonials", {
  id: uuid("id").primaryKey().defaultRandom(),
  quote: text("quote").notNull(),
  name: text("name").notNull(),
  role: text("role"),
  imageUrl: text("image_url"),
  published: boolean("published").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
})

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })]
)

/* ------------------------------------------------------------------ */
/* Analytics, notifications, audit                                    */
/* ------------------------------------------------------------------ */

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    type: text("type").notNull(), // product_view | add_to_cart | checkout_start | order_created
    sessionId: text("session_id"),
    productId: uuid("product_id"),
    variantId: uuid("variant_id"),
    orderId: uuid("order_id"),
    quantity: integer("quantity"),
    day: text("day").notNull(), // YYYY-MM-DD, used to de-duplicate views
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("analytics_type_created_idx").on(t.type, t.createdAt),
    index("analytics_product_idx").on(t.productId),
    uniqueIndex("analytics_view_dedupe")
      .on(t.sessionId, t.productId, t.day)
      .where(sql`${t.type} = 'product_view'`),
  ]
)

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: text("channel").notNull().default("email"),
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    template: text("template").notNull(),
    status: notificationStatus("status").notNull(),
    error: text("error"),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_order_idx").on(t.orderId)]
)

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    data: jsonb("data"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId, t.createdAt)]
)

/* ------------------------------------------------------------------ */
/* Settings & CMS                                                     */
/* ------------------------------------------------------------------ */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const contentBlocks = pgTable("content_blocks", {
  key: text("key").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
