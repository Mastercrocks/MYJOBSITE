const express = require('express');
const router = express.Router();
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { authenticateToken } = require('../middleware/auth-json');
const { sendAccountEmail } = require('../services/emailService');
const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
let stripe = null;
try { if (stripeSecret) { stripe = require('stripe')(stripeSecret); } } catch (_) { stripe = null; }

// Helpers
const dataPath = (name) => path.join(__dirname, '../data', name);
async function readJsonSafe(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = await fsp.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(fallback) && !Array.isArray(parsed) ? fallback : (parsed || fallback);
  } catch (_) { return fallback; }
}
async function writeJsonSafe(file, data) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, JSON.stringify(data, null, 2));
}

const PLAN_LIMITS = {
  free: 5,
  basic: 10, // $25 monthly
  pro: Infinity // $50 monthly
};

// Stripe Price IDs (set in env). Example:
// BASIC: price_XXXX for $25/mo, PRO: price_YYYY for $50/mo
const PRICE_IDS = {
  basic: process.env.STRIPE_PRICE_BASIC || '',
  pro: process.env.STRIPE_PRICE_PRO || ''
};

async function getUserRecord(userId) {
  const users = await readJsonSafe(dataPath('users.json'), []);
  return users.find(u => u && u.id && u.id.toString() === userId.toString());
}

function getUserPlan(user) {
  const plan = (user?.plan || 'free').toLowerCase();
  return ['free','basic','pro'].includes(plan) ? plan : 'free';
}

function ensureBillingFields(user) {
  user.billing = user.billing || {};
  return user;
}

// Get employer plan and usage
router.get('/plan', authenticateToken, async (req, res) => {
  try {
    const user = await getUserRecord(req.user.id);
  const status = user ? (user.status || 'active').toString().toLowerCase() : 'inactive';
  if (!user || status !== 'active' || (user.user_type || user.userType) !== 'employer') {
      return res.status(403).json({ error: 'Employer access required' });
    }
    const jobs = await readJsonSafe(dataPath('jobs.json'), []);
    const myJobs = jobs.filter(j => (j.postedBy || j.employerId) === user.id);
    const plan = getUserPlan(user);
    const rawLimit = PLAN_LIMITS[plan];
    const unlimited = rawLimit === Infinity;
    const limit = unlimited ? null : rawLimit;
    const billing = (user.billing || {});
    return res.json({ 
      plan, 
      limit, 
      unlimited, 
      used: myJobs.filter(j => (j.status||'active')==='active').length,
      billing: {
        provider: billing.provider || (stripe ? 'stripe' : 'none'),
        customerId: billing.customerId || null,
        subscriptionId: billing.subscriptionId || null,
        status: billing.status || null
      }
    });
  } catch (e) { res.status(500).json({ error: 'Failed to load plan' }); }
});

// Update employer plan (placeholder for billing integration)
router.post('/plan', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body || {};
    if (!['free','basic','pro'].includes((plan||'').toLowerCase())) {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    const users = await readJsonSafe(dataPath('users.json'), []);
    const idx = users.findIndex(u => u && u.id && u.id.toString() === req.user.id.toString());
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const status = (users[idx].status || 'active').toString().toLowerCase();
  if (status !== 'active' || (users[idx].user_type || users[idx].userType) !== 'employer') return res.status(403).json({ error: 'Employer access required' });
    users[idx].plan = plan.toLowerCase();
    await writeJsonSafe(dataPath('users.json'), users);

    // Notify admin of plan change
    try {
      if (process.env.ADMIN_NOTIFY_EMAIL) {
        await sendAccountEmail({
          to: process.env.ADMIN_NOTIFY_EMAIL,
          subject: `Employer plan updated: ${users[idx].email}`,
          text: `Employer ${users[idx].email} changed plan to ${users[idx].plan}.`,
          html: `<p>Employer <strong>${users[idx].email}</strong> changed plan to <strong>${users[idx].plan}</strong>.</p>`
        });
      }
    } catch (_) {}

    res.json({ success: true, plan: users[idx].plan });
  } catch (e) { res.status(500).json({ error: 'Failed to update plan' }); }
});

// Create Stripe Checkout Session for subscription
router.post('/billing/checkout', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body || {};
    if (!['basic','pro'].includes((plan||'').toLowerCase())) return res.status(400).json({ error: 'Invalid plan' });
  if (!stripe || !PRICE_IDS[plan]) return res.status(400).json({ error: 'Billing not configured' });

    // Load user
    const users = await readJsonSafe(dataPath('users.json'), []);
    const idx = users.findIndex(u => u && u.id && u.id.toString() === req.user.id.toString());
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const status = (users[idx].status || 'active').toString().toLowerCase();
  if (status !== 'active') return res.status(403).json({ error: 'Employer access required' });
    const user = ensureBillingFields(users[idx]);
    const uType = (user.user_type || user.userType || '').toString().toLowerCase();
    const uStatus = (user.status || 'active').toString().toLowerCase();
    if (uType !== 'employer' || uStatus !== 'active') {
      return res.status(403).json({ error: 'Employer access required' });
    }

    // Ensure a Stripe customer exists
    if (!user.billing.customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.companyName || user.username || `Employer ${user.id}`,
        metadata: { userId: String(user.id) }
      });
      user.billing.customerId = customer.id;
      user.billing.provider = 'stripe';
      await writeJsonSafe(dataPath('users.json'), users);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: user.billing.customerId,
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/employer/dashboard?checkout=success`,
      cancel_url: `${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/employer/dashboard?checkout=cancel`,
      metadata: { userId: String(user.id), plan }
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('Stripe checkout error:', e);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Stripe webhook to update subscription status and plan
router.post('/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // Note: this route should be mounted without bodyParser for raw body.
  try {
    if (!stripe) return res.status(400).send('Billing not configured');
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
      if (endpointSecret) {
        // If body is already parsed to object, stringify it; otherwise pass raw Buffer/string
        const payload = Buffer.isBuffer(req.body) ? req.body : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
        event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
      } else {
        // No secret configured: accept object or string
        event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      }
    } catch (err) {
      console.error('Webhook parse/verification failed.', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan;
      if (userId && plan) {
        const users = await readJsonSafe(dataPath('users.json'), []);
        const idx = users.findIndex(u => u && u.id && u.id.toString() === String(userId));
        if (idx !== -1) {
          users[idx].plan = plan;
          users[idx].billing = users[idx].billing || {};
          users[idx].billing.subscriptionId = session.subscription || null;
          users[idx].billing.status = 'active';
          users[idx].billing.provider = 'stripe';
          await writeJsonSafe(dataPath('users.json'), users);

          // Notify admin of upgrade
          try {
            if (process.env.ADMIN_NOTIFY_EMAIL) {
              await sendAccountEmail({
                to: process.env.ADMIN_NOTIFY_EMAIL,
                subject: `Employer upgraded to ${plan}`,
                text: `User ${users[idx].email} upgraded to ${plan}.`,
                html: `<p>User <strong>${users[idx].email}</strong> upgraded to <strong>${plan}</strong>.</p>`
              });
            }
          } catch (_) {}
        }
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const customerId = sub.customer;
      const users = await readJsonSafe(dataPath('users.json'), []);
      const idx = users.findIndex(u => u && u.billing && u.billing.customerId === customerId);
      if (idx !== -1) {
        users[idx].plan = 'free';
        users[idx].billing.status = 'canceled';
        await writeJsonSafe(dataPath('users.json'), users);
      }
    }

    res.json({ received: true });
  } catch (e) {
    console.error('Webhook error:', e);
    res.status(500).send('Server error');
  }
});

// Create job (plan enforced)
router.post('/jobs', authenticateToken, async (req, res) => {
  try {
    const user = await getUserRecord(req.user.id);
  const status = user ? (user.status || 'active').toString().toLowerCase() : 'inactive';
  if (!user || status !== 'active' || (user.user_type || user.userType) !== 'employer') {
      return res.status(403).json({ error: 'Employer access required' });
    }
    const jobs = await readJsonSafe(dataPath('jobs.json'), []);
    const activeMine = jobs.filter(j => (j.postedBy || j.employerId) === user.id && (j.status||'active')==='active').length;
    const plan = getUserPlan(user);
    const limit = PLAN_LIMITS[plan];
    if (activeMine >= limit) {
      return res.status(403).json({ 
        error: `Job limit reached for ${plan} plan`,
        plan, limit, used: activeMine
      });
    }
    const body = req.body || {};
    const required = ['title','company','location','description'];
    for (const f of required) {
      if (!body[f] || !String(body[f]).trim()) return res.status(400).json({ error: `${f} is required` });
    }
    const job = {
      id: Date.now(),
      title: String(body.title).trim(),
      company: String(body.company).trim(),
      location: String(body.location).trim(),
      description: String(body.description).trim(),
      salary: body.salary || '',
      job_type: body.job_type || body.type || 'Full-time',
      category: body.category || '',
      posted_date: new Date().toISOString(),
      source: 'Manual',
      url: body.url || '',
      status: 'active',
      employerId: user.id,
      postedBy: user.id
    };
    jobs.unshift(job);
    await writeJsonSafe(dataPath('jobs.json'), jobs);
    res.json({ success: true, job });
  } catch (e) { res.status(500).json({ error: 'Failed to create job' }); }
});

// List my jobs
router.get('/jobs', authenticateToken, async (req, res) => {
  try {
    const user = await getUserRecord(req.user.id);
  const status = user ? (user.status || 'active').toString().toLowerCase() : 'inactive';
  if (!user || status !== 'active' || (user.user_type || user.userType) !== 'employer') {
      return res.status(403).json({ error: 'Employer access required' });
    }
    const jobs = await readJsonSafe(dataPath('jobs.json'), []);
    const myJobs = jobs.filter(j => (j.postedBy || j.employerId) === user.id);
    res.json({ jobs: myJobs });
  } catch (e) { res.status(500).json({ error: 'Failed to load jobs' }); }
});

// Update my job
router.put('/jobs/:id', authenticateToken, async (req, res) => {
  try {
    const user = await getUserRecord(req.user.id);
  const status = user ? (user.status || 'active').toString().toLowerCase() : 'inactive';
  if (!user || status !== 'active' || (user.user_type || user.userType) !== 'employer') {
      return res.status(403).json({ error: 'Employer access required' });
    }
    const id = req.params.id;
    const jobs = await readJsonSafe(dataPath('jobs.json'), []);
    const idx = jobs.findIndex(j => j && j.id && j.id.toString() === id && (j.postedBy || j.employerId) === user.id);
    if (idx === -1) return res.status(404).json({ error: 'Job not found' });
    const patch = req.body || {};
    jobs[idx] = { ...jobs[idx], ...patch, id: jobs[idx].id };
    await writeJsonSafe(dataPath('jobs.json'), jobs);
    res.json({ success: true, job: jobs[idx] });
  } catch (e) { res.status(500).json({ error: 'Failed to update job' }); }
});

// Delete/deactivate my job
router.delete('/jobs/:id', authenticateToken, async (req, res) => {
  try {
    const user = await getUserRecord(req.user.id);
  const status = user ? (user.status || 'active').toString().toLowerCase() : 'inactive';
  if (!user || status !== 'active' || (user.user_type || user.userType) !== 'employer') {
      return res.status(403).json({ error: 'Employer access required' });
    }
    const id = req.params.id;
    const jobs = await readJsonSafe(dataPath('jobs.json'), []);
    const idx = jobs.findIndex(j => j && j.id && j.id.toString() === id && (j.postedBy || j.employerId) === user.id);
    if (idx === -1) return res.status(404).json({ error: 'Job not found' });
    jobs[idx].status = 'inactive';
    await writeJsonSafe(dataPath('jobs.json'), jobs);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to delete job' }); }
});

// Applications for my jobs
router.get('/applications', authenticateToken, async (req, res) => {
  try {
    const user = await getUserRecord(req.user.id);
  const status = user ? (user.status || 'active').toString().toLowerCase() : 'inactive';
  if (!user || status !== 'active' || (user.user_type || user.userType) !== 'employer') {
      return res.status(403).json({ error: 'Employer access required' });
    }
    const jobs = await readJsonSafe(dataPath('jobs.json'), []);
    const myJobIds = new Set(jobs.filter(j => (j.postedBy || j.employerId) === user.id).map(j => j.id.toString()));
    const apps = await readJsonSafe(dataPath('applications.json'), []);
    const myApps = apps.filter(a => a && a.jobId && myJobIds.has(a.jobId.toString()));
    res.json({ applications: myApps });
  } catch (e) { res.status(500).json({ error: 'Failed to load applications' }); }
});

// Profile get/update
router.get('/profile', authenticateToken, async (req, res) => {
  const user = await getUserRecord(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    id: user.id,
    email: user.email,
    username: user.username,
  user_type: user.user_type || user.userType,
    companyName: user.companyName || '',
    plan: getUserPlan(user)
  });
});

router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const users = await readJsonSafe(dataPath('users.json'), []);
    const idx = users.findIndex(u => u && u.id && u.id.toString() === req.user.id.toString());
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const status = (users[idx].status || 'active').toString().toLowerCase();
  if (status !== 'active') return res.status(403).json({ error: 'Employer access required' });
    const patch = req.body || {};
    const allowed = ['companyName','username'];
    for (const k of allowed) if (k in patch) users[idx][k] = patch[k];
    await writeJsonSafe(dataPath('users.json'), users);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to update profile' }); }
});

// Employer stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const jobs = await readJsonSafe(dataPath('jobs.json'), []);
    const myJobs = jobs.filter(j => (j.postedBy || j.employerId) === req.user.id);
    const apps = await readJsonSafe(dataPath('applications.json'), []);
    const myJobIds = new Set(myJobs.map(j => j.id.toString()));
    const myApps = apps.filter(a => a && a.jobId && myJobIds.has(a.jobId.toString()));
    const pending = myApps.filter(a => (a.status||'').toLowerCase() === 'pending').length;
    res.json({
      activeJobs: myJobs.filter(j => (j.status||'active')==='active').length,
      totalApplications: myApps.length,
      pendingReviews: pending,
      profileViews: 0
    });
  } catch (e) { res.status(500).json({ error: 'Failed to load stats' }); }
});

module.exports = router;
