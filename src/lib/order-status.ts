/**
 * What the admin sees as an order's status. A delivered order whose every piece
 * came back (payment refused) reads "Returned"; one with some pieces back reads
 * "Delivered · part returned".
 */
const LABELS: Record<string, string> = {
  pending: "Pending",
  contacting: "Pending",
  confirmed: "Confirmed",
  preparing: "Confirmed",
  ready_for_delivery: "Confirmed",
  delivered: "Delivered",
  cancelled: "Cancelled",
}

export function orderStatusView(o: { status: string; paymentStatus?: string | null; partlyReturned?: boolean | null }) {
  if (o.status === "delivered" && o.paymentStatus === "refused") return { tone: "returned", label: "Returned" }
  if (o.status === "delivered" && o.partlyReturned) return { tone: "delivered", label: "Delivered · part returned" }
  return { tone: o.status, label: LABELS[o.status] ?? o.status }
}
