const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/token');

// Reads "Authorization: Bearer <token>" and sets req.user = { id, role, name }.
const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, 'UNAUTHENTICATED', 'Login required'));
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role, name: payload.name };
    next();
  } catch {
    next(new ApiError(401, 'UNAUTHENTICATED', 'Invalid or expired token'));
  }
};

// Same as requireAuth but never fails; used where login is optional (e.g. register).
const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return next();
  try {
    const payload = verifyToken(header.slice(7));
    req.user = { id: payload.sub, role: payload.role, name: payload.name };
  } catch {
    /* ignore invalid token on optional routes */
  }
  next();
};

const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : next(new ApiError(403, 'FORBIDDEN', 'You do not have access to this resource'));

module.exports = { requireAuth, optionalAuth, requireRole };
