const DEFAULT_CREDIT_QUANTITY = 10;

function getOrigin(req) {
  const configured = process.env.ALCHEMIST_APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  const headerOrigin = req.headers.origin;
  if (headerOrigin) return headerOrigin.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `${proto}://${host}` : '';
}

function getCreditQuantity(req) {
  const requested = Number(req.body && req.body.quantity);
  if (Number.isFinite(requested) && requested > 0) return Math.floor(requested);
  const configured = Number(process.env.ALCHEMIST_CREDIT_PACK_QUANTITY);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : DEFAULT_CREDIT_QUANTITY;
}

function buildLineItems() {
  const priceId = process.env.STRIPE_PRICE_ID || process.env.ALCHEMIST_STRIPE_PRICE_ID;
  if (!priceId) {
    const error = new Error('Stripe price is not configured. Set STRIPE_PRICE_ID.');
    error.statusCode = 500;
    error.code = 'STRIPE_PRICE_ID_MISSING';
    throw error;
  }
  return [{ price: priceId, quantity: 1 }];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: 'Stripe misconfigured', code: 'STRIPE_SECRET_KEY_MISSING' });

  const origin = getOrigin(req);
  if (!origin) return res.status(400).json({ error: 'Unable to resolve request origin', code: 'ORIGIN_REQUIRED' });

  const stripe = (await import('stripe')).default(secretKey);
  const quantity = getCreditQuantity(req);
  const phoneNumber = req.body && typeof req.body.phone_number === 'string' ? req.body.phone_number : '';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: buildLineItems(),
      success_url: `${origin}/?payment=success&credits=${quantity}`,
      cancel_url: `${origin}/?payment=cancelled`,
      allow_promotion_codes: true,
      metadata: {
        app: 'alchemist',
        credit_quantity: String(quantity),
        phone_number: phoneNumber
      }
    });
    return res.status(200).json({ url: session.url, id: session.id });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Checkout session failed', code: error.code || 'CHECKOUT_SESSION_FAILED' });
  }
}
