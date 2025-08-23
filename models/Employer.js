const mongoose = require('mongoose');

const employerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: String,
  company: String,
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Employer', employerSchema);
