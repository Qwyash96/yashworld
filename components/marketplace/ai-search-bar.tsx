"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Mic, Camera, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Category } from "@/lib/products"

// The Web Speech API isn't in TypeScript's default DOM lib — minimal ambient
// shape for just what's used here, feature-detected at runtime (Chrome/Edge
// support it; browsers that don't just show the "unsupported" toast below).
interface SpeechRecognitionResultLike {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  onresult: ((event: SpeechRecognitionResultLike) => void) | null
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/**
 * The homepage's hero search — real text search (unchanged behavior),
 * real voice search (browser-native Web Speech API, no backend/API key
 * needed), and an image-search entry point whose UI is real but whose
 * backend isn't wired up yet (no Vision API integration exists in this app)
 * — clicking it explains exactly that instead of silently doing nothing or
 * faking a result.
 */
export function AiSearchBar({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const [searchCategory, setSearchCategory] = useState("all")
  const [query, setQuery] = useState("")
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setVoiceSupported(!!getSpeechRecognition())
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  function goToSearch(text: string) {
    const params = new URLSearchParams({ q: text })
    if (searchCategory !== "all") params.set("category", searchCategory)
    router.push(`/search?${params.toString()}`)
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    goToSearch(query.trim())
  }

  function handleVoiceSearch() {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      toast.error("Voice search isn't supported in this browser — try Chrome or Edge.")
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = "en-IN"
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => {
      setListening(false)
      toast.error("Couldn't hear that — try again.")
    }
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript
      if (!transcript) return
      setQuery(transcript)
      goToSearch(transcript)
    }
    recognitionRef.current = recognition
    recognition.start()
  }

  function handleImageSelected(file: File | undefined) {
    if (!file) return
    toast.info("Image search isn't connected yet.", {
      description: "Configure a Vision API integration in Admin → Integrations to search by photo.",
    })
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const searchSuggestions = categories.slice(0, 6).map((c) => c.name)

  return (
    <section className="bg-gradient-to-b from-green-50 to-[#f3f5f2] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-green-700">
          <Sparkles className="size-3.5" />
          AI-Powered Search
        </p>
        <h1 className="mt-2 text-center text-3xl font-bold text-black sm:text-4xl">What are you looking for today?</h1>
        <p className="mt-2 text-center text-sm text-[#444444] sm:text-base">
          Search by text or voice — search by photo is coming soon.
        </p>

        <form onSubmit={submitSearch} className="relative mt-8">
          <div className="flex items-stretch overflow-hidden rounded-2xl border border-border bg-white shadow-lg transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <Select value={searchCategory} onValueChange={(v) => setSearchCategory(v ?? "all")}>
              <SelectTrigger className="h-14 w-32 shrink-0 rounded-none border-0 border-r border-border bg-[#f3f5f2] px-3 text-sm font-medium sm:w-52 sm:px-4">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSuggestionsOpen(true)}
              onBlur={() => setTimeout(() => setSuggestionsOpen(false), 150)}
              placeholder={listening ? "Listening..." : "Search for plants, pots, tools and more..."}
              className="h-14 min-w-0 flex-1 border-0 bg-transparent px-3 text-base text-black placeholder:text-[#444444] outline-none sm:px-4"
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageSelected(e.target.files?.[0])}
            />
            <button
              type="button"
              aria-label="Search by image"
              onClick={() => fileInputRef.current?.click()}
              className="flex shrink-0 items-center px-3 text-green-700 transition hover:bg-green-50"
            >
              <Camera className="size-5" />
            </button>

            <button
              type="button"
              aria-label={listening ? "Stop voice search" : "Voice search"}
              onClick={handleVoiceSearch}
              className={`flex shrink-0 items-center px-3 transition hover:bg-green-50 ${
                listening ? "text-red-600" : voiceSupported ? "text-green-700" : "text-gray-400"
              }`}
            >
              <Mic className={`size-5 ${listening ? "animate-pulse" : ""}`} />
            </button>

            <button
              type="submit"
              aria-label="Search"
              className="flex shrink-0 items-center gap-2 bg-green-600 px-5 font-semibold text-white transition hover:bg-green-700 sm:px-8"
            >
              <Search className="size-5" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>

          {suggestionsOpen && searchSuggestions.length > 0 && (
            <div className="absolute z-20 mt-2 w-full rounded-2xl border border-border bg-white p-3 shadow-xl">
              <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-widest text-[#444444]">Popular searches</p>
              <div className="flex flex-wrap gap-2 px-2">
                {searchSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={() => setQuery(s)}
                    className="rounded-full bg-[#f3f5f2] px-3 py-1.5 text-sm text-black transition hover:bg-green-50 hover:text-green-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </section>
  )
}
