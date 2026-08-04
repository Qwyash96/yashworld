import "server-only"
import type { IntegrationAdapter, VerifyResult } from "@/lib/integrations/types"

/** Reads SMTP response lines until one whose 4th character isn't "-" (the multi-line continuation marker). */
function readResponse(socket: import("net").Socket, timeoutMs = 8000): Promise<{ code: number; text: string }> {
  return new Promise((resolve, reject) => {
    let buffer = ""
    const timer = setTimeout(() => {
      socket.removeListener("data", onData)
      reject(new Error("SMTP server timed out."))
    }, timeoutMs)

    function onData(chunk: Buffer) {
      buffer += chunk.toString("utf8")
      const lines = buffer.split("\r\n").filter(Boolean)
      const last = lines[lines.length - 1]
      if (last && /^\d{3} /.test(last)) {
        clearTimeout(timer)
        socket.removeListener("data", onData)
        resolve({ code: Number(last.slice(0, 3)), text: buffer })
      }
    }
    socket.on("data", onData)
  })
}

async function smtpHandshake(host: string, port: number, username: string, password: string): Promise<VerifyResult> {
  const net = await import("net")
  const tls = await import("tls")

  const useImplicitTls = port === 465
  const socket: import("net").Socket = useImplicitTls
    ? tls.connect({ host, port, timeout: 8000 })
    : net.connect({ host, port, timeout: 8000 })

  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve())
      socket.once("secureConnect", () => resolve())
      socket.once("error", reject)
      socket.once("timeout", () => reject(new Error("Connection timed out.")))
    })

    const greeting = await readResponse(socket)
    if (greeting.code !== 220) return { ok: false, message: `Unexpected SMTP greeting (${greeting.code}).`, health: "down" }

    socket.write("EHLO integration-check\r\n")
    const ehlo = await readResponse(socket)
    if (ehlo.code !== 250) return { ok: false, message: `EHLO failed (${ehlo.code}).`, health: "down" }

    socket.write("AUTH LOGIN\r\n")
    const authStart = await readResponse(socket)
    if (authStart.code !== 334) return { ok: false, message: "Server doesn't support AUTH LOGIN.", health: "degraded" }

    socket.write(Buffer.from(username).toString("base64") + "\r\n")
    const userStep = await readResponse(socket)
    if (userStep.code !== 334) return { ok: false, message: "SMTP server rejected the username.", health: "down" }

    socket.write(Buffer.from(password).toString("base64") + "\r\n")
    const authResult = await readResponse(socket)
    if (authResult.code !== 235) return { ok: false, message: "SMTP authentication failed.", health: "down" }

    return { ok: true, message: "SMTP EHLO + AUTH LOGIN succeeded.", health: "healthy" }
  } finally {
    socket.end()
  }
}

export const smtpAdapter: IntegrationAdapter = {
  id: "smtp",
  name: "SMTP",
  category: "email",
  description: "Bring-your-own SMTP relay for transactional email.",
  credentialFields: [
    { key: "host", label: "SMTP Host", type: "text", required: true, placeholder: "smtp.yourprovider.com" },
    { key: "port", label: "Port", type: "text", required: true, placeholder: "587" },
    { key: "username", label: "Username", type: "text", required: true },
    { key: "password", label: "Password", type: "password", required: true },
    { key: "fromAddress", label: "From Address", type: "text", required: false, placeholder: "orders@yourdomain.com" },
  ],
  settingFields: [],
  supportsWebhook: false,
  supportsTest: true,

  async verifyConnection(credentials) {
    const { host, port, username, password } = credentials
    if (!host || !port || !username || !password) {
      return { ok: false, message: "Host, Port, Username and Password are all required.", health: "unknown" }
    }
    const portNumber = Number(port)
    if (!Number.isInteger(portNumber) || portNumber <= 0) {
      return { ok: false, message: "Port must be a positive integer.", health: "unknown" }
    }
    try {
      return await smtpHandshake(host, portNumber, username, password)
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Failed to reach the SMTP server.", health: "down" }
    }
  },

  async testAction(credentials, environment) {
    const result = await this.verifyConnection(credentials, environment)
    return { ok: result.ok, message: result.message }
  },
}
