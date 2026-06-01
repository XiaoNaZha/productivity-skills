# 🚀 Productivity Skills

> A curated collection of AI-powered productivity tools and Claude Code skills — built for developers, content creators, and AI enthusiasts.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## 📦 Skills Catalog

| Skill | Type | Description | Status |
|-------|------|-------------|--------|
| [databridge-vault](./databridge-vault) | Infrastructure | Proxy rotation (round-robin) + session cookie vault with heartbeat keep-alive. Sidecar for the scraping pipeline. | ✅ Stable |
| [databridge-crawler](./databridge-crawler) | Standalone Server | Stealth web scraper that bypasses WAF/Cloudflare protections using Puppeteer + stealth plugins | ✅ Stable |
| [databridge-purifier](./databridge-purifier) | Standalone Server | Converts dirty HTML to clean, RAG-ready Markdown by stripping noise (nav, footer, ads, scripts) | ✅ Stable |

---

## 🔗 Pipeline

Skills are designed to chain together via standard HTTP APIs:

```
databridge-vault (port 3002)                     databridge-crawler (3000)         databridge-purifier (3001)
  ┌──────────────────────────┐                    ┌──────────────────────┐         ┌──────────────────────┐
  │ Infrastructure           │── proxy + cookies →│ Stage 1: Capture     │── HTML →│ Stage 2: Clean       │──▶ LLM / RAG
  │ Proxy Rotation + Session │                    │ Bypass WAF/Cloudflare │         │ Strip noise → Markdown│
  └──────────────────────────┘                    └──────────────────────┘         └──────────────────────┘
```

---

## 🏗️ Project Structure

```
productivity-skills/
├── README.md                        # You are here
├── CLAUDE.md                        # Claude Code integration guide
├── LICENSE                          # MIT License
├── CONTRIBUTING.md                  # Contribution guidelines
├── _template/                       # Skill template for new additions
├── databridge-vault/                # Infrastructure: proxy + session
├── databridge-crawler/              # Stage 1: Stealth web scraper
└── databridge-purifier/             # Stage 2: HTML → Markdown cleaner
```

---

## 🎯 What Makes a Good Skill?

Each skill in this collection is:

- **Self-contained** — installable and runnable independently via `npm install && npm start`
- **Pipeline-aware** — documents how it chains with other DataBridge stages
- **Documented** — clear README with API reference and examples
- **Testable** — includes a test suite (`npm test`)
- **Claude Code Ready** — ships with a `CLAUDE.md` so Claude Code can invoke it as a slash command
- **Production-minded** — proper error handling, configuration, and graceful shutdown

---

## 🚀 Quick Start

Each skill is self-contained. Pick one and go:

```bash
# Infrastructure: DataBridge Vault
cd databridge-vault
npm install && npm start

# Stage 1: DataBridge Crawler
cd databridge-crawler
npm install && npx puppeteer browsers install chrome
npm start

# Stage 2: DataBridge Purifier
cd databridge-purifier
npm install && npm start
```

---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on adding new skills, improving existing ones, or fixing bugs.

### Adding a new skill

1. Copy the `_template/` directory: `cp -r _template/ your-skill-name/`
2. Implement your skill following the template pattern
3. Add it to the Skills Catalog table above
4. Open a PR

---

## 📄 License

MIT © [@XiaoNaZha](https://github.com/XiaoNaZha)
