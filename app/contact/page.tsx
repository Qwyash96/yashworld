"use client"

import { useState } from "react"
import { Mail, MapPin, Phone } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const topics = ["General inquiry", "Order support", "Returns & exchanges", "Press", "Wholesale"]

export default function ContactPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [topic, setTopic] = useState(topics[0])
  const [message, setMessage] = useState("")

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !message.trim()) return
    toast.success("Message sent", { description: "We'll get back to you within 1-2 business days." })
    setName("")
    setEmail("")
    setMessage("")
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-10 max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
          We&apos;re here to help
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
          Contact Us
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Questions about sizing, orders, or anything else? Reach out and our team will get
          back to you shortly.
        </p>
      </header>

      <div className="grid gap-12 lg:grid-cols-3">
        {/* Info */}
        <div className="space-y-6 lg:col-span-1">
          <ContactRow
            icon={<Mail className="size-5" />}
            title="Email"
            lines={["support@yashworld.com", "press@yashworld.com"]}
          />
          <ContactRow
            icon={<Phone className="size-5" />}
            title="Phone"
            lines={["+1 (212) 555-0142", "Mon–Fri, 9am–6pm ET"]}
          />
          <ContactRow
            icon={<MapPin className="size-5" />}
            title="Flagship Store"
            lines={["221B Monochrome Lane", "New York, NY 10001"]}
          />
        </div>

        {/* Form */}
        <form
          onSubmit={submit}
          className="rounded-md border border-border p-6 sm:p-8 lg:col-span-2"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11"
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label>Topic</Label>
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {topics.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message"
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can we help?"
              rows={5}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>

          <Button type="submit" size="lg" className="mt-6 h-11 px-8">
            Send Message
          </Button>
        </form>
      </div>
    </div>
  )
}

function ContactRow({
  icon,
  title,
  lines,
}: {
  icon: React.ReactNode
  title: string
  lines: string[]
}) {
  return (
    <div className="flex gap-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border">
        {icon}
      </div>
      <div>
        <h3 className="font-medium">{title}</h3>
        {lines.map((line) => (
          <p key={line} className="text-sm text-muted-foreground">
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}
