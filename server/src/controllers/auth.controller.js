const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const { signToken } = require('../utils/token');
const config = require('../config/env');
const { verifyGoogleCredential } = require('../utils/googleIdentity');

const publicUser = (u) => ({ _id: u._id, name: u.name, email: u.email, role: u.role });

// Public signup creates CANDIDATE accounts. An admin token may create any role.
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const isAdmin = req.user?.role === 'ADMIN';
  if (role && role !== 'CANDIDATE' && !isAdmin) {
    throw new ApiError(403, 'FORBIDDEN', 'Only admins can create proctor or admin accounts');
  }
  if (await User.exists({ email })) {
    throw new ApiError(409, 'CONFLICT', 'An account with this email already exists');
  }
  const user = await User.create({
    name,
    email,
    passwordHash: await User.hashPassword(password),
    role: isAdmin && role ? role : 'CANDIDATE',
  });
  ok(res, { user: publicUser(user) }, { status: 201, message: 'Account created' });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  // Same message for unknown email and wrong password (no account enumeration)
  if (!user || !user.isActive || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  ok(res, { token: signToken(user), user: publicUser(user) }, { message: 'Logged in' });
});

const googleLogin = asyncHandler(async (req, res) => {
  if (!config.googleClientId) {
    throw new ApiError(503, 'GOOGLE_LOGIN_NOT_CONFIGURED', 'Google sign-in has not been configured by the app administrator');
  }

  const claims = await verifyGoogleCredential(req.body.credential, config.googleClientId);
  const email = String(claims.email).trim().toLowerCase();
  let user = await User.findOne({ $or: [{ googleSub: claims.sub }, { email }] }).select('+googleSub');

  if (user) {
    if (!user.isActive) throw new ApiError(401, 'INVALID_CREDENTIALS', 'This account is unavailable');
    if (user.googleSub && user.googleSub !== claims.sub) {
      throw new ApiError(409, 'GOOGLE_ACCOUNT_MISMATCH', 'This email is linked to a different Google account');
    }
    if (!user.googleSub) {
      user.googleSub = claims.sub;
      await user.save();
    }
  } else {
    const fallbackName = email.split('@')[0].slice(0, 80);
    try {
      user = await User.create({
        name: String(claims.name || fallbackName).trim().slice(0, 80) || fallbackName,
        email,
        googleSub: claims.sub,
        role: 'CANDIDATE',
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      user = await User.findOne({ $or: [{ googleSub: claims.sub }, { email }] }).select('+googleSub');
      if (!user || (user.googleSub && user.googleSub !== claims.sub)) {
        throw new ApiError(409, 'GOOGLE_ACCOUNT_MISMATCH', 'Unable to link this Google account');
      }
    }
  }

  ok(res, { token: signToken(user), user: publicUser(user) }, { message: 'Logged in with Google' });
});

const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  if (!user || !user.isActive) throw new ApiError(401, 'UNAUTHENTICATED', 'Account not found');
  ok(res, { user: publicUser(user) });
});

// JWT is stateless: the client deletes its token. Endpoint exists for a consistent API.
const logout = (req, res) => ok(res, null, { message: 'Logged out' });

module.exports = { register, login, googleLogin, me, logout };
