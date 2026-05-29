const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createCrawler } = require('./crawler');
const { validateUrl, createErrorResponse } = require('./errorHandler');
const config = require('./config');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/extract', async (req, res) => {
  let crawler;
  
  try {
    const { url, format, waitFor, selector } = req.body;
    
    validateUrl(url);
    
    const validFormats = ['html', 'text'];
    const responseFormat = validFormats.includes(format) ? format : 'html';
    
    const extraWait = typeof waitFor === 'number' && waitFor > 0 ? waitFor : 0;
    
    console.log(`[API] Extracting: ${url} (format: ${responseFormat}, selector: ${selector || 'full page'})`);
    
    crawler = await createCrawler();
    
    const result = await crawler.extract({
      url,
      format: responseFormat,
      waitFor: extraWait,
      selector,
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[API] Error:', error.message);
    const response = createErrorResponse(error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json(response);
  } finally {
    if (crawler) {
      try {
        await crawler.close();
      } catch (closeError) {
        console.error('[API] Error closing crawler:', closeError.message);
      }
    }
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Endpoint not found',
      code: 'NOT_FOUND',
    },
  });
});

app.use((err, req, res, next) => {
  console.error('[API] Unhandled error:', err);
  res.status(500).json(createErrorResponse(err));
});

app.listen(config.PORT, () => {
  console.log(`
========================================
  WAF Bypass Crawler API
  Server running on http://localhost:${config.PORT}
  
  Endpoints:
  - GET  /health        - Health check
  - POST /api/extract   - Extract webpage data
  
  Example:
  curl -X POST http://localhost:${config.PORT}/api/extract \\
    -H "Content-Type: application/json" \\
    -d '{"url":"https://example.com","format":"text"}'
========================================
  `);
});

module.exports = app;
