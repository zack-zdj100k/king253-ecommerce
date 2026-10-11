"use server"

import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { z } from "zod"

import { db } from "@/server/db"
import { productVariants } from "@/server/db/schema"
import { adjustPhysicalStock, receiveStock } from "@/server/inventory"
import {
  addImages,
  createVariant,
  deleteCategory,
  deleteImage,
  deleteProduct,
  saveColour,
  setImageColour,
  deleteVariant,
  reorderImages,
  saveCategory,
  saveProduct,
  setMainImage,
  updateImage,
  updateVariant,
  type CategoryInput,
  type ColourInput,
  type ProductInput,
  type VariantInput,
} from "@/server/products-admin"
import { adminAction } from "./_shared"

const id = z.uuid()
const productPaths = (pid?: string) => ["/admin/products", ...(pid ? [`/admin/products/${pid}`] : []), "/clothes", "/"]

export async function saveProductAction(productId: string | null, input: ProductInput) {
  const result = await adminAction(
    async ({ actor }) => {
      const product = await saveProduct(db, productId ? id.parse(productId) : null, input, actor)
      return { id: product.id, slug: product.slug }
    },
    { revalidate: productPaths(productId ?? undefined), message: "Product saved." }
  )
  if (result.ok && !productId) redirect(`/admin/products/${result.data.id}`)
  return result
}

export async function createVariantAction(productId: string, input: VariantInput & { initialStock?: number }) {
  return adminAction(
    async ({ actor }) => {
      await createVariant(db, id.parse(productId), input, actor)
    },
    { revalidate: productPaths(productId), message: "Variant added." }
  )
}

export async function updateVariantAction(productId: string, variantId: string, input: VariantInput) {
  return adminAction(
    async ({ actor }) => {
      await updateVariant(db, id.parse(variantId), input, actor)
    },
    { revalidate: productPaths(productId), message: "Variant saved." }
  )
}

export async function deleteVariantAction(productId: string, variantId: string) {
  return adminAction(
    async ({ actor }) => {
      await deleteVariant(db, id.parse(variantId), actor)
    },
    { revalidate: [...productPaths(productId), "/admin/inventory"], message: "Variant deleted." }
  )
}

/** Inventory page: delete a size/colour by its id only. */
export async function deleteInventoryVariantAction(variantId: string) {
  return adminAction(
    async ({ actor }) => {
      await deleteVariant(db, id.parse(variantId), actor)
    },
    { revalidate: ["/admin/inventory", "/admin/products", "/clothes", "/"], message: "Variant deleted." }
  )
}

export async function deleteProductAction(productId: string) {
  return adminAction(
    async ({ actor }) => {
      await deleteProduct(db, id.parse(productId), actor)
    },
    { revalidate: ["/admin/products", "/admin/inventory", "/admin", "/clothes", "/"], message: "Product deleted." }
  )
}

/** Physical stock change with a mandatory reason (recorded in the stock ledger). */
export async function adjustStockAction(variantId: string, newPhysical: number, reason: string) {
  return adminAction(
    async ({ user }) => {
      const vid = id.parse(variantId)
      await db.transaction((tx) => adjustPhysicalStock(tx, { variantId: vid, newPhysical: z.number().int().parse(newPhysical), reason: String(reason), actorUserId: user.id }))
      const [v] = await db.select({ productId: productVariants.productId }).from(productVariants).where(eq(productVariants.id, vid))
      return v?.productId
    },
    { revalidate: ["/admin/inventory", "/admin/products", "/clothes"], message: "Stock updated." }
  )
}

const colourName = z.string().trim().min(1).max(60).nullable()

export async function addImagesAction(productId: string, urls: string[], color: string | null = null) {
  return adminAction(
    async ({ actor }) => {
      const clean = z.array(z.string().regex(/^\/(media|images)\/[\w/.-]+$/)).min(1).max(12).parse(urls)
      await addImages(db, id.parse(productId), clean, actor, colourName.parse(color))
    },
    { revalidate: productPaths(productId), message: "Images added." }
  )
}

export async function updateImageAction(productId: string, imageId: string, input: { alt: string; focusX: number; focusY: number; zoom: number }) {
  return adminAction(
    async () => {
      await updateImage(db, id.parse(imageId), input)
    },
    { revalidate: productPaths(productId), message: "Image saved." }
  )
}

export async function setMainImageAction(productId: string, imageId: string) {
  return adminAction(async () => setMainImage(db, id.parse(productId), id.parse(imageId)), { revalidate: productPaths(productId), message: "Main image set." })
}

export async function reorderImagesAction(productId: string, ids: string[]) {
  return adminAction(async () => reorderImages(db, id.parse(productId), z.array(z.uuid()).max(50).parse(ids)), { revalidate: productPaths(productId) })
}

export async function deleteImageAction(productId: string, imageId: string) {
  return adminAction(
    async ({ actor }) => {
      await deleteImage(db, id.parse(productId), id.parse(imageId), actor)
    },
    { revalidate: productPaths(productId), message: "Image removed." }
  )
}

const categoryPaths = ["/admin/products/categories", "/admin/products", "/clothes", "/"]

export async function saveCategoryAction(categoryId: number | null, input: CategoryInput) {
  return adminAction(
    async () => {
      await saveCategory(db, categoryId === null ? null : z.number().int().positive().parse(categoryId), input)
    },
    { revalidate: categoryPaths, message: "Category saved." }
  )
}

export async function deleteCategoryAction(categoryId: number) {
  return adminAction(
    async ({ actor }) => {
      await deleteCategory(db, z.number().int().positive().parse(categoryId), actor)
    },
    { revalidate: categoryPaths, message: "Category deleted — its products were kept." }
  )
}

export async function saveColourAction(productId: string, from: string, input: ColourInput) {
  return adminAction(
    async ({ actor }) => {
      await saveColour(db, id.parse(productId), z.string().min(1).max(60).parse(from), input, actor)
    },
    { revalidate: [...productPaths(productId), "/admin/inventory"], message: "Colour saved." }
  )
}

export async function setImageColourAction(productId: string, imageId: string, color: string | null) {
  return adminAction(
    async () => {
      await setImageColour(db, id.parse(productId), id.parse(imageId), colourName.parse(color))
    },
    { revalidate: productPaths(productId), message: "Photo moved." }
  )
}

/** Add newly received units on top of the current stock. */
export async function receiveStockAction(variantId: string, quantity: number, note: string) {
  return adminAction(
    async ({ user }) => {
      const vid = id.parse(variantId)
      await db.transaction((tx) =>
        receiveStock(tx, { variantId: vid, quantity: z.number().int().parse(quantity), note: String(note ?? ""), actorUserId: user.id })
      )
    },
    { revalidate: ["/admin/inventory", "/admin/products", "/clothes", "/"], message: "Stock added." }
  )
}
