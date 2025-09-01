const mongoose = require('mongoose');

const employerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: String,
  company: String,
  status: { type: String, default: 'active' },
  verified: { type: Boolean, default: false },
  verifiedAt: Date,
  verifiedBy: String,
  approvedAt: Date,
  approvedBy: String,
  deniedAt: Date,
  deniedBy: String,
  deniedReason: String,
  updatedAt: Date,
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Employer', employerSchema);
