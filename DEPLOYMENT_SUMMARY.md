Deployment summary

Environment variables

Set these in your hosting provider for auth, email, and billing:

- JWT_SECRET
- SESSION_SECRET
- EMAIL_USER / EMAIL_PASS (or SMTP_HOST / SMTP_PORT / SMTP_SECURE)
- PUBLIC_BASE_URL (e.g., https://talentsync.shop)
- ADMIN_NOTIFY_EMAIL (receives signup/upgrade notifications)
- STRIPE_SECRET_KEY (test or live key)
- STRIPE_PRICE_BASIC (Stripe Price ID for $25/mo plan)
- STRIPE_PRICE_PRO (Stripe Price ID for $50/mo plan)
- STRIPE_WEBHOOK_SECRET (from Stripe webhook endpoint)

Stripe setup (quick)

1) Create two Products in Stripe: Basic $25/mo, Pro $50/mo, copy their recurring Price IDs.
2) In Stripe dashboard, add a Webhook endpoint pointing to: https://YOUR_DOMAIN/api/employer/billing/webhook and select events:
	- checkout.session.completed
	- customer.subscription.deleted
3) Put keys/IDs into env vars above and deploy. If Stripe isn’t configured, the UI will fall back to a direct plan change without charging.

Admin visibility

- Admin can see each employer’s current plan and billing status in the Employers table.
- A billing overview JSON is available at GET /api/admin/billing/overview.
