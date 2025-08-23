const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  company: String,
  location: String,
  salary: String,
  job_type: String,
  posted_date: { type: Date, default: Date.now },
  employer: { type: mongoose.Schema.Types.ObjectId, ref: 'Employer' }
});

module.exports = mongoose.model('Job', jobSchema);
