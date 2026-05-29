# WAF Bypass Crawler

A smart web scraping service powered by Puppeteer Stealth. Automatically bypasses Cloudflare/WAF protections and extracts dynamically rendered web content.

## Features

- Stealth mode with `puppeteer-extra-plugin-stealth` to hide automation fingerprints
- Waits for async data to fully load (`networkidle2`)
- Auto-detects and waits for Cloudflare challenges to pass
- Auto-retry on failure (up to 3 attempts)
- Supports HTML, plain text, or CSS selector extraction

## Quick Start

### Install

```bash
npm install
npx puppeteer browsers install chrome
```

### Start Server

```bash
npm start
```

Server runs at `http://localhost:3000`

## API Usage

### Extract Webpage

```bash
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","format":"text"}'
```

### Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| url | string | Yes | - | Target webpage URL |
| format | string | No | html | Response format: `html` or `text` |
| selector | string | No | - | CSS selector to extract specific element |
| waitFor | number | No | 0 | Extra wait time (ms) after page load |

### Response Example

```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "title": "Example Domain",
    "content": "<html>...</html>",
    "extractedAt": "2026-05-28T10:00:00.000Z",
    "format": "html"
  }
}
```

## Project Structure

```
├── server.js         # Express API server
├── crawler.js        # Puppeteer crawler module
├── config.js         # Configuration
├── errorHandler.js   # Error handling utilities
├── .env              # Environment variables
├── test.js           # Test script
└── package.json
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| TIMEOUT | Page load timeout (ms) | 30000 |
| MAX_RETRIES | Max retry attempts | 3 |
| HEADLESS | Headless browser mode | true |

## Testing

```bash
npm test
```

## License

MIT
