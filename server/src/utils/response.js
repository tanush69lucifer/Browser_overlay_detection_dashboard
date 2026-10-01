// Success shape: { success: true, data, message? }
const ok = (res, data, { status = 200, message } = {}) =>
  res.status(status).json({ success: true, data, ...(message && { message }) });

// Builds the standard paginated list payload.
const paginate = (items, total, page, limit) => ({
  items,
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

module.exports = { ok, paginate };
