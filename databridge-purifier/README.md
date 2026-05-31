# DataBridge Purifier — Stage 2 (Clean)

> Knowledge base dehydration engine. Converts dirty scraped HTML into clean, RAG-ready Markdown. Accepts output from [DataBridge Crawler](../databridge-crawler) or any HTML source.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🔗 Pipeline Position

```
databridge-crawler (3000)            databridge-purifier (3001)
  ┌──────────────────────┐           ┌──────────────────────┐
  │ Stage 1: CAPTURE     │── HTML → │ Stage 2: CLEAN        │──▶ LLM / RAG
  │ Previous skill        │          │ This skill             │
  └──────────────────────┘           └──────────────────────┘
```

## Why

After scraping a webpage with DataBridge Crawler, you get raw HTML full of noise — nav bars, footer links, ads, cookie banners, sidebar widgets. Feeding that directly to an LLM wastes tokens and degrades RAG quality.

This skill:
1. Parses the DOM with cheerio
2. Strips noise using a 3-tier filtering engine
3. Converts the cleaned content to Markdown with turndown
4. Returns stats on what was removed (typically 70-95% reduction)

## Quick Start

```bash
npm install
npm start
# → Server running at http://localhost:3001
```

## API Reference

### `GET /health`

```bash
curl http://localhost:3001/health
```

### `POST /api/convert`

Convert HTML or a URL to clean Markdown.

**Raw HTML mode:**
```bash
curl -X POST http://localhost:3001/api/convert \
  -H "Content-Type: application/json" \
  -d '{"html":"<html>...dirty html...</html>"}'
```

**URL mode:**
```bash
curl -X POST http://localhost:3001/api/convert \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

**Request Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| html | string | One of html/url | — | Raw HTML to convert |
| url | string | One of html/url | — | URL to fetch and convert |
| options.preserveImages | boolean | No | true | Keep image references |
| options.preserveLinks | boolean | No | true | Keep link references |
| options.headingStyle | string | No | atx | `atx` or `setext` |

**Response:**
```json
{
  "success": true,
  "data": {
    "markdown": "# Hello\n\nWorld",
    "title": "Example Page",
    "stats": {
      "strippedElements": 11,
      "strippedTypes": {
        "hardStripped": 4,
        "heuristicStripped": 5,
        "emptyCleaned": 2,
        "total": 11
      },
      "originalSize": 24500,
      "cleanedSize": 820,
      "reductionPercent": 96.7
    },
    "convertedAt": "2026-05-31T12:00:00.000Z",
    "processingTimeMs": 45
  }
}
```

## Noise Filtering Strategy

| Tier | Method | Targets |
|------|--------|---------|
| 1 | Hard Strip | `script`, `style`, `nav`, `footer`, `iframe`, `noscript`, `[role="navigation"]`, etc. |
| 2 | Heuristic | Elements with class/id matching ad, sidebar, social, comment, cookie, popup, newsletter patterns |
| 3 | Empty Cleanup | Residual empty `<div>`, `<p>`, `<section>` after stripping |

## Pipeline: Accept from Crawler

```bash
# Full pipeline: Crawl → Clean → LLM
curl -s -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","format":"html"}' \
  | jq -r '.data.content' \
  | jq -Rs '{html: .}' \
  | curl -s -X POST http://localhost:3001/api/convert \
  -H "Content-Type: application/json" \
  -d @-
```

On Make.com: Crawler (port 3000) → Purifier (port 3001) → OpenAI / Anthropic / RAG Database

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3001 |
| TIMEOUT | URL fetch timeout (ms) | 30000 |
| MAX_INPUT_SIZE | Max input size (bytes) | 10MB |

## Testing

```bash
npm test
```

## License

MIT
