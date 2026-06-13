---
title: "URL Shortener"
tags: ["software", "elixir"]
description: "A blazingly fast way to shorten URLs"
image: "https://cdn.jam06452.uk/url.png"
links:
  - label: "Demo"
    icon: "bp"
    url: "https://url.jam06452.uk"
    variant: "blueprint"

github: "https://github.com/jam06452/URL_Shortener"
date: "01-07-2026"

featured: true
---

## About

I built this as a personal URL shortener — something I actually wanted to use rather than rely on third-party services. What started as a weekend Python script turned into a full rewrite in Elixir, a proper frontend, a Docker-based deployment pipeline, and a production system running on my own hardware.

The short version: you paste a URL in, you get a short code back. Click the code, you get redirected. Simple concept, surprisingly interesting to build properly.

## The Journey

### Starting with Python

The first version was a [FastAPI](https://fastapi.tiangolo.com/) application backed by a flat JSON file. Hashing used `zlib.crc32` converted to a Base36 string (0–9, a–z) to produce short alphanumeric codes. It worked on localhost, and that was enough to prove the concept.

From there the JSON file was swapped out for [Supabase](https://supabase.com/), making the API stateless and ready for deployment. The app was containerised with Docker — with a pip mount cache during the build stage (`--mount=type=cache,target=/root/.cache/pip`) to avoid re-downloading dependencies on every change.

### Moving to Elixir

After the Python version was working end-to-end, I migrated the backend to **Elixir** using the **Phoenix** framework. The reason was straightforward: the BEAM VM is purpose-built for lots of small, independent, concurrent requests — which is exactly what URL redirects are. Python gets the job done, but Elixir's pattern matching on results (`{:ok, result}` vs `{:error, reason}`) makes error handling more robust by construction.

I initially used **Ecto** for database access, but since all persistence goes through Supabase's REST API anyway, it was unnecessary overhead. I stripped it out in favour of the `supabase-potion` library and direct PostgREST calls, which simplified the codebase considerably.

### Caching

Database calls to Supabase added ~50ms of latency per redirect — fine for encoding, unacceptable for redirects that should feel instant. I integrated **[Cachex](https://github.com/whitfin/cachex)** with a prewarm strategy:

1. On lookup, check Cachex first.
2. Cache hit → return immediately.
3. Cache miss → query Supabase, populate the cache, return the result.

I also noticed that requests were routing to Supabase via Cloudflare rather than the local machine address — switching to the internal address, combined with Cachex, dropped redirect latency from ~5ms to around **150 microseconds**.

Click tracking is handled by a Postgres stored procedure (`click_counter`) called via RPC, which atomically increments the count and avoids any read-modify-write race conditions. Writes are done asynchronously so they don't sit in the hot path of the redirect.

### Frontend

The UI went through a few iterations — plain HTML form, then JavaScript with a `fetch` call, then a proper redesign. The current style is intentionally harsh:

- Pure black background (`#000000`)
- Neon cyan, magenta, and yellow accents
- Hard edges, no border radius
- Offset solid-colour drop shadows
- Monospace fonts throughout

Shortened links copy to clipboard on click via `navigator.clipboard.writeText()`, with brief "Copied!" feedback. A `config.js` file externalises the API base URL so switching between local and production doesn't require hunting through source files.

URL validation runs before submission: a `HEAD` request (with a 5-second timeout) pings the target. If it's unreachable, the user is asked whether they want to store it as a plain text message instead — useful for internal/LAN URLs. Messages are tagged with `~` in the database and handled differently on retrieval.

### Deployment

The backend and frontend are consolidated into a single Phoenix application (`exapi/`) and deployed on a free Oracle Cloud VM. GitHub Actions handles continuous deployment on push to `main`.

The Docker image for Elixir uses a two-stage build: compile the release inside a builder image, copy the binary into a minimal runner image. The result is a small production container with no compiler toolchain included. A separate GitHub Actions workflow uses `docker buildx` to build simultaneously for `linux/amd64` and `linux/arm64`, pushing a multi-arch manifest to the GitHub Container Registry — so it runs on both x86 servers and the ARM-based Oracle instance without any manual targeting.

Cloudflare sits in front of the frontend. Since the site behaves as a single-page app, a Cloudflare Function (`functions/[[path]].js`) intercepts requests. The key detail: `fetch` inside a Cloudflare Worker follows redirects transparently by default, which would silently consume the 302 before the browser ever saw it. Setting `redirect: "manual"` lets the worker capture and forward the 302 to the client so the actual redirect happens in the user's browser.

## Performance

| Operation | Latency |
|---|---|
| URL encoding (new) | ~15ms |
| Redirect (cache hit) | ~150µs |

## Tech Stack

- **Backend** — Elixir, Phoenix
- **Database** — Supabase (Postgres)
- **Caching** — Cachex
- **Infrastructure** — Oracle Cloud VM, Cloudflare
- **CI/CD** — GitHub Actions
