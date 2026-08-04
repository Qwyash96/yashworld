"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Mic, Camera } from "lucide-react"
import { toast } from "sonner"

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
 * The compact header's search bar — real text search, real voice search
 * (browser-native Web Speech API, no backend/API key needed), and an
 * image-search entry point whose UI is real but explains it needs a Vision
 * API integration when used (none is configured in this app). No category
 * selector here (kept for the horizontal category pill bar instead) — this
 * has to stay small enough to sit in a ~64px header on mobile.
 */
export function HeaderSearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  function goToSearch(text: string) {
    router.push(`/search?q=${encodeURIComponent(text)}`)
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

  return (
    <form onSubmit={submitSearch} className="w-full min-w-0">
      <div className="flex h-9 items-center gap-1 rounded-full border border-border bg-[#f3f5f2] pl-3.5 pr-1 transition focus-within:border-green-600 focus-within:bg-white sm:h-10">
        <Search className="size-4 shrink-0 text-[#888888]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={listening ? "Listening..." : "Search plants, pots, tools..."}
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm text-black outline-none placeholder:text-[#888888]"
        />
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageSelected(e.target.files?.[0])} />
        <button
          type="button"
          aria-label="Search by image"
          onClick={() => fileInputRef.current?.click()}
          className="hidden shrink-0 rounded-full p-1.5 text-[#888888] transition hover:bg-white hover:text-green-700 sm:block"
        >
          <Camera className="size-4" />
        </button>
        <button
          type="button"
          aria-label={listening ? "Stop voice search" : "Voice search"}
          onClick={handleVoiceSearch}
          className={`shrink-0 rounded-full p-1.5 transition hover:bg-white ${listening ? "text-red-600" : "text-[#888888] hover:text-green-700"}`}
        >
          <Mic className={`size-4 ${listening ? "animate-pulse" : ""}`} />
        </button>
      </div>
    </form>
  )
}
