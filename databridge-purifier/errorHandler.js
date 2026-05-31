class PurifierError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', statusCode = 500) {
    super(message);
    this.name = 'PurifierError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const ERROR_CODES = {
  INVALID_INPUT: 'INVALID_INPUT',
  INPUT_TOO_LARGE: 'INPUT_TOO_LARGE',
  FETCH_FAILED: 'FETCH_FAILED',
  PARSE_FAILED: 'PARSE_FAILED',
  CONVERSION_FAILED: 'CONVERSION_FAILED',
};

function createErrorResponse(error) {
  if (error instanceof PurifierError) {
    return {
      success: false,
      error: { message: error.message, code: error.code },
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

function validateInput(html, url) {
  if (!html && !url) {
    throw new PurifierError(
      'Either "html" or "url" is required',
      ERROR_CODES.INVALID_INPUT,
      400
    );
  }
  return true;
}

module.exports = { PurifierError, ERROR_CODES, createErrorResponse, validateInput };
