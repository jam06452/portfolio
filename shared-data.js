/**
 * Shared user data configuration
 * Used by both frontend (Astro) and backend (Cloudflare Functions)
 */

export const userData = {
  // Personal Information
  name: "jam06452",
  fullName: "jam06452",
  email: "jam@jam06452.uk",
  domain: "jam06452.uk",
  location: "United Kingdom",
  bio: "Teen dev based in UK building elixir applications",

  // Social Media & Links
  social: {
    github: {
      username: "jam06452",
      url: "https://github.com/jam06452",
    },
    discord: "https://discord.com",
    slack: "https://hackclub.enterprise.slack.com/team/U0A7YQ0KVKJ",
  },

  // CDN Configuration
  cdn: {
    baseUrl: "https://cdn.jam06452.uk",
    assets: {
      heroDark: "https://cdn.vejas.zip/assets/hero-dark.svg",
      heroLight: "https://cdn.vejas.zip/assets/hero-light.svg",
      githubIcon: "https://cdn.vejas.zip/assets/icons/Github.svg",
      blueprintIcon: "https://cdn.vejas.zip/assets/icons/bp.svg",
    },
  },
}
