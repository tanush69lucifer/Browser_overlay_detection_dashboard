const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const escapeRegex = require('../utils/escapeRegex');
const { ok, paginate } = require('../utils/response');

// Admin: searchable user list (used by the exam assignment pickers).
const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, search, role, sort } = req.query;
  const filter = { isActive: true };
  if (role) filter.role = role;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter)
      .select('name email role createdAt')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  ok(res, paginate(items, total, page, limit));
});

module.exports = { listUsers };
