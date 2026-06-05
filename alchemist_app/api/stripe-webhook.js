export const config = { api: { bodyParser: false } };

function buildAccessUpdateFromCheckoutSession(session) {
  const metadata = session && session.metadata ? session.metadata : {};
  const credits = Number(metadata.credit_quantity || process.env.ALCHEMIST_CREDIT_PACK_QUANTITY || 10);
  return {
    provider: 'stripe',
    checkoutSessionId: session.id,
    paymentStatus: session.payment_status,
    phone_number: metadata.phone_number || '',
    has_access: true,
    credits: Number.isFinite(credits) && credits > 0 ? Math.floor(credits) : 10,
    plan_type: metadata.plan_type || 'credit_pack',
    processedAt: new Date().toISOString()
  };
}

async function forwardAccessUpdate(accessUpdate) {
  const target = process.env.ALCHEMIST_ACCESS_WEBHOOK_URL;
  if (!target) return { forwarded: false, reason: 'ALCHEMIST_ACCESS_WEBHOOK_URL_NOT_CONFIGURED' };
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.ALCHEMIST_ACCESS_WEBHOOK_TOKEN) headers.Authorization = `Bearer ${process.env.ALCHEMIST_ACCESS_WEBHOOK_TOKEN}`;
  const response = await fetch(target, { method: 'POST', headers, body: JSON.stringify(accessUpdate) });
  if (!response.ok) {
    const error = new Error(`Access webhook rejected update with status ${response.status}`);
    error.statusCode = 502;
    throw error;
  }
  return { forwarded: true, status: response.status };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(500).json({ error: 'Stripe webhook misconfigured' });

  const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const rawBody = Buffer.concat(chunks);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (event.type === 'checkout.session.completed') {
    const accessUpdate = buildAccessUpdateFromCheckoutSession(event.data.object);
    try {
      const delivery = await forwardAccessUpdate(accessUpdate);
      return res.status(200).json({ received: true, accessUpdate, delivery });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message || 'Access update failed', accessUpdate });
    }
  }

  return res.status(200).json({ received: true, ignored: event.type });
}

export { buildAccessUpdateFromCheckoutSession, forwardAccessUpdate };
