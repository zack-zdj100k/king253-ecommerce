import { readMedia } from "@/server/uploads"

/** Serves uploaded product/CMS images. Files are content-addressed (uuid) so they cache forever. */
export async function GET(_request: Request, { params }: RouteContext<"/media/[...path]">) {
  const { path } = await params
  const file = await readMedia(path)
  if (!file) return new Response("Not found", { status: 404 })
  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
