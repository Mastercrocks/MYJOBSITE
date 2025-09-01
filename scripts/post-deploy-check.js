require('dotenv').config();
const mongoose = require('mongoose');
const Job = require('../models/Job');

(async () => {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'talentsync';
  try {
    if (!uri) {
      console.log('ℹ️ MONGODB_URI not set; skipping post-deploy job count');
      process.exit(0);
    }
    await mongoose.connect(uri, { dbName });
    const total = await Job.countDocuments({ $or: [ { status: { $exists: false } }, { status: { $ne: 'inactive' } } ] });
    console.log(`📊 Post-deploy: active jobs in Mongo = ${total}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.log('⚠️ Post-deploy check error:', e && e.message ? e.message : String(e));
    process.exit(0);
  }
})();
