---
title: "Amur"
tags: ["software", "elixir", "open-source"]
description: "A simple OAuth library for Elixir Plug applications"
links:
  - label: "Hex.pm"
    icon: "bp"
    url: "https://hex.pm/packages/amur"
    variant: "blueprint"

github: "https://github.com/jam06452/amur"
date: "01-07-2026"

featured: false
---

## About

Amur is an Elixir library that adds OAuth to any [Plug](https://github.com/elixir-plug/plug)-based application in about ten lines of configuration. It handles the full callback flow and normalises user data across providers, so you get consistent results regardless of which OAuth provider the user authenticated with.

It doesn't require Phoenix. If your app uses Plug, it works.

---

## Why I Built This

Adding OAuth to an Elixir app involves a lot of the same boilerplate every time: set up a callback route, exchange the code for a token, fetch the user profile, normalise the fields across providers because GitHub calls it `login` and Google calls it `email`, handle failures, store something in the session. Every project that needs login needs all of this.

By the time I'd implemented it a second time I decided to pull it into a standalone library so I wouldn't have to do it a third time. Amur is the result of that.

---

## How It Works

### Configuration

You configure Amur once in your application config:

```elixir
config :amur,
  base_url: "http://localhost:4000",
  providers: [
    github: [
      client_id: System.fetch_env!("GITHUB_CLIENT_ID"),
      client_secret: System.fetch_env!("GITHUB_CLIENT_SECRET")
    ]
  ],
  on_success: &MyApp.AuthController.on_success/3,
  on_failure: &MyApp.AuthController.on_failure/2
```

Providers are a keyword list, so adding a second provider is a matter of appending another entry. Credentials are pulled from environment variables via `System.fetch_env!/1`, which raises at boot if a required variable is missing — better to fail loudly at startup than silently at runtime when a user tries to log in.

### Mounting the Router

Amur ships with its own `Amur.Router` that you forward to from your application router:

```elixir
scope "/auth" do
  pipe_through :browser
  forward "/", Amur.Router
end
```

This mounts three endpoints under whatever path you choose:

- `GET /auth/:provider` — kicks off the OAuth flow, redirecting the user to the provider's authorisation page
- `GET /auth/:provider/callback` — handles the redirect back from the provider, exchanges the code for a token, fetches the user profile, and calls your success or failure handler
- `GET /auth/logout` — clears Amur's stored session parameters

The `:provider` segment is dynamic, so adding support for a new provider in config automatically gives you a working route for it without touching the router.

One Phoenix-specific note: if you use `forward` inside a named scope, Phoenix rewrites the module path to `YourAppWeb.Amur.Router`, which doesn't exist. The fix is `alias: false` on the scope. Took me longer to figure out than it should have.

### Handling Results

You supply two callback functions in config — one for success, one for failure. These are plain functions that receive a `conn` and either the normalised user map or the failure reason:

```elixir
def on_success(conn, provider, user) do
  conn
  |> put_flash(:info, "Logged in as #{user.email}")
  |> redirect(to: "/")
end

def on_failure(conn, reason) do
  conn
  |> put_flash(:error, "Authentication failed")
  |> redirect(to: "/login")
end
```

The `user` map is normalised across providers — you get consistent field names regardless of which provider was used. The `provider` atom tells you which one authenticated the user if you need to handle them differently.

---

## Design Decisions

**Plug-only, no Phoenix dependency.** Phoenix is built on Plug, so Amur works with Phoenix apps — but requiring Phoenix in the library would lock out anyone using Plug directly, which is a common pattern for lightweight APIs and internal tools. Keeping the dependency minimal keeps the library more useful.

**Callbacks as function references.** Rather than defining a behaviour that consumers implement, Amur takes success and failure handlers as plain function references in config. This means less boilerplate on the consumer side — no need to define a module that implements a specific behaviour, just point at any two functions with the right arity.

**Provider normalisation.** Different OAuth providers return user data in different shapes. GitHub returns a `login`, Google returns an `email` and a `name`, others vary. Amur normalises these into a consistent map so the application code doesn't need to handle provider-specific field names. This is one of the less glamorous parts of OAuth that every implementation ends up solving separately.

---

## Installation

Add Amur to your `mix.exs`:

```elixir
def deps do
  [
    {:amur, "~> 0.1.0"}
  ]
end
```

Then follow the setup steps above to configure providers and mount the router.

---

## Tech

- **Language** — Elixir
- **Depends on** — Plug (no Phoenix required)
- **Distribution** — Hex.pm
