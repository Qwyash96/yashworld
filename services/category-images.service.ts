import { collection, getDocs } from "firebase/firestore"
import { db } from "@/services/firebase/client"
import { toServiceError } from "@/services/firebase/errors"

const COLLECTION = "categoryImages"

/** slug → imageUrl for every category with an admin-uploaded homepage card
 * image (Admin → Marketing → Category Images). Never throws — an empty
 * result just means every card keeps its current `image` field (or the
 * gradient/icon fallback), same as any other empty-catalog case. */
export async function getCategoryImageOverrides(): Promise<Record<string, string>> {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION))
    const overrides: Record<string, string> = {}
    snapshot.docs.forEach((d) => {
      const imageUrl = (d.data() as { imageUrl?: string }).imageUrl
      if (imageUrl) overrides[d.id] = imageUrl
    })
    return overrides
  } catch (error) {
    console.error(toServiceError("Failed to fetch category image overrides", error).message)
    return {}
  }
}
