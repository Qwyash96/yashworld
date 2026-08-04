"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { FolderOpen, Search, Trash2, Upload, RefreshCw, HardDrive } from "lucide-react"
import { fetchMediaAssets, deleteMediaAsset } from "@/lib/admin-media-client"
import { uploadToMediaFolder } from "@/services/storage.service"
import { useAdminAuth } from "@/components/admin/admin-auth-context"
import { MEDIA_FOLDERS } from "@/types/media"
import type { MediaAsset, MediaFolder } from "@/types/media"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function folderLabel(folder: string): string {
  return folder
    .split("-")
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ")
}

export default function AdminMediaPage() {
  const admin = useAdminAuth()
  const [assets, setAssets] = useState<MediaAsset[] | null>(null)
  const [totalBytes, setTotalBytes] = useState(0)
  const [search, setSearch] = useState("")
  const [folderFilter, setFolderFilter] = useState<"all" | MediaFolder>("all")
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadFolder, setUploadFolder] = useState<MediaFolder>("category-images")
  const [replacingId, setReplacingId] = useState<string | null>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  function refresh() {
    fetchMediaAssets().then((result) => {
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setAssets(result.assets)
      setTotalBytes(result.totalBytes)
    })
  }

  useEffect(refresh, [])

  const perFolder = useMemo(() => {
    const totals: Partial<Record<MediaFolder, { count: number; bytes: number }>> = {}
    for (const asset of assets ?? []) {
      const bucket = totals[asset.folder] ?? { count: 0, bytes: 0 }
      bucket.count += 1
      bucket.bytes += asset.sizeBytes ?? 0
      totals[asset.folder] = bucket
    }
    return totals
  }, [assets])

  const filtered = useMemo(() => {
    return (assets ?? []).filter((a) => {
      if (folderFilter !== "all" && a.folder !== folderFilter) return false
      if (search.trim() && !a.fileName.toLowerCase().includes(search.trim().toLowerCase())) return false
      return true
    })
  }, [assets, folderFilter, search])

  async function handleUpload(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      await uploadToMediaFolder(uploadFolder, admin.uid, file)
      toast.success("Uploaded.")
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setUploading(false)
    }
  }

  async function handleReplace(asset: MediaAsset, file: File | undefined) {
    if (!file) return
    setReplacingId(asset.id)
    try {
      await uploadToMediaFolder(asset.folder, admin.uid, file)
      const deleteResult = await deleteMediaAsset(asset.id)
      if (!deleteResult.ok) toast.error(deleteResult.error)
      toast.success("Replaced.")
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Replace failed.")
    } finally {
      setReplacingId(null)
    }
  }

  async function handleDelete(asset: MediaAsset) {
    if (!window.confirm(`Delete "${asset.fileName}"? This can't be undone.`)) return
    const result = await deleteMediaAsset(asset.id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Deleted.")
    if (previewAsset?.id === asset.id) setPreviewAsset(null)
    refresh()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FolderOpen className="size-6 text-green-700" />
          <h1 className="text-2xl font-bold text-black">Media Library</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={uploadFolder} onValueChange={(v) => v && setUploadFolder(v as MediaFolder)}>
            <SelectTrigger className="h-10 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEDIA_FOLDERS.map((f) => (
                <SelectItem key={f} value={f}>
                  {folderLabel(f)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="h-10" onClick={() => uploadInputRef.current?.click()} disabled={uploading}>
            <Upload className="size-4" />
            {uploading ? "Uploading..." : "Upload"}
          </Button>
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              handleUpload(e.target.files?.[0])
              e.target.value = ""
            }}
          />
        </div>
      </div>
      <p className="mt-1 text-sm text-[#444444]">Every image uploaded anywhere in the app, in one place — search, preview, reuse, delete.</p>

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-white p-3 shadow-sm">
        <HardDrive className="size-4 text-green-700" />
        <p className="text-sm text-black">
          <strong>{formatBytes(totalBytes)}</strong> across <strong>{assets?.length ?? 0}</strong> files
        </p>
        <div className="ml-auto flex flex-wrap gap-2">
          {Object.entries(perFolder).map(([folder, stat]) => (
            <span key={folder} className="rounded-full bg-[#f3f5f2] px-2.5 py-1 text-xs text-[#444444]">
              {folderLabel(folder)}: {stat.count} ({formatBytes(stat.bytes)})
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by filename..."
            className="h-10 pl-9"
          />
        </div>
        <Select value={folderFilter} onValueChange={(v) => v && setFolderFilter(v as "all" | MediaFolder)}>
          <SelectTrigger className="h-10 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Folders</SelectItem>
            {MEDIA_FOLDERS.map((f) => (
              <SelectItem key={f} value={f}>
                {folderLabel(f)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="h-10 w-10" onClick={refresh} aria-label="Refresh">
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <div className="mt-4">
        {assets === null && <p className="text-sm text-[#444444]">Loading...</p>}
        {assets && filtered.length === 0 && <p className="text-sm text-[#444444]">No files found.</p>}
        {filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {filtered.map((asset) => (
              <div key={asset.id} className="group relative overflow-hidden rounded-xl border border-border bg-white shadow-sm">
                <button type="button" onClick={() => setPreviewAsset(asset)} className="relative block aspect-square w-full bg-gray-50">
                  <Image src={asset.url} alt={asset.fileName} fill className="object-cover" />
                </button>
                <div className="p-2">
                  <p className="truncate text-xs font-medium text-black" title={asset.fileName}>
                    {asset.fileName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{formatBytes(asset.sizeBytes)}</p>
                </div>
                <div className="absolute inset-x-0 top-0 flex justify-end gap-1 bg-gradient-to-b from-black/40 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => replaceInputRef.current && (replaceInputRef.current.dataset.assetId = asset.id) && replaceInputRef.current.click()}
                    aria-label="Replace"
                    disabled={replacingId === asset.id}
                    className="flex size-6 items-center justify-center rounded-full bg-white/95 text-black hover:scale-110"
                  >
                    <RefreshCw className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(asset)}
                    aria-label="Delete"
                    className="flex size-6 items-center justify-center rounded-full bg-white/95 text-red-600 hover:scale-110"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const assetId = replaceInputRef.current?.dataset.assetId
          const asset = assets?.find((a) => a.id === assetId)
          if (asset) handleReplace(asset, e.target.files?.[0])
          e.target.value = ""
        }}
      />

      <Dialog open={!!previewAsset} onOpenChange={(open) => !open && setPreviewAsset(null)}>
        <DialogContent className="max-w-2xl">
          {previewAsset && (
            <>
              <DialogTitle>{previewAsset.fileName}</DialogTitle>
              <div className="relative mt-2 aspect-video w-full overflow-hidden rounded-xl bg-gray-50">
                <Image src={previewAsset.url} alt={previewAsset.fileName} fill className="object-contain" />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {folderLabel(previewAsset.folder)} · {formatBytes(previewAsset.sizeBytes)} ·{" "}
                  {new Date(previewAsset.uploadedAt).toLocaleString()}
                </span>
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(previewAsset.url)}>
                  Copy URL
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
