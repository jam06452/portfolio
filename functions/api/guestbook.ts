interface Env {
  DB: D1Database
}

type GuestbookEntry = {
  id: string
  name: string
  message: string
  created_at: string
}

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
}

const NAME_MAX_LENGTH = 60
const MESSAGE_MAX_LENGTH = 1000
const GUESTBOOK_LIMIT = 50

const uuidv7 = (): string => {
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
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  })
}

const parseInput = async (request: Request) => {
  const payload = (await request.json().catch(() => null)) as {
    name?: unknown
    message?: unknown
  } | null

  if (!payload) {
    return null
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : ""
  const message = typeof payload.message === "string" ? payload.message.trim() : ""

  if (!name || !message) {
    return null
  }

  if (name.length > NAME_MAX_LENGTH || message.length > MESSAGE_MAX_LENGTH) {
    return null
  }

  return { name, message }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const entries = await context.env.DB.prepare(
    `SELECT id, name, message, created_at
     FROM guestbook_entries
     ORDER BY id DESC
     LIMIT ?`
  )
    .bind(GUESTBOOK_LIMIT)
    .all<GuestbookEntry>()

  return json({ entries: entries.results ?? [] })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const input = await parseInput(context.request)

  if (!input) {
    return json(
      { error: "Please provide a name and message within the allowed length limits." },
      400
    )
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

  return json({ entry: createdEntry }, 201)
}