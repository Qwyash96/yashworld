export function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-sm">
      <div className="h-56 shrink-0 animate-pulse bg-gray-200" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-2/5 animate-pulse rounded bg-gray-200" />
        <div className="h-5 w-1/3 animate-pulse rounded bg-gray-200" />
        <div className="mt-auto flex gap-2 pt-2">
          <div className="h-10 flex-1 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-10 flex-1 animate-pulse rounded-xl bg-gray-200" />
        </div>
      </div>
    </div>
  )
}
