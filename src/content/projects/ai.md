---
title: "Sifter"
tags: ["software", "elixir", "ai"]
description: "A self-hosted alternative to GPTZero and Quillbot for detecting AI-generated text"
links:
  - label: "Demo"
    icon: "bp"
    url: "https://ai.jam06452.uk"
    variant: "blueprint"

github: "https://github.com/jam06452/ai-detection"
date: "01-07-2026"

featured: true
---

## About

GPTZero charges a subscription. Quillbot charges a subscription. Both are running the same basic idea: take some text, run it through a classifier, return a probability that it was written by a language model. Sifter does the same thing, runs on my own hardware, costs nothing per query, and sends your text nowhere.

The accuracy is comparable to the paid tools — not because I have their engineering budget, but because the underlying problem is fundamentally the same regardless of who's solving it. All of these tools will produce false positives and false negatives. The difference is that Sifter is self-hostable, open source, and done in about seven hours.

---

## How It Works

### The Core Pipeline

Text comes in through a form on the frontend. The backend — a Phoenix application written in Elixir — takes that text and breaks it into chunks. Each chunk is sent in parallel through an AI classification model, which returns a decimal value between 0 and 1 representing the probability that the chunk was AI-generated. The backend aggregates these into an overall score and returns both the per-chunk results and the total to the frontend.

The frontend then uses those per-chunk scores to highlight the original text. The highlight intensity scales dynamically with the score — a chunk with a 100% AI probability gets 50% highlight opacity, a chunk at 50% gets 25%, and so on. The gradient makes it easy to see at a glance which parts of a document are flagging versus which parts look human-written, rather than just getting a single number that tells you nothing about where the AI-written content actually is.

### Why Chunks?

Running the entire text through a classifier as a single input loses spatial information — you can tell that something in the text is AI-generated, but not where. Chunking preserves that, and it also means the model is working on shorter, more manageable inputs rather than arbitrarily long documents.

The chunk-level results also improve the overall score's reliability. A document that's half human and half AI-written will return a more honest aggregate than one where the classifier tries to make sense of the whole thing at once.

### Parallelism

The chunks are processed in parallel using Elixir's concurrency primitives. This was actually one of the more impactful optimisations, especially on ARM hardware (the Oracle Cloud VM runs on ARM64). ARM chips tend to have lower single-core clock speeds but many more cores than their x86 equivalents — sequential chunk processing barely used the available hardware, while parallel processing scales naturally with core count. The latency improvement was significant: down from a couple of seconds to around one.

### Model Selection

Finding a model that actually worked accurately was harder than expected. Most publicly available AI text classification models perform poorly in practice — they were either trained on narrow datasets, overfit to specific LLMs, or just not reliable enough to be useful. The first model tested produced inaccurate results and had to be replaced with a dedicated classification model that performs substantially better. The model handles prose well; it doesn't currently handle code.

---

## The Build

### Proof of Concept

The first working version was a Python script that could take text and return a classification. Once that was confirmed to be producing sensible results with a model that was actually accurate, the decision was made to migrate the inference logic into an Elixir/Phoenix backend. The reasoning was the same as across the other projects — parallel processing in Elixir is ergonomic and fast, and the BEAM VM handles concurrent inference requests without the overhead of a Python web server.

The initial frontend was AI-generated — a basic input box and a result display, good enough to prove the concept worked end-to-end but not something to ship publicly.

### Frontend Redesign

The vibe-coded frontend was replaced with a hand-built one during the longest single session of the project (just under three hours). The redesign introduced:

- Dark mode, with a bug worth noting: switching back from dark mode was only clearing `localStorage` without removing the `data-theme` attribute from the DOM, so the theme persisted visually even after the user toggled it. Fixed once the actual cause was tracked down.
- The dynamic text highlighting, which required cross-referencing the chunk results against their position in the original text and applying opacity-scaled highlights correctly.
- General visual polish to make it feel like something worth using rather than a proof of concept.

### Containerisation & CI/CD

The app runs as a Docker container. The Dockerfile uses a two-stage build — compile the Elixir release in a builder image, copy the binary into a minimal runner — and includes a pip-style mount cache for the mix dependency download step so rebuilds don't re-fetch packages unnecessarily. There's also a model cache baked into the container setup so that restarting the container doesn't require re-downloading the classification model over the network every time.

A `docker-compose.yml` is included for local development and self-hosting. A GitHub Actions workflow handles building and publishing the OCI image, with caching in the workflow itself to speed up CI builds. The image is published as `:latest-arm` targeting the ARM64 Oracle VM.

Cloudflare Tunnel proxies the container to a public URL without needing to open any inbound ports on the VM — the tunnel handles the connection, and a CNAME record points the subdomain at it.

---

## Accuracy & Honesty

AI text detection is a genuinely hard problem, and no tool solves it completely. LLMs are trained to produce fluent, natural-sounding text — by design, that overlaps with how humans write. Any classifier operating on surface-level text features is working against that.

Sifter is honest about this. False positives happen. False negatives happen. The paid tools are in the same position. The advantage of Sifter isn't that it's more accurate — it's that it's self-hostable, runs entirely locally, and doesn't send your text to a third-party server. For anyone who cares about that (educators handling student submissions, internal document review, anyone working with sensitive text), that matters.

The current version doesn't handle code. Code has different statistical properties from prose and would require either a separate model or fine-tuning on code-specific data to be reliable.

---

## Self-Hosting

Pull the image or clone the repo. The only required configuration is a `SECRET_KEY_BASE` environment variable for Phoenix session signing — the provided `docker-compose.yml` includes a pre-generated one to get started quickly.

```bash
docker compose up
```

That's it. The model downloads on first run and caches locally from there.

---

## Tech Stack

- **Backend** — Elixir, Phoenix
- **Frontend** — HTML, CSS, JavaScript (Tailwind)
- **Model** — HuggingFace classification model (self-hosted, runs in-process)
- **Infrastructure** — Oracle Cloud ARM64 VM, Docker, Cloudflare Tunnel, GitHub Actions
