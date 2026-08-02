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
import type { Product, ProductInput } from "@/types/product"

const COLLECTION = "products"

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const snapshot = await getDoc(doc(db, COLLECTION, id))
    if (!snapshot.exists()) return null
    return { id: snapshot.id, ...snapshot.data() } as Product
  } catch (error) {
    throw toServiceError(`Failed to fetch product "${id}"`, error)
  }
}

export async function getAllProducts(): Promise<Product[]> {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION))
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Product)
  } catch (error) {
    throw toServiceError("Failed to fetch products", error)
  }
}

export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  try {
    const q = query(collection(db, COLLECTION), where("categoryId", "==", categoryId))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Product)
  } catch (error) {
    throw toServiceError(`Failed to fetch products for category "${categoryId}"`, error)
  }
}

export async function getProductsBySeller(sellerId: string): Promise<Product[]> {
  try {
    const q = query(collection(db, COLLECTION), where("sellerId", "==", sellerId))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Product)
  } catch (error) {
    throw toServiceError(`Failed to fetch products for seller "${sellerId}"`, error)
  }
}

export async function createProduct(input: ProductInput): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...input,
      ratingAvg: 0,
      ratingCount: 0,
      createdAt: new Date().toISOString(),
    })
    return docRef.id
  } catch (error) {
    throw toServiceError("Failed to create product", error)
  }
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION, id), { ...input })
  } catch (error) {
    throw toServiceError(`Failed to update product "${id}"`, error)
  }
}

export async function deleteProduct(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTION, id))
  } catch (error) {
    throw toServiceError(`Failed to delete product "${id}"`, error)
  }
}
