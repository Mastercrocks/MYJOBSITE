require('dotenv').config();
const mongoose = require('mongoose');
const Job = require('../models/Job');

(async () => {
  try {
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB || 'talentsync';
    if (!uri) {
      console.error('MONGODB_URI not set');
      process.exit(1);
    }
    await mongoose.connect(uri, { dbName });
    // Count jobs that are not explicitly inactive (treat missing status as active)
    const filter = { $or: [ { status: { $exists: false } }, { status: { $ne: 'inactive' } } ] };
    const total = await Job.countDocuments(filter);
    console.log(String(total));
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error(e && e.message ? e.message : String(e));
    process.exit(1);
  }
})();
