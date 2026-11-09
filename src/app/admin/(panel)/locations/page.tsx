import { redirect } from "next/navigation"

/** Old address of the Shops page. */
export default function LocationsRedirect() {
  redirect("/admin/shops")
}
