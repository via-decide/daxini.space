## Purpose
Prepare Alchemist for secure Stripe integration.

## Flow
User → Login → Payment → Webhook → Access

## Security Rules
- Secret key never exposed.
- All validation via webhook.
- Frontend cannot grant access.

## Integration Points
- WhatsApp login → identity.
- Stripe → payment.
- DB → access control (`user`: phone_number, has_access, credits, plan_type).
