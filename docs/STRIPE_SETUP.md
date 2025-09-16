# Stripe Integration Setup

This document explains how to set up Stripe payments for premium subscriptions in the TL-DKP application.

## Prerequisites

1. A Stripe account (create one at https://stripe.com)
2. Access to your Stripe dashboard

## Backend Configuration

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 2. Get Stripe Keys

1. Go to your Stripe Dashboard
2. Navigate to "Developers" > "API keys"
3. Copy your "Publishable key" and "Secret key"
4. Use test keys for development, live keys for production

### 3. Create Products and Prices

1. Go to "Products" in your Stripe Dashboard
2. Create a new product for "Premium Subscription"
3. Add pricing:
   - Monthly: $9.99/month
   - Yearly: $99.99/year (optional)
4. Note down the Price IDs (price_xxx) for each plan
   1- Preço de Premium Server - 1 month - one time - price_1S7qUq2Y1z6m8xzYdxtxcxA7
   2- Preço de Premium Server - 1 month - price_1S7qSj2Y1z6m8xzYTi0Ngv5a
   3- Preço de Premium Server - 1 year - price_1S7qTk2Y1z6m8xzYP4FFMK0t

## Frontend Configuration

### 1. Environment Variables

Create a `.env.local` file in the `frontend` directory:

```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
```

### 2. Update API Base URL

Make sure your `VITE_API_BASE_URL` is set correctly in `frontend/.env.local`:

```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

## Webhook Setup

### 1. Create Webhook Endpoint

1. Go to "Developers" > "Webhooks" in Stripe Dashboard (https://docs.stripe.com/webhooks/quickstart)
2. Click "Add endpoint"
3. Set endpoint URL to: `https://yourdomain.com/api/stripe/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.cancelled`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the webhook signing secret

### 2. Test Webhooks Locally

For local development, use Stripe CLI:

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI will provide a webhook secret starting with `whsec_` - use this for `STRIPE_WEBHOOK_SECRET`.

## Testing

### 1. Test Cards

Use these test card numbers in Stripe test mode:

- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **3D Secure**: 4000 0025 0000 3155

### 2. Test Flow

1. Start your backend server: `npm run dev:api`
2. Start your frontend: `npm run dev:client`
3. Navigate to a guild's subscription page
4. Click "Upgrade to Premium"
5. Use test card details to complete payment
6. Check that subscription status updates in Firebase

## Production Deployment

### 1. Update Environment Variables

Replace test keys with live keys:

```bash
STRIPE_SECRET_KEY=sk_live_your_live_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret
```

### 2. Configure Customer Portal

1. **Go to Stripe Dashboard**: https://dashboard.stripe.com/test/settings/billing/portal
2. **Click "Activate test link"** to create a default configuration
3. **Configure portal settings**:
   - Enable subscription management
   - Enable payment method updates
   - Add business information
   - Customize branding (optional)

### 3. Update Webhook URL

Set the webhook endpoint to your production URL:

```
https://www.tldkp.org/api/stripe/webhook
```

### 3. Verify Webhook

Test the webhook endpoint to ensure it's working correctly.

## Features

### What's Included

- ✅ Stripe Checkout integration
- ✅ Subscription management
- ✅ Billing portal access
- ✅ Webhook handling for subscription events
- ✅ Integration with existing Firebase subscription system
- ✅ Premium feature access control
- ✅ Analytics tracking

### Subscription Plans

The system supports flexible subscription plans configured in Stripe:

- Monthly subscriptions
- Yearly subscriptions
- One-time payments (if needed)
- Custom pricing

### Security

- Webhook signature verification
- User authentication required for all operations
- Guild-specific subscription management
- Secure API endpoints

## Troubleshooting

### Common Issues

1. **Webhook signature verification failed**
   - **Error**: "No signatures found matching the expected signature for payload"
   - **Solution**: 
     - Verify `STRIPE_WEBHOOK_SECRET` matches the secret from Stripe Dashboard or CLI
     - Ensure webhook endpoint uses `express.raw({ type: 'application/json' })` middleware
     - Check that request body is not being modified before signature verification
     - Use debug endpoint: `POST /api/stripe/webhook/debug` to inspect request details

2. **Webhook not receiving events**
   - Check webhook URL is correct
   - Verify webhook secret matches
   - Check server logs for errors
   - Test with Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

3. **Checkout not working**
   - Verify publishable key is correct
   - Check browser console for errors
   - Ensure API endpoints are accessible

4. **Billing portal not working**
   - **Error**: "No configuration provided"
   - **Solution**: Configure customer portal in Stripe Dashboard
   - Go to: https://dashboard.stripe.com/test/settings/billing/portal
   - Click "Activate test link" to create default configuration

5. **Subscription not updating**
   - Check webhook handlers
   - Verify Firebase permissions
   - Check server logs

### Testing Webhook Signature Verification

1. **Test with Stripe CLI**:
   ```bash
   # Forward webhooks to your local server
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   
   # Trigger a test event
   stripe trigger checkout.session.completed
   ```

2. **Debug endpoint**:
   ```bash
   # Test webhook signature verification
   curl -X POST http://localhost:3000/api/stripe/webhook/debug \
     -H "Content-Type: application/json" \
     -H "Stripe-Signature: t=1234567890,v1=test_signature" \
     -d '{"test": "data"}'
   ```

3. **Check logs**:
   - Look for "Webhook event verified" messages
   - Check signature and body length in logs
   - Verify endpoint secret is loaded correctly

### Debug Mode

Enable debug logging by setting:

```bash
DEBUG=stripe:*
```

## Support

For issues with this integration:

1. Check the logs in your server console
2. Verify all environment variables are set
3. Test with Stripe's test mode first
4. Check Stripe Dashboard for webhook delivery status
