---
title: "Huai"
tags: ["software", "elixir"]
description: "Convert any file to clean Markdown"
image: "https://cdn.jam06452.uk/huai.png"
links:
  - label: "Demo"
    icon: "bp"
    url: "https://huai.jam06452.uk"
    variant: "blueprint"

github: "https://github.com/jam06452/Huai"
date: "01-07-2026"

featured: true
---

## About

Huai is a self-hosted document converter that takes almost any file format and outputs clean, readable Markdown. Drop in a PDF, a Word document, a spreadsheet, a PowerPoint, an image, an audio file, a video — it handles all of them and hands back structured Markdown you can actually use.

The motivation is the same one that comes up repeatedly when working with documents programmatically: files arrive in every format imaginable, but the text inside them is what you actually want. Extracting that text cleanly, without the proprietary formatting cruft, is tedious to do yourself for every format. Huai does it in one place.

---

## Supported Formats

Huai handles a wide range of input types:

- **Documents** — PDF, DOCX, PPTX, XLSX
- **Images** — standard formats; content is extracted via OCR or vision model
- **Audio** — transcribed to text, then formatted as Markdown
- **Video** — audio track extracted and transcribed
- **And more** — the converter is not limited to a fixed list

The output in every case is clean Markdown: headings preserved from document structure, tables rendered as Markdown tables, lists as lists, and body text as paragraphs. No HTML soup, no binary garbage — just the content.

---

## How It Works

### Upload & Processing

The frontend is Phoenix LiveView — a drag-and-drop zone that accepts any file type. Once a file is dropped or selected, it's uploaded to the server and handed off to the conversion pipeline.

The backend determines the file type and routes it to the appropriate conversion strategy. For structured documents like DOCX and PPTX, the structure is parsed directly and mapped to Markdown equivalents. For PDFs, text is extracted from the PDF layer where available. For image content (either image files or image-heavy PDFs), a vision model handles text extraction. For audio and video, a transcription model processes the audio track.

### Why Phoenix LiveView

The LiveView architecture is a good fit here for the same reason it works well for any file-processing interface: the connection stays open between the browser and the server while the conversion runs, so progress can be streamed back to the frontend without polling or websocket management code on the client side. When the conversion finishes, the result appears in the same page without a reload.

### Infrastructure

Huai runs as a Docker container on an Oracle Cloud ARM64 VM behind a Cloudflare Tunnel, the same deployment pattern used across the other projects. The two-stage Dockerfile compiles the Elixir release in a builder image and copies the binary into a minimal runner, keeping the production image small with no compiler toolchain included. GitHub Actions handles CI and image publishing.

---

## Tech Stack

- **Backend** — Elixir, Phoenix LiveView
- **Frontend** — Phoenix LiveView, Tailwind CSS
- **Infrastructure** — Oracle Cloud ARM64 VM, Docker, Cloudflare Tunnel, GitHub Actions
