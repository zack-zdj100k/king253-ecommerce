import { mkdtemp, readFile, stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
process.env.UPLOAD_DIR = path.join(os.tmpdir(), "king-video-test")

const { sniffVideo, videoProblem, videoUrlOk, storeVideo, removeVideoFile, openMedia, UPLOAD_ROOT, MAX_VIDEO_BYTES } = await import("@/server/uploads")

const mp4 = (brand = "isom", extra = "") => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftyp" + brand + "\0\0\0\0isomavc1" + extra), Buffer.alloc(64)])
const file = (buf: Buffer, name = "a.mp4") => new File([new Uint8Array(buf)], name)

describe("product video", () => {
  it("accepts H.264 mp4 and webm, rejects the rest", () => {
    expect(sniffVideo(mp4())).toBe("mp4")
    expect(sniffVideo(Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(32)]))).toBe("webm")
    expect(videoProblem(mp4("qt  "))).toMatch(/QuickTime|\.mov/)
    expect(videoProblem(mp4("isom", "hvc1"))).toMatch(/HEVC/)
    expect(videoProblem(Buffer.from("<script>alert(1)</script>".padEnd(40)))).toMatch(/Only MP4/)
    expect(videoProblem(Buffer.alloc(40))).toMatch(/Only MP4/)
  })
  it("validates urls", () => {
    expect(videoUrlOk("/media/videos/2026/11/abc-1.mp4")).toBe(true)
    expect(videoUrlOk("/media/videos/../../etc/passwd.mp4")).toBe(false)
    expect(videoUrlOk("javascript:alert(1)")).toBe(false)
    expect(videoUrlOk("https://cdn.example.com/a.mp4")).toBe(true)
    expect(videoUrlOk("http://x.com/a.mp4")).toBe(false)
  })
  it("stores, serves safely and removes", async () => {
    await expect(storeVideo(file(Buffer.from("not a video at all, text".padEnd(64))))).rejects.toThrow()
    await expect(storeVideo({ size: MAX_VIDEO_BYTES + 1, name: "x" } as File)).rejects.toThrow(/limit/)
    const url = await storeVideo(file(mp4()))
    expect(url).toMatch(/^\/media\/videos\/\d{4}\/\d{2}\/[\w-]+\.mp4$/)
    const m = await openMedia(url.replace("/media/", "").split("/"))
    expect(m?.type).toBe("video/mp4")
    expect(await openMedia(["..", "..", "etc", "passwd"])).toBeNull()
    await removeVideoFile(url)
    expect(await stat(path.join(UPLOAD_ROOT, url.replace("/media/", ""))).catch(() => null)).toBeNull()
    void mkdtemp; void readFile
  })
})
