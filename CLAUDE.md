# Productivity Skills — Claude Code Integration

This is a monorepo of productivity tools and Claude Code slash-command skills. Each skill lives in its own directory with a `CLAUDE.md` that tells Claude Code how to use it.

## Available Skills

### databridge-crawler
- **Type:** Standalone Express server
- **What it does:** Stealthily scrapes web pages behind WAF/Cloudflare protections using Puppeteer + stealth plugins
- **How to run:** `cd databridge-crawler && npm start`
- **Server:** `http://localhost:3000`
- **Endpoints:**
  - `GET /health` — Health check
  - `POST /api/extract` — Extract webpage content (HTML, text, or CSS selector)
- **When to use:** Any time you need to scrape a webpage that blocks normal HTTP requests

### databridge-purifier
- **Type:** Standalone Express server
- **What it does:** Converts dirty HTML into clean, RAG-ready Markdown by stripping nav, footer, ads, scripts, and other noise
- **How to run:** `cd databridge-purifier && npm start`
- **Server:** `http://localhost:3001`
- **Endpoints:**
  - `GET /health` — Health check
  - `POST /api/convert` — Convert HTML (raw or from URL) to clean Markdown
- **When to use:** After scraping a webpage with databridge-crawler, before feeding to LLM/RAG
- **Pipeline:** `databridge-crawler (port 3000) → databridge-purifier (port 3001) → LLM/RAG`

## Adding a New Skill

1. Copy `_template/` to `<skill-name>/`
2. Implement the core logic in `index.js` (or a server structure if it's a standalone service)
3. Write a `CLAUDE.md` specific to that skill
4. Add it to the skills catalog in the root `README.md`
5. Test with `npm test` from the skill directory
