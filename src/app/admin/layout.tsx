import { ForceLtr } from "@/components/admin/force-ltr"

/** Admin (panel and login): English, left to right, whatever language the storefront visitor chose. */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div dir="ltr" lang="en">
      <ForceLtr />
      {children}
    </div>
  )
}
