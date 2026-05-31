const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Purifier } = require('./purifier');
const { validateInput, createErrorResponse, PurifierError, ERROR_CODES } = require('./errorHandler');
const config = require('./config');

const app = express();
const purifier = new Purifier();

app.use(cors());
app.use(express.json({
  limit: `${Math.ceil(config.MAX_INPUT_SIZE / 1024 / 1024)}mb`,
}));

// ─── Health Check ───────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Convert HTML → Markdown ────────────────────────────────────
app.post('/api/convert', async (req, res) => {
  try {
    const { html, url, options } = req.body;

    validateInput(html, url);

    let sourceHtml = html;

    // URL mode: fetch the page first
    if (!sourceHtml && url) {
      console.log(`[API] Fetching URL: ${url}`);
      try {
        const response = await axios.get(url, {
          timeout: config.TIMEOUT,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; DataBridge-Purifier/1.0)',
            'Accept': 'text/html,application/xhtml+xml,*/*',
          },
          maxContentLength: config.MAX_INPUT_SIZE,
          responseType: 'text',
        });
        sourceHtml = response.data;
      } catch (fetchError) {
        throw new PurifierError(
          `Failed to fetch URL: ${fetchError.message}`,
          ERROR_CODES.FETCH_FAILED,
          502
        );
      }
    }

    // Size check
    if (sourceHtml.length > config.MAX_INPUT_SIZE) {
      throw new PurifierError(
        `Input too large (${sourceHtml.length} bytes). Max: ${config.MAX_INPUT_SIZE} bytes`,
        ERROR_CODES.INPUT_TOO_LARGE,
        413
      );
    }

    console.log(`[API] Converting HTML → Markdown (${sourceHtml.length} bytes)`);

    const t0 = Date.now();
    const result = purifier.purify(sourceHtml, options);
    const elapsed = Date.now() - t0;

    console.log(`[API] Done in ${elapsed}ms — ${result.stats.reductionPercent}% reduction (${result.stats.originalSize} → ${result.stats.cleanedSize} bytes)`);

    res.json({
      success: true,
      data: {
        ...result,
        convertedAt: new Date().toISOString(),
        processingTimeMs: elapsed,
      },
    });
  } catch (error) {
    console.error('[API] Error:', error.message);
    const response = createErrorResponse(error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json(response);
  }
});

// ─── 404 ────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { message: 'Endpoint not found', code: 'NOT_FOUND' },
  });
});

// ─── Error Handler ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[API] Unhandled error:', err);
  res.status(500).json(createErrorResponse(err));
});

// ─── Start ──────────────────────────────────────────────────────
app.listen(config.PORT, () => {
  console.log(`
========================================
  DataBridge Purifier — Stage 2/2 (Clean)
  Server running on http://localhost:${config.PORT}

  Endpoints:
  - GET  /health        - Health check
  - POST /api/convert   - Convert HTML to clean Markdown

  Example:
  curl -X POST http://localhost:${config.PORT}/api/convert \\
    -H "Content-Type: application/json" \\
    -d '{"url":"https://example.com"}'

  Pipeline with databridge-crawler:
  curl -s -X POST http://localhost:3000/api/extract \\
    -H "Content-Type: application/json" \\
    -d '{"url":"https://example.com","format":"html"}' \\
    | jq -r '.data.content' \\
    | curl -s -X POST http://localhost:${config.PORT}/api/convert \\
    -H "Content-Type: application/json" \\
    -d @-
========================================
  `);
});

module.exports = app;
