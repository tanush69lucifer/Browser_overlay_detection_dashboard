const { ZodError } = require('zod');
const ApiError = require('../utils/ApiError');
const config = require('../config/env');

const notFound = (req, res, next) =>
  next(new ApiError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));

// Central error handler. Error shape: { success: false, error: { code, message, details? } }
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let code = typeof err.code === 'string' ? err.code : 'SERVER_ERROR';
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid request data';
    details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (err.name === 'CastError') {
    status = 400;
    code = 'INVALID_ID';
    message = 'Invalid id';
  } else if (err.code === 11000) {
    status = 409;
    code = 'CONFLICT';
    message = `${Object.keys(err.keyValue || {}).join(', ') || 'Value'} already exists`;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body is not valid JSON';
  }

  if (status >= 500) {
    console.error(err);
    if (config.isProd) message = 'Something went wrong';
  }

  res.status(status).json({ success: false, error: { code, message, ...(details && { details }) } });
};

module.exports = { notFound, errorHandler };
