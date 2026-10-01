// Escapes user input before using it inside a RegExp (prevents ReDoS / regex injection).
module.exports = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
