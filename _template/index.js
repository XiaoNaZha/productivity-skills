require('dotenv').config();
const express = require('express');
const cors = require('cors');
const config = require('./config');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// TODO: Add your core logic here
app.post('/api/action', async (req, res) => {
  try {
    const { input } = req.body;

    if (!input) {
      return res.status(400).json({
        success: false,
        error: { message: 'Input is required', code: 'INVALID_INPUT' },
      });
    }

    // Your logic here
    const result = { input, processed: true };

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[API] Error:', error.message);
    res.status(500).json({
      success: false,
      error: { message: error.message, code: 'INTERNAL_ERROR' },
    });
  }
});

app.listen(config.PORT, () => {
  console.log(`Skill server running on http://localhost:${config.PORT}`);
});

module.exports = app;
