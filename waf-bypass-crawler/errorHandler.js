const CrawlerError = class extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', statusCode = 500) {
    super(message);
    this.name = 'CrawlerError';
    this.code = code;
    this.statusCode = statusCode;
  }
};

const ERROR_CODES = {
  INVALID_URL: 'INVALID_URL',
  TIMEOUT: 'TIMEOUT',
  NAVIGATION_FAILED: 'NAVIGATION_FAILED',
  EXTRACTION_FAILED: 'EXTRACTION_FAILED',
  BROWSER_LAUNCH_FAILED: 'BROWSER_LAUNCH_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  CLOUDFLARE_BLOCKED: 'CLOUDFLARE_BLOCKED',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
};

function createErrorResponse(error) {
  if (error instanceof CrawlerError) {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code,
      },
    };
  }
  
  return {
    success: false,
    error: {
      message: error.message || 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  };
}

function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new CrawlerError('URL is required and must be a string', ERROR_CODES.INVALID_URL, 400);
  }
  
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new CrawlerError('URL must use HTTP or HTTPS protocol', ERROR_CODES.INVALID_URL, 400);
    }
  } catch (err) {
    if (err instanceof CrawlerError) throw err;
    throw new CrawlerError('Invalid URL format', ERROR_CODES.INVALID_URL, 400);
  }
  
  return true;
}

module.exports = {
  CrawlerError,
  ERROR_CODES,
  createErrorResponse,
  validateUrl,
};
