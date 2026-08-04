"use client"

import { useRef, useState, type DragEvent } from "react"
import Image from "next/image"
import { GripVertical, ImagePlus, Loader2, Star, Trash2, X } from "lucide-react"
import { uploadProductImage, deleteProductImage } from "@/services/storage.service"
import type { ProductImage } from "@/types/product"
import { Label } from "@/components/ui/label"

const MAX_IMAGES = 10
const MAX_FILE_BYTES = 10 * 1024 * 1024
const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
const ACCEPT_ATTR = "image/jpeg,image/jpg,image/png,image/webp"

type UploadingItem = {
  id: string
  fileName: string
  progress: number
  error?: string
}

/** Reorders `value` and recomputes isCover so index 0 is always the cover. */
function withCoverRecomputed(images: ProductImage[]): ProductImage[] {
  return images.map((img, i) => ({ url: img.url, isCover: i === 0 }))
}

/**
 * Modern multi-image uploader for the seller product form — replaces the
 * old single "Image URL" text input. Handles gallery/file-explorer picking
 * and desktop drag-and-drop, compresses each image client-side, uploads to
 * Firebase Storage with live progress, and reports only successfully
 * uploaded images back to the parent form via `value`/`onChange`. The first
 * image in `value` is always the cover.
 */
export function ProductImageUploader({
  uid,
  value,
  onChange,
}: {
  uid: string
  value: ProductImage[]
  onChange: (images: ProductImage[]) => void
}) {
  const [uploading, setUploading] = useState<UploadingItem[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const draggedIndexRef = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const totalCount = value.length + uploading.length

  function validateFile(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `"${file.name}" must be a JPG, PNG or WEBP image.`
    }
    if (file.size > MAX_FILE_BYTES) {
      return `"${file.name}" is too large — the maximum size is 10 MB.`
    }
    return null
  }

  async function handleFiles(files: FileList | File[]) {
    const incoming = Array.from(files)
    const room = MAX_IMAGES - totalCount
    if (room <= 0) {
      setUploading((prev) => [
        ...prev,
        { id: crypto.randomUUID(), fileName: "", progress: 0, error: `You can upload up to ${MAX_IMAGES} images.` },
      ])
      return
    }

    const toUpload = incoming.slice(0, room)
    if (incoming.length > toUpload.length) {
      setUploading((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          fileName: "",
          progress: 0,
          error: `Only ${room} more image${room === 1 ? "" : "s"} can be added (max ${MAX_IMAGES}).`,
        },
      ])
    }

    for (const file of toUpload) {
      const validationError = validateFile(file)
      const id = crypto.randomUUID()

      if (validationError) {
        setUploading((prev) => [...prev, { id, fileName: file.name, progress: 0, error: validationError }])
        continue
      }

      setUploading((prev) => [...prev, { id, fileName: file.name, progress: 0 }])

      try {
        const url = await uploadProductImage(uid, file, (percent) => {
          setUploading((prev) => prev.map((item) => (item.id === id ? { ...item, progress: percent } : item)))
        })
        setUploading((prev) => prev.filter((item) => item.id !== id))
        onChange(withCoverRecomputed([...value, { url, isCover: false }]))
      } catch (err) {
        setUploading((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, error: err instanceof Error ? err.message : "Upload failed." } : item,
          ),
        )
      }
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) handleFiles(e.target.files)
    e.target.value = ""
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files)
  }

  async function removeImage(index: number) {
    const removed = value[index]
    onChange(withCoverRecomputed(value.filter((_, i) => i !== index)))
    await deleteProductImage(removed.url)
  }

  function dismissUploadError(id: string) {
    setUploading((prev) => prev.filter((item) => item.id !== id))
  }

  function handleThumbDragStart(index: number) {
    draggedIndexRef.current = index
  }

  function handleThumbDragOver(e: DragEvent<HTMLDivElement>, index: number) {
    e.preventDefault()
    setDragOverIndex(index)
  }

  function handleThumbDrop(index: number) {
    const from = draggedIndexRef.current
    draggedIndexRef.current = null
    setDragOverIndex(null)
    if (from === null || from === index) return
    const next = [...value]
    const [moved] = next.splice(from, 1)
    next.splice(index, 0, moved)
    onChange(withCoverRecomputed(next))
  }

  return (
    <div className="flex flex-col gap-3">
      <Label>
        Product Images <span className="text-red-600">*</span>
      </Label>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
          dragActive ? "border-green-600 bg-green-50" : "border-border bg-[#f3f5f2] hover:border-green-600"
        }`}
      >
        <ImagePlus className="size-7 text-green-700" />
        <p className="text-sm font-medium text-black">
          Drag &amp; drop images here, or click to browse
        </p>
        <p className="text-xs text-muted-foreground">
          JPG, PNG or WEBP · up to 10 MB each · {totalCount}/{MAX_IMAGES} used
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {(value.length > 0 || uploading.length > 0) && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {value.map((img, index) => (
            <div
              key={img.url}
              draggable
              onDragStart={() => handleThumbDragStart(index)}
              onDragOver={(e) => handleThumbDragOver(e, index)}
              onDrop={() => handleThumbDrop(index)}
              onDragEnd={() => setDragOverIndex(null)}
              className={`group relative aspect-square overflow-hidden rounded-xl border-2 bg-white ${
                dragOverIndex === index ? "border-green-600" : "border-border"
              }`}
            >
              <Image src={img.url} alt="" fill className="object-cover" />

              {img.isCover && (
                <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                  <Star className="size-2.5 fill-current" />
                  Cover
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/50 px-1.5 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="cursor-grab text-white" title="Drag to reorder">
                  <GripVertical className="size-4" />
                </span>
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  aria-label="Remove image"
                  className="text-white hover:text-red-300"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}

          {uploading.map((item) => (
            <div
              key={item.id}
              className={`relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-2 text-center ${
                item.error ? "border-destructive bg-red-50" : "border-border bg-white"
              }`}
            >
              {item.error ? (
                <>
                  <p className="line-clamp-3 text-[11px] text-destructive">{item.error}</p>
                  <button
                    type="button"
                    onClick={() => dismissUploadError(item.id)}
                    aria-label="Dismiss"
                    className="absolute right-1 top-1 text-muted-foreground hover:text-black"
                  >
                    <X className="size-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="size-5 animate-spin text-green-700" />
                  <p className="text-[10px] text-muted-foreground">{item.progress}%</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {value.length === 0 && uploading.length === 0 && (
        <p className="text-xs text-muted-foreground">At least 1 image is required.</p>
      )}
      {value.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Drag a thumbnail to reorder — the first image is always the product&apos;s cover photo.
        </p>
      )}
    </div>
  )
}
