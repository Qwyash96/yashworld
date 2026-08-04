"use client"

import { useRef, useState, type DragEvent } from "react"
import Image from "next/image"
import { ImagePlus, Loader2, FolderOpen, X } from "lucide-react"
import { getOwnMediaAssets } from "@/lib/media-library"
import type { MediaFolder, MediaAsset } from "@/types/media"

const ACCEPT_ATTR = "image/jpeg,image/jpg,image/png,image/webp"

/**
 * The one single-image upload widget used everywhere a form needs exactly
 * one image (category thumbnail, seller logo/banner, profile photo, coupon
 * banner, site brand logo, ...) — file picker + desktop drag-and-drop +
 * live progress + "choose an image you already uploaded before" from the
 * Media Library, so a user is never asked to paste a URL. Compression
 * happens inside `uploadFn` (services/storage.service.ts), not here.
 */
export function SingleImageUploader({
  uid,
  folder,
  value,
  onChange,
  uploadFn,
  label,
  required,
  aspectClassName = "aspect-video",
}: {
  uid: string
  folder: MediaFolder
  value: string
  onChange: (url: string) => void
  uploadFn: (uid: string, file: File, onProgress?: (percent: number) => void) => Promise<string>
  label?: string
  required?: boolean
  aspectClassName?: string
}) {
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [dragActive, setDragActive] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [libraryAssets, setLibraryAssets] = useState<MediaAsset[] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError("")
    setProgress(0)
    try {
      const url = await uploadFn(uid, file, setProgress)
      onChange(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setProgress(null)
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  function openLibrary() {
    setLibraryOpen((open) => !open)
    if (libraryAssets === null) {
      getOwnMediaAssets(uid, folder).then(setLibraryAssets)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <p className="text-sm font-medium text-black">
          {label} {required && <span className="text-red-600">*</span>}
        </p>
      )}

      {value ? (
        <div className={`relative w-full overflow-hidden rounded-xl border border-border bg-gray-50 ${aspectClassName}`}>
          <Image src={value} alt="" fill className="object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Remove image"
            className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${aspectClassName} ${
            dragActive ? "border-green-600 bg-green-50" : "border-border bg-[#f3f5f2] hover:border-green-600"
          }`}
        >
          {progress !== null ? (
            <>
              <Loader2 className="size-6 animate-spin text-green-700" />
              <p className="text-xs text-muted-foreground">{progress}%</p>
            </>
          ) : (
            <>
              <ImagePlus className="size-6 text-green-700" />
              <p className="text-sm font-medium text-black">Drag &amp; drop, or click to upload</p>
              <p className="text-xs text-muted-foreground">JPG, PNG or WEBP · up to 10 MB</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0])
              e.target.value = ""
            }}
          />
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <button
        type="button"
        onClick={openLibrary}
        className="flex w-fit items-center gap-1.5 text-xs font-medium text-green-700 hover:underline"
      >
        <FolderOpen className="size-3.5" />
        Choose from Media Library
      </button>

      {libraryOpen && (
        <div className="rounded-xl border border-border bg-white p-3">
          {libraryAssets === null && <p className="text-xs text-muted-foreground">Loading...</p>}
          {libraryAssets?.length === 0 && (
            <p className="text-xs text-muted-foreground">No previous uploads in this category yet.</p>
          )}
          {libraryAssets && libraryAssets.length > 0 && (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {libraryAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    onChange(asset.url)
                    setLibraryOpen(false)
                  }}
                  className="relative aspect-square overflow-hidden rounded-lg border border-border transition hover:border-green-600"
                >
                  <Image src={asset.url} alt="" fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
