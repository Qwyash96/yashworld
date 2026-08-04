import { NextResponse, type NextRequest } from "next/server"
import { requireAdminPermission } from "@/lib/admin-api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { writeAuditLog } from "@/lib/audit-log"
import type { Category, CategoryInput } from "@/types/category"

const COLLECTION = "categories"

export async function GET(request: NextRequest) {
  const auth = await requireAdminPermission(request, "product_management")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const snapshot = await getAdminDb().collection(COLLECTION).get()
  const categories = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Category)
  return NextResponse.json({ categories })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminPermission(request, "product_management")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json()) as Partial<CategoryInput>
  if (!body.name?.trim() || !body.slug?.trim()) {
    return NextResponse.json({ error: "Name and slug are required." }, { status: 400 })
  }
  const slug = body.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  if (!slug) return NextResponse.json({ error: "Slug must contain at least one letter or number." }, { status: 400 })

  const db = getAdminDb()
  const existing = await db.collection(COLLECTION).where("slug", "==", slug).limit(1).get()
  if (!existing.empty) return NextResponse.json({ error: `A category with slug "${slug}" already exists.` }, { status: 409 })

  const input: CategoryInput = {
    name: body.name.trim(),
    slug,
    description: body.description?.trim() ?? "",
    image: body.image?.trim() || "/placeholder.svg",
    parentId: body.parentId?.trim() || null,
  }
  const ref = await db.collection(COLLECTION).add(input)

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "category.create",
    targetType: "category",
    targetId: ref.id,
    after: input,
  })

  return NextResponse.json({ category: { id: ref.id, ...input } })
}
