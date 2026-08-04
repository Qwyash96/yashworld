const MAX_DIMENSION = 1920
const JPEG_QUALITY = 0.85

/**
 * Client-only: downscales an image to fit within MAX_DIMENSION (preserving
 * aspect ratio) and re-encodes it, trading negligible visible quality for a
 * meaningfully smaller upload. PNGs stay PNG (lossless); everything else
 * becomes JPEG. Falls back to the original file untouched if compression
 * doesn't actually help or the browser can't decode it.
 */
export async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return file

    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg"
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, outputType === "image/jpeg" ? JPEG_QUALITY : undefined),
    )
    if (!blob || blob.size >= file.size) return file

    const ext = outputType === "image/png" ? "png" : "jpg"
    const baseName = file.name.replace(/\.[^.]+$/, "")
    return new File([blob], `${baseName}.${ext}`, { type: outputType })
  } catch {
    // Decoding failed for some reason (corrupt file, unsupported variant) —
    // let the caller's own type/size validation catch it instead.
    return file
  }
}
