const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: String,
  lastName: String,
  userType: { type: String, enum: ['job_seeker', 'employer', 'admin'], default: 'job_seeker' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
