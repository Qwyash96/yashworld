"use client"

import { useState } from "react"
import { Mail, MapPin, Phone, Clock, Send } from "lucide-react"
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

const topics = [
  "General Inquiry",
  "Product Support",
  "Order Related",
  "Business",
  "Wholesale",
]

export default function ContactPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [topic, setTopic] = useState(topics[0])
  const [message, setMessage] = useState("")

  function submit(e: React.FormEvent) {
    e.preventDefault()

    if (!name || !email || !message) {
      toast.error("Please fill all required fields.")
      return
    }

    toast.success("Message Sent Successfully!", {
      description: "We'll contact you as soon as possible.",
    })

    setName("")
    setEmail("")
    setMessage("")
  }

  return (
    <main className="min-h-screen bg-white">

      {/* Hero */}

      <section className="bg-gradient-to-b from-green-50 to-white py-20">

        <div className="mx-auto max-w-7xl px-6">

          <div className="text-center">

            <span className="font-semibold uppercase tracking-[0.3em] text-green-700">
              Contact YashWorld
            </span>

            <h1 className="mt-5 text-5xl font-bold text-gray-900">
              We'd Love To Hear From You
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">
              Have questions about products, orders or anything else?
              Our support team is always ready to help you.
            </p>

          </div>

        </div>

      </section>

      {/* Contact Section */}

     <section className="mx-auto max-w-7xl px-6 py-16">

  <div className="grid gap-8 lg:grid-cols-3">

    {/* Contact Info */}

    <div className="space-y-6">

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

              <Mail className="mb-4 h-8 w-8 text-green-600" />

              <h3 className="text-xl font-bold text-gray-900">
                Email
              </h3>

              <p className="mt-3 text-gray-600">
                support@yashworld.shop
              </p>

            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

              <Phone className="mb-4 h-8 w-8 text-green-600" />

              <h3 className="text-xl font-bold text-gray-900">
                Phone
              </h3>

              <p className="mt-3 text-gray-600">
                +91 7209308900
              </p>

            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

              <MapPin className="mb-4 h-8 w-8 text-green-600" />

              <h3 className="text-xl font-bold text-gray-900">
                Address
              </h3>

              <p className="mt-3 text-gray-600">
                Samastipur
                <br />
                Bihar - 848125
                <br />
                India
              </p>

            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

              <Clock className="mb-4 h-8 w-8 text-green-600" />

              <h3 className="text-xl font-bold text-gray-900">
                Working Hours
              </h3>

              <p className="mt-3 text-gray-600">
                Monday - Saturday
                <br />
                9:00 AM - 7:00 PM
              </p>

            </div>

          </div>

          {/* Contact Form */}

          <div className="lg:col-span-2 rounded-3xl border border-gray-200 bg-white p-8 shadow-lg">

            <h2 className="mb-8 text-3xl font-bold text-gray-900">
              Send us a Message
            </h2>

            <form onSubmit={submit}>

              <div className="grid gap-6 md:grid-cols-2">

                <div>

                  <Label>Name</Label>

                  <Input
                    className="mt-2 h-12"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Name"
                  />

                </div>

                <div>

                  <Label>Email</Label>

                  <Input
                    type="email"
                    className="mt-2 h-12"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                  />

                </div>

              </div>

              <div className="mt-6">

                <Label>Topic</Label>

                <Select
  value={topic}
  onValueChange={(value) => {
    if (value) setTopic(value)
  }}
>

                  <SelectTrigger className="mt-2 h-12">

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
                            <div className="mt-6">

                <Label>Message</Label>

                <textarea
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your message..."
                  className="mt-2 w-full rounded-xl border border-gray-300 p-4 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-200"
                />

              </div>
              <Button
                type="submit"
                className="mt-8 h-12 rounded-xl bg-green-600 px-10 text-white hover:bg-green-700"
              >
                <Send className="mr-2 h-5 w-5" />
                Send Message
              </Button>

            </form>

          </div>

        </div>

      </section>

    </main>
  )
}