import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { toServiceError } from "@/services/firebase/errors"
import type { Category, CategoryInput } from "@/types/category"

const COLLECTION = "categories"

export async function getCategoryById(id: string): Promise<Category | null> {
  try {
    const snapshot = await getDoc(doc(db, COLLECTION, id))
    if (!snapshot.exists()) return null
    return { id: snapshot.id, ...snapshot.data() } as Category
  } catch (error) {
    throw toServiceError(`Failed to fetch category "${id}"`, error)
  }
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  try {
    const q = query(collection(db, COLLECTION), where("slug", "==", slug))
    const snapshot = await getDocs(q)
    if (snapshot.empty) return null
    const found = snapshot.docs[0]
    return { id: found.id, ...found.data() } as Category
  } catch (error) {
    throw toServiceError(`Failed to fetch category "${slug}"`, error)
  }
}

export async function getAllCategories(): Promise<Category[]> {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION))
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Category)
  } catch (error) {
    throw toServiceError("Failed to fetch categories", error)
  }
}

export async function getSubcategories(parentId: string): Promise<Category[]> {
  try {
    const q = query(collection(db, COLLECTION), where("parentId", "==", parentId))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Category)
  } catch (error) {
    throw toServiceError(`Failed to fetch subcategories for "${parentId}"`, error)
  }
}

export async function createCategory(input: CategoryInput): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION), input)
    return docRef.id
  } catch (error) {
    throw toServiceError("Failed to create category", error)
  }
}

export async function updateCategory(id: string, input: Partial<CategoryInput>): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION, id), { ...input })
  } catch (error) {
    throw toServiceError(`Failed to update category "${id}"`, error)
  }
}

export async function deleteCategory(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTION, id))
  } catch (error) {
    throw toServiceError(`Failed to delete category "${id}"`, error)
  }
}
