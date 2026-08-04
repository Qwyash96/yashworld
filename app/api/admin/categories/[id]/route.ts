import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { writeAuditLog } from "@/lib/audit-log"
import type { CategoryInput } from "@/types/category"

const COLLECTION = "categories"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminPermission(request, "product_management")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const db = getAdminDb()
  const ref = db.collection(COLLECTION).doc(id)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ error: "Category not found." }, { status: 404 })

  const body = (await request.json()) as Partial<CategoryInput>
  const patch: Partial<CategoryInput> = {}
  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 })
    patch.name = body.name.trim()
  }
  if (body.description !== undefined) patch.description = body.description.trim()
  if (body.image !== undefined) patch.image = body.image.trim() || "/placeholder.svg"
  if (body.parentId !== undefined) patch.parentId = body.parentId?.trim() || null

  await ref.update(patch)

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "category.update",
    targetType: "category",
    targetId: id,
    after: patch,
  })

  const updated = await ref.get()
  return NextResponse.json({ category: { id: updated.id, ...updated.data() } })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminPermission(request, "product_management")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const db = getAdminDb()
  const ref = db.collection(COLLECTION).doc(id)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ error: "Category not found." }, { status: 404 })

  // Products reference a category by its SLUG (see
  // components/seller/product-form.tsx's category <Select>), not the
  // Firestore document id — check against that, not `id`.
  const slug = (snap.data() as { slug?: string }).slug
  if (slug) {
    const inUse = await db.collection("products").where("categoryId", "==", slug).limit(1).get()
    if (!inUse.empty) {
      return NextResponse.json({ error: "This category has products in it — reassign or remove them first." }, { status: 409 })
    }
  }

  await ref.delete()

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "category.delete",
    targetType: "category",
    targetId: id,
  })

  return NextResponse.json({ ok: true })
}
