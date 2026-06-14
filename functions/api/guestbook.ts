interface Env {
  DB: D1Database
  AI_HACKCLUB_API_KEY: string
}

type GuestbookEntry = {
  id: string
  name: string
  message: string
  created_at: string
}

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
}

const NAME_MAX_LENGTH = 60
const MESSAGE_MAX_LENGTH = 1000
const GUESTBOOK_LIMIT = 50
const AI_MODERATION_URL = "https://ai.hackclub.com/proxy/v1/chat/completions"
const AI_MODERATION_MODEL = "qwen/qwen3-32b"
const AI_MODERATION_SYSTEM_PROMPT =
  "You need to decide whether the content is appropiate for a portfolio guestbook. No swearing, no hate speech etc. Reply in one word responses. True for appropiate, False for not."

const uuidv7 = (): string => {
  console.log("[guestbook] uuidv7:start")
  const now = Date.now()
  const timeHigh = Math.floor(now / 0x100000000)
  const timeLow = now & 0xffffffff
  const rand = crypto.getRandomValues(new Uint8Array(10))
  rand[0] = (rand[0] & 0x0f) | 0x70
  rand[2] = (rand[2] & 0x3f) | 0x80
  const t = timeHigh.toString(16).padStart(8, "0") + timeLow.toString(16).padStart(8, "0")
  const r = Array.from(rand).map(b => b.toString(16).padStart(2, "0")).join("")
  return `${t.slice(0, 8)}-${t.slice(8, 12)}-${t.slice(12, 16)}-${r.slice(0, 4)}-${r.slice(4)}`
}

const json = (body: unknown, status = 200) => {
  console.log("[guestbook] json:response", { status })
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  })
}

const parseInput = async (request: Request) => {
  console.log("[guestbook] parseInput:start")
  const payload = (await request.json().catch(() => null)) as {
    name?: unknown
    message?: unknown
  } | null

  if (!payload) {
    console.log("[guestbook] parseInput:invalid-payload")
    return null
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : ""
  const message = typeof payload.message === "string" ? payload.message.trim() : ""

  if (!name || !message) {
    console.log("[guestbook] parseInput:missing-fields")
    return null
  }

  if (name.length > NAME_MAX_LENGTH || message.length > MESSAGE_MAX_LENGTH) {
    console.log("[guestbook] parseInput:exceeds-limits", {
      nameLength: name.length,
      messageLength: message.length,
    })
    return null
  }

  console.log("[guestbook] parseInput:valid", {
    nameLength: name.length,
    messageLength: message.length,
  })
  return { name, message }
}

const moderateGuestbookEntry = async (env: Env, name: string, message: string) => {
  console.log("[guestbook] moderateGuestbookEntry:start")

  if (!env.AI_HACKCLUB_API_KEY) {
    console.log("[guestbook] moderateGuestbookEntry:missing-api-key")
    throw new Error("Guestbook moderation is not configured.")
  }

  const response = await fetch(AI_MODERATION_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.AI_HACKCLUB_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODERATION_MODEL,
      messages: [
        {
          role: "system",
          content: AI_MODERATION_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `From: ${name}, Content: ${message}`,
        },
      ],
      temperature: 0,
      max_tokens: 4,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    console.log("[guestbook] moderateGuestbookEntry:request-failed", {
      status: response.status,
      errorText,
    })
    throw new Error("Unable to verify guestbook entry right now.")
  }

  const payload = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>
  } | null

  const verdict = payload?.choices?.[0]?.message?.content?.trim().toLowerCase()
  console.log("[guestbook] moderateGuestbookEntry:verdict", { verdict })

  if (verdict !== "true" && verdict !== "false") {
    throw new Error("Unable to verify guestbook entry right now.")
  }

  return verdict === "true"
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    if (!context.env.DB) {
        return json({ error: "DB binding not found" }, 500)
  }
  console.log("[guestbook] onRequestGet:start")
  const entries = await context.env.DB.prepare(
    `SELECT id, name, message, created_at
     FROM guestbook_entries
     ORDER BY created_at DESC, id DESC
     LIMIT ?`
  )
    .bind(GUESTBOOK_LIMIT)
    .all<GuestbookEntry>()

  console.log("[guestbook] onRequestGet:success", {
    count: entries.results?.length ?? 0,
  })
  return json({ entries: entries.results ?? [] })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  console.log("[guestbook] onRequestPost:start")

  try {
    if (!context.env.DB) {
      return json({ error: "DB binding not found" }, 500)
    }

    if (!context.env.AI_HACKCLUB_API_KEY) {
      return json({ error: "Guestbook moderation is not configured." }, 500)
    }

    const input = await parseInput(context.request)

    if (!input) {
      console.log("[guestbook] onRequestPost:invalid-input")
      return json(
        { error: "Please provide a name and message within the allowed length limits." },
        400
      )
    }

    const isAppropriate = await moderateGuestbookEntry(context.env, input.name, input.message)

    if (!isAppropriate) {
      console.log("[guestbook] onRequestPost:rejected-by-moderation")
      return json({ error: "Please keep guestbook posts kind and appropriate." }, 400)
    }

    const id = uuidv7()

    await context.env.DB.prepare(
      `INSERT INTO guestbook_entries (id, name, message, created_at)
       VALUES (?, ?, ?, datetime('now'))`
    )
      .bind(id, input.name, input.message)
      .run()

    const createdEntry = await context.env.DB.prepare(
      `SELECT id, name, message, created_at
       FROM guestbook_entries
       WHERE id = ?`
    )
      .bind(id)
      .first<GuestbookEntry>()

    console.log("[guestbook] onRequestPost:created", { id })
    return json({ entry: createdEntry }, 201)
  } catch (error) {
    console.error("[guestbook] onRequestPost:exception", {
      error: error instanceof Error ? error.message : "Unknown error",
    })
    return json({ error: "Unable to verify guestbook entry right now." }, 500)
  }
}