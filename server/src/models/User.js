const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['CANDIDATE', 'PROCTOR', 'ADMIN'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: function passwordRequired() { return !this.googleSub; }, select: false },
    googleSub: { type: String, default: undefined, unique: true, sparse: true, select: false },
    resetPasswordToken: { type: String, default: undefined, select: false },
    resetPasswordExpires: { type: Date, default: undefined, select: false },
    role: { type: String, enum: ROLES, default: 'CANDIDATE', index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function comparePassword(password) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = (password) => bcrypt.hash(password, 10);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
