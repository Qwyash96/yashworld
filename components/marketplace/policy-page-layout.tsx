import type { ReactNode } from "react"

export function PolicyPageLayout({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-black sm:text-3xl">{title}</h1>
        <p className="mt-1 text-xs text-[#888888]">Last updated: {updated}</p>
        <div className="prose-policy mt-6 flex flex-col gap-5 text-sm leading-relaxed text-[#333333]">
          {children}
        </div>
      </div>
    </main>
  )
}

export function PolicySection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-black">{heading}</h2>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </section>
  )
}
