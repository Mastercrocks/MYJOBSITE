const express = require('express');
const router = express.Router();
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { authenticateToken } = require('../middleware/auth-json');
const { sendAccountEmail, sendJobMarketingEmail, isEmailConfigured, verifyEmailTransport } = require('../services/emailService');
const Job = require('../models/Job');
const Employer = require('../models/Employer');
// Accept both STRIPE_SECRET_KEY and STRIPE_SECRET
const stripeSecret = sanitizeEnv(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || '');
// Helper to sanitize env values (trim + remove wrapping quotes)
function sanitizeEnv(v) {
  if (v == null) return '';
  let s = String(v).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith('\'') && s.endsWith('\''))) {
    s = s.slice(1, -1);
  }
  return s;
}
let stripe = null;
try { if (stripeSecret) { stripe = require('stripe')(stripeSecret); } } catch (_) { stripe = null; }

function getStripeMode() {
  // Quick heuristic based on key content
  const key = stripeSecret || '';
  return key.includes('_live_') ? 'live' : 'test';
}

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

// Ensure a minimal user record exists in users.json for the authenticated user
async function ensureJsonUserRecord(authUser) {
  const users = await readJsonSafe(dataPath('users.json'), []);
  let idx = users.findIndex(u => u && u.id != null && u.id.toString() === authUser.id.toString());
  if (idx === -1) {
    const minimal = {
      id: authUser.id,
      email: (authUser.email || '').toLowerCase(),
      username: authUser.username || (authUser.email ? authUser.email.split('@')[0] : ''),
      user_type: (authUser.user_type || authUser.userType || 'employer'),
      status: 'active',
      plan: 'free',
      billing: { status: 'none' }
    };
    users.push(minimal);
    await writeJsonSafe(dataPath('users.json'), users);
    idx = users.length - 1;
  }
  return { users, idx };
}

// Send an email campaign to all subscribers for a new job
async function sendCampaignForJob(job) {
  try {
    if (!isEmailConfigured()) {
      console.warn('Email not configured (missing EMAIL_USER/EMAIL_PASS). Skipping job campaign.');
      return { sent: 0, failed: 0 };
    }
    // Verify transport/auth once to avoid repeating failures for each recipient
    const ok = await verifyEmailTransport();
    if (!ok) {
      console.warn('Skipping job campaign due to invalid email credentials.');
      return { sent: 0, failed: 0 };
    }
    const emails = await readJsonSafe(dataPath('email_list.json'), []);
    if (!Array.isArray(emails) || emails.length === 0) {
      console.log('No subscribers found; skipping job campaign');
      return { sent: 0, failed: 0 };
    }

  const subject = `New Job: ${job.title} at ${job.company}`;
  const baseUrl = (process.env.PUBLIC_BASE_URL || process.env.SITE_URL || 'https://talentsync.shop').replace(/\/$/, '');
  const jobId = String(job.id || job._id || '').trim();
  const applyUrl = job.url || (jobId ? `${baseUrl}/jobs?jobId=${encodeURIComponent(jobId)}` : `${baseUrl}/jobs`);
    const text = `New Job Alert\n\n${job.title} at ${job.company}\nLocation: ${job.location}\nType: ${job.job_type || 'Full-time'}\n\nApply: ${applyUrl}`;
    const html = generateSimpleJobHTML(job, applyUrl);

    let sent = 0, failed = 0;
    for (const rec of emails) {
      try {
        await sendJobMarketingEmail({ to: rec.email, subject, text, html });
        sent++;
        await new Promise(r => setTimeout(r, 100)); // small delay to avoid throttling
      } catch (e) {
        console.error('Failed to send job email to', rec?.email, e?.message || e);
        failed++;
      }
    }
    console.log(`Job campaign completed. Sent=${sent}, Failed=${failed}`);
    return { sent, failed };
  } catch (e) {
    console.error('Campaign send error:', e);
    return { sent: 0, failed: 0 };
  }
}

function generateSimpleJobHTML(job, applyUrl) {
  return `
  <div style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto">
    <h2>🚀 New Job: ${job.title}</h2>
    <p><strong>Company:</strong> ${job.company}</p>
    <p><strong>Location:</strong> ${job.location}</p>
    <p><strong>Type:</strong> ${job.job_type || 'Full-time'}</p>
    ${job.salary ? `<p><strong>Salary:</strong> ${job.salary}</p>` : ''}
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin:12px 0">
      ${String(job.description || '').slice(0, 350)}${(job.description || '').length > 350 ? '...' : ''}
    </div>
    <p><a href="${applyUrl}" style="background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;display:inline-block">Apply Now</a></p>
    <p style="color:#64748b;font-size:12px">You are receiving this email because you subscribed to job alerts from TalentSync.</p>
  </div>`;
}

// Ensure a Stripe customer exists and belongs to the current Stripe mode (test/live)
async function ensureStripeCustomerForUser(stripe, user, users, userIdx) {
  user.billing = user.billing || {};
  const currentMode = getStripeMode();
  // If we previously stored a customer for a different mode, clear it first
  if (user.billing.env && user.billing.env !== currentMode) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Stripe mode changed from ${user.billing.env} to ${currentMode}; resetting customerId for user ${user.id}`);
    }
    try { delete user.billing.customerId; } catch (_) {}
  }
  const existingId = user.billing.customerId;
  if (existingId) {
    try {
      const cust = await stripe.customers.retrieve(existingId);
      // If retrieved and not deleted, reuse it
      if (cust && !cust.deleted) return cust.id;
    } catch (err) {
      // If the stored customer is from the wrong Stripe mode, Stripe returns resource_missing (No such customer)
      // We'll fall through to create a new one.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Stripe customer lookup failed; will create new. Reason:', err?.message || String(err));
      }
      // Clear stale ID so it's not accidentally reused anywhere else
      try {
        delete user.billing.customerId;
      } catch (_) {}
    }
  }
  // Create a new customer for this environment/mode
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.companyName || user.username || `Employer ${user.id}`,
    metadata: { userId: String(user.id) }
  });
  user.billing.customerId = customer.id;
  user.billing.provider = 'stripe';
  user.billing.env = currentMode;
  // Persist updated billing info
  users[userIdx] = user;
  await writeJsonSafe(dataPath('users.json'), users);
  return customer.id;
}

const PLAN_LIMITS = {
  free: 2,
  basic: 10, // $25 monthly
  pro: Infinity // $50 monthly
};

// Stripe Price IDs (set in env). Example:
// BASIC: price_XXXX for $25/mo, PRO: price_YYYY for $50/mo
// Accept STRIPE_PRICE_BASIC/PRO and also STRIPE_BASIC_PRICE_ID/STRIPE_PRO_PRICE_ID
const PRICE_IDS = {
  basic: sanitizeEnv(process.env.STRIPE_PRICE_BASIC || process.env.STRIPE_BASIC_PRICE_ID || ''),
  pro: sanitizeEnv(process.env.STRIPE_PRICE_PRO || process.env.STRIPE_PRO_PRICE_ID || '')
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
    // Prefer Mongo count for accuracy; fallback to JSON if needed
    let usedActive = 0;
    try {
      const employer = await Employer.findById(req.user.id).lean();
      if (employer) {
        usedActive = await Job.countDocuments({ employer: employer._id, status: 'active' });
      } else {
        const jobs = await readJsonSafe(dataPath('jobs.json'), []);
        usedActive = jobs.filter(j => (j.postedBy || j.employerId) === user.id && (j.status||'active')==='active').length;
      }
    } catch (_) {
      const jobs = await readJsonSafe(dataPath('jobs.json'), []);
      usedActive = jobs.filter(j => (j.postedBy || j.employerId) === user.id && (j.status||'active')==='active').length;
    }
    const plan = getUserPlan(user);
    const rawLimit = PLAN_LIMITS[plan];
    const unlimited = rawLimit === Infinity;
    const limit = unlimited ? null : rawLimit;
    const billing = (user.billing || {});
    return res.json({ 
      plan, 
      limit, 
      unlimited, 
      used: usedActive,
      billing: {
        provider: billing.provider || (stripe ? 'stripe' : 'none'),
        customerId: billing.customerId || null,
        subscriptionId: billing.subscriptionId || null,
        status: billing.status || null
      }
    });
  } catch (e) { res.status(500).json({ error: 'Failed to load plan' }); }
});

// Lightweight billing config status (no secrets), useful for live checks
router.get('/billing/config-status', authenticateToken, async (req, res) => {
  try {
    const hasStripe = !!stripe;
    const ids = {
      basic: PRICE_IDS.basic ? 'set' : 'missing',
      pro: PRICE_IDS.pro ? 'set' : 'missing'
    };
  const base = (process.env.PUBLIC_BASE_URL || `${(req.headers['x-forwarded-proto'] || req.protocol)}://${req.get('host')}`);
  const mode = hasStripe ? getStripeMode() : 'none';
  // Detect obviously restricted keys that cannot create Checkout Sessions
  const keyPreview = sanitizeEnv(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || '').toString();
  const likelyRestricted = /^(rk_|Rk_)/.test(keyPreview);
  res.json({ provider: hasStripe ? 'stripe' : 'none', mode, priceIds: ids, baseUrl: base, notes: likelyRestricted ? 'Restricted Stripe key detected; use a full secret key (sk_...).' : undefined });
  } catch (_) { res.json({ provider: 'unknown' }); }
});

// Update employer plan (placeholder for billing integration)
router.post('/plan', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body || {};
    if (!['free','basic','pro'].includes((plan||'').toLowerCase())) {
      return res.status(400).json({ error: 'Invalid plan' });
    }
  let { users, idx } = await ensureJsonUserRecord(req.user);
  const status = (users[idx].status || 'active').toString().toLowerCase();
  if (status !== 'active' || (users[idx].user_type || users[idx].userType) !== 'employer') return res.status(403).json({ error: 'Employer access required' });

    // Enforce paid upgrade path: only allow switching to paid plans if Stripe is configured and billing shows active
    const target = plan.toLowerCase();
    if (target !== 'free') {
      const billing = users[idx].billing || {};
      const isActiveSub = billing.provider === 'stripe' && billing.status === 'active' && !!billing.subscriptionId;
      if (!isActiveSub) {
        return res.status(402).json({ error: 'Payment required. Please complete checkout to upgrade.' });
      }
    }
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

  // Load or create user record in JSON store
  let { users, idx } = await ensureJsonUserRecord(req.user);
  const status = (users[idx].status || 'active').toString().toLowerCase();
  if (status !== 'active') return res.status(403).json({ error: 'Employer access required' });
    const user = ensureBillingFields(users[idx]);
    const uType = (user.user_type || user.userType || '').toString().toLowerCase();
    const uStatus = (user.status || 'active').toString().toLowerCase();
    if (uType !== 'employer' || uStatus !== 'active') {
      return res.status(403).json({ error: 'Employer access required' });
    }

  // Ensure a Stripe customer exists for the current Stripe mode (handles test/live mismatch)
  const customerId = await ensureStripeCustomerForUser(stripe, user, users, idx);

    // Build base URL: prefer PUBLIC_BASE_URL, else derive from request
    const baseUrl = (process.env.PUBLIC_BASE_URL
      || `${(req.headers['x-forwarded-proto'] || req.protocol)}://${req.get('host')}`)
      .replace(/\/$/, '');

    // Try to create checkout session; if it fails due to customer mismatch, recreate and retry once
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
        success_url: `${baseUrl}/employer/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/employer/dashboard?checkout=cancel`,
        metadata: { userId: String(user.id), plan }
      });
    } catch (e) {
      const msg = (e && e.message) || '';
      const isMissingCustomer = /No such customer/i.test(msg) || (e && e.code === 'resource_missing' && e.param === 'customer');
      if (isMissingCustomer) {
        const freshCustomerId = await ensureStripeCustomerForUser(stripe, user, users, idx);
        session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          customer: freshCustomerId,
          line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
          success_url: `${baseUrl}/employer/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/employer/dashboard?checkout=cancel`,
          metadata: { userId: String(user.id), plan }
        });
      } else {
        throw e;
      }
    }
    res.json({ url: session.url });
  } catch (e) {
    // Log detailed Stripe error context for diagnostics (safe: no secrets)
    try {
      const detail = { message: e?.message || String(e), type: e?.type, code: e?.code, param: e?.param };
      console.error('Stripe checkout error:', JSON.stringify(detail));
    } catch (_) { console.error('Stripe checkout error:', e?.message || e); }
    // Provide a slightly more actionable error for common config issues
    const msg = (e && e.message) || '';
    if (/No such price/i.test(msg)) {
      return res.status(500).json({ error: 'Billing not configured for selected plan (price not found). Contact support.' });
    }
    if (/No such customer/i.test(msg)) {
      return res.status(500).json({ error: 'Billing profile invalid. Please retry upgrade.' });
    }
    if (/api key provided/i.test(msg) || /invalid api key/i.test(msg) || /must use a secret key/i.test(msg)) {
      return res.status(500).json({ error: 'Stripe key invalid or restricted. Use a full secret key (sk_...).' });
    }
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Fallback confirmation endpoint to finalize upgrades without relying solely on webhooks
router.get('/billing/confirm', authenticateToken, async (req, res) => {
  try {
    if (!stripe) return res.status(400).json({ error: 'Billing not configured' });
    const sessionId = (req.query.session_id || req.query.sessionId || '').toString().trim();
    if (!sessionId) return res.status(400).json({ error: 'Missing session_id' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const userId = session.metadata && session.metadata.userId;
    const plan = session.metadata && session.metadata.plan;
    if (!userId || !plan) return res.status(400).json({ error: 'Invalid session metadata' });

    // Only finalize if the session is complete and has a subscription
    const paid = (session.payment_status === 'paid' || session.status === 'complete');
    if (!paid || !session.subscription) {
      return res.status(400).json({ error: 'Checkout not completed yet' });
    }

    const users = await readJsonSafe(dataPath('users.json'), []);
    const idx = users.findIndex(u => u && u.id && u.id.toString() === String(userId));
    if (idx === -1) return res.status(404).json({ error: 'User not found' });

    users[idx].plan = plan;
    users[idx].billing = users[idx].billing || {};
    users[idx].billing.subscriptionId = session.subscription || null;
    users[idx].billing.status = 'active';
    users[idx].billing.provider = 'stripe';
    users[idx].billing.customerId = session.customer || users[idx].billing.customerId || null;
    users[idx].billing.env = getStripeMode();
    await writeJsonSafe(dataPath('users.json'), users);

    res.json({ success: true, plan, subscriptionId: session.subscription });
  } catch (e) {
    console.error('Billing confirm error:', e?.message || e);
    res.status(500).json({ error: 'Failed to confirm checkout' });
  }
});

// Reset billing customer for current employer (auth required)
router.post('/billing/reset', authenticateToken, async (req, res) => {
  try {
  let { users, idx } = await ensureJsonUserRecord(req.user);
    const user = users[idx];
    const uType = (user.user_type || user.userType || '').toString().toLowerCase();
    const uStatus = (user.status || 'active').toString().toLowerCase();
    if (uType !== 'employer' || uStatus !== 'active') {
      return res.status(403).json({ error: 'Employer access required' });
    }
    user.billing = user.billing || {};
    delete user.billing.customerId;
    delete user.billing.subscriptionId;
    user.billing.status = 'none';
    delete user.billing.env;
    await writeJsonSafe(dataPath('users.json'), users);
    res.json({ success: true, message: 'Billing profile reset. Try upgrade again.' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to reset billing' });
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
    // Find employer by auth user id (Mongo if available)
    const employer = await Employer.findById(req.user.id).catch(() => null);
    let usingMongo = !!employer;

    // Enforce plan limits before creating a job (Mongo or JSON fallback)
    try {
      const user = await getUserRecord(req.user.id);
      const plan = getUserPlan(user);
      const limit = PLAN_LIMITS[plan];
      if (limit !== Infinity) {
        let activeCount = 0;
        if (usingMongo) {
          activeCount = await Job.countDocuments({ employer: employer._id, status: 'active' });
        } else {
          const jobs = await readJsonSafe(dataPath('jobs.json'), []);
          activeCount = jobs.filter(j => ((j.postedBy || j.employerId) === req.user.id) && (j.status||'active')==='active').length;
        }
        if (activeCount >= limit) {
          return res.status(403).json({ error: `Free plan limit reached. You can post up to ${limit} active jobs. Upgrade to add more.` });
        }
      }
    } catch (_) { /* soft-fail: default to allowing create if plan lookup has issues */ }
  // Note: Removed legacy EMPLOYERS.js mirror to avoid runtime errors when module is empty
    const body = req.body || {};
    const required = ['title','company','location','description'];
    for (const f of required) {
      if (!body[f] || !String(body[f]).trim()) return res.status(400).json({ error: `${f} is required` });
    }
    // Create job in MongoDB or JSON fallback
    let job;
    if (usingMongo) {
      job = new Job({
        title: String(body.title).trim(),
        company: String(body.company).trim(),
        location: String(body.location).trim(),
        description: String(body.description).trim(),
        salary: body.salary || '',
        job_type: body.job_type || body.type || 'Full-time',
        posted_date: new Date(),
        employer: employer._id
      });
      await job.save();
    } else {
      const jobs = await readJsonSafe(dataPath('jobs.json'), []);
      const id = `manual_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
      job = {
        id,
        title: String(body.title).trim(),
        company: String(body.company).trim(),
        location: String(body.location).trim(),
        description: String(body.description).trim(),
        salary: body.salary || '',
        job_type: body.job_type || body.type || 'Full-time',
        posted_date: new Date().toISOString(),
        status: 'active',
        url: body.url || '',
        employerId: req.user.id,
        postedBy: req.user.id,
        expires_at: new Date(Date.now() + 30*24*60*60*1000).toISOString()
      };
      jobs.unshift(job);
      await writeJsonSafe(dataPath('jobs.json'), jobs);
    }

    // Trigger email campaign to subscribers
    try {
      await sendCampaignForJob(job);
    } catch (e) {
      console.warn('Job email campaign failed:', e?.message || e);
    }

  res.json({ success: true, job });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// List my jobs
router.get('/jobs', authenticateToken, async (req, res) => {
  try {
    const employer = await Employer.findById(req.user.id).catch(() => null);
    if (employer) {
      const jobs = await Job.find({ employer: employer._id });
      return res.json({ jobs });
    }
    // Fallback to JSON store
    const jobs = await readJsonSafe(dataPath('jobs.json'), []);
    const mine = jobs.filter(j => (j.postedBy || j.employerId) === req.user.id);
    return res.json({ jobs: mine });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load jobs' });
  }
});

// Update my job
router.put('/jobs/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const employer = await Employer.findById(req.user.id).catch(() => null);
    if (employer) {
      const job = await Job.findOneAndUpdate({ _id: id, employer: employer._id }, { $set: { ...req.body } }, { new: true });
      if (!job) return res.status(404).json({ error: 'Job not found' });
      return res.json({ success: true, job });
    }
    // JSON fallback
    const jobs = await readJsonSafe(dataPath('jobs.json'), []);
    const idx = jobs.findIndex(j => j && j.id && j.id.toString() === id.toString() && (j.postedBy || j.employerId) === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'Job not found' });
    jobs[idx] = { ...jobs[idx], ...req.body };
    await writeJsonSafe(dataPath('jobs.json'), jobs);
    res.json({ success: true, job: jobs[idx] });
  } catch (e) { res.status(500).json({ error: 'Failed to update job' }); }
});

// Delete/deactivate my job
router.delete('/jobs/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const employer = await Employer.findById(req.user.id).catch(() => null);
    if (employer) {
      const job = await Job.findOneAndUpdate({ _id: id, employer: employer._id }, { $set: { status: 'inactive' } }, { new: true });
      if (!job) return res.status(404).json({ error: 'Job not found' });
      return res.json({ success: true });
    }
    // JSON fallback
    const jobs = await readJsonSafe(dataPath('jobs.json'), []);
    const idx = jobs.findIndex(j => j && j.id && j.id.toString() === id.toString() && (j.postedBy || j.employerId) === req.user.id);
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
    // Gather my jobs from Mongo and JSON
    let mongoJobs = [];
    try {
      const employer = await Employer.findById(req.user.id).lean();
      if (employer) {
        mongoJobs = await Job.find({ employer: employer._id }).lean();
      }
    } catch (_) { mongoJobs = []; }
    const jsonJobs = await readJsonSafe(dataPath('jobs.json'), []);
    const myJsonJobs = jsonJobs.filter(j => (j.postedBy || j.employerId) === req.user.id);

    // Active jobs count across both stores
    const activeJson = myJsonJobs.filter(j => (j.status||'active') === 'active').length;
    const activeMongo = mongoJobs.filter(j => (j.status||'active') === 'active').length;

    // Applications: match by employerId when present, else by jobId set across both stores
    const apps = await readJsonSafe(dataPath('applications.json'), []);
    const myJobIds = new Set([
      ...myJsonJobs.map(j => j.id?.toString()).filter(Boolean),
      ...mongoJobs.map(j => j._id?.toString()).filter(Boolean)
    ]);
    const myApps = apps.filter(a => {
      const belongsByEmployer = (a.employerId || '').toString() === req.user.id.toString();
      const belongsByJobId = a.jobId && myJobIds.has(a.jobId.toString());
      return belongsByEmployer || belongsByJobId;
    });
    const pending = myApps.filter(a => (a.status||'').toLowerCase() === 'pending').length;

    // Profile views: sum job_views for my jobs (tracked per jobId)
    const jobViews = await readJsonSafe(dataPath('job_views.json'), []);
    const myViews = jobViews.reduce((sum, rec) => {
      try {
        if ((rec.employerId || '').toString() === req.user.id.toString()) return sum + (Number(rec.views)||0);
        if (rec.jobId && myJobIds.has(rec.jobId.toString())) return sum + (Number(rec.views)||0);
        return sum;
      } catch (_) { return sum; }
    }, 0);

    res.json({
      activeJobs: activeJson + activeMongo,
      totalApplications: myApps.length,
      pendingReviews: pending,
      profileViews: myViews
    });
  } catch (e) { res.status(500).json({ error: 'Failed to load stats' }); }
});

module.exports = router;
