import Stripe from 'stripe';
import { Logger } from './logger.js';

class StripeService {
  static stripe = null;
  
  static init() {
    if (!StripeService.stripe) {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY is required');
      }
      
      StripeService.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-12-18.acacia',
      });
      
      new Logger().log('Stripe', 'Stripe service initialized');
    }
    return StripeService.stripe;
  }

  static getInstance() {
    return StripeService.init();
  }

  /**
   * Create a checkout session for subscription or one-time payment
   * @param {string} priceId - Stripe price ID
   * @param {string} customerId - Stripe customer ID
   * @param {string} guildId - Discord guild ID
   * @param {string} successUrl - Success redirect URL
   * @param {string} cancelUrl - Cancel redirect URL
   * @param {boolean} isLifetime - Whether this is a lifetime (one-time) payment
   * @returns {Promise<Object>} Checkout session
   */
  static async createCheckoutSession(priceId, customerId, guildId, successUrl, cancelUrl, isLifetime = false) {
    const stripe = StripeService.getInstance();
    
    try {
      const sessionConfig = {
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: isLifetime ? 'payment' : 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          guildId: guildId,
          planType: isLifetime ? 'lifetime' : 'subscription',
        },
      };

      // Add subscription_data only for recurring subscriptions
      if (!isLifetime) {
        sessionConfig.subscription_data = {
          metadata: {
            guildId: guildId,
          },
        };
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);

      new Logger().log('Stripe', `Checkout session created: ${session.id} (${isLifetime ? 'lifetime' : 'subscription'})`);
      return session;
    } catch (error) {
      new Logger().error('Stripe', `Error creating checkout session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a customer in Stripe
   * @param {string} email - Customer email
   * @param {string} discordId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object>} Customer object
   */
  static async createCustomer(email, discordId, guildId) {
    const stripe = StripeService.getInstance();
    
    try {
      const customer = await stripe.customers.create({
        email: email,
        metadata: {
          discordId: discordId,
          guildId: guildId,
        },
      });

      new Logger().log('Stripe', `Customer created: ${customer.id}`);
      return customer;
    } catch (error) {
      new Logger().error('Stripe', `Error creating customer: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get customer by email
   * @param {string} email - Customer email
   * @returns {Promise<Object|null>} Customer object or null
   */
  static async getCustomerByEmail(email) {
    const stripe = StripeService.getInstance();
    
    try {
      const customers = await stripe.customers.list({
        email: email,
        limit: 1,
      });

      return customers.data.length > 0 ? customers.data[0] : null;
    } catch (error) {
      new Logger().error('Stripe', `Error getting customer by email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get subscription by ID
   * @param {string} subscriptionId - Stripe subscription ID
   * @returns {Promise<Object>} Subscription object
   */
  static async getSubscription(subscriptionId) {
    const stripe = StripeService.getInstance();
    
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      new Logger().error('Stripe', `Error getting subscription: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cancel subscription
   * @param {string} subscriptionId - Stripe subscription ID
   * @returns {Promise<Object>} Cancelled subscription
   */
  static async cancelSubscription(subscriptionId) {
    const stripe = StripeService.getInstance();
    
    try {
      const subscription = await stripe.subscriptions.cancel(subscriptionId);
      new Logger().log('Stripe', `Subscription cancelled: ${subscriptionId}`);
      return subscription;
    } catch (error) {
      new Logger().error('Stripe', `Error cancelling subscription: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create billing portal session
   * @param {string} customerId - Stripe customer ID
   * @param {string} returnUrl - Return URL
   * @returns {Promise<Object>} Portal session
   */
  static async createBillingPortalSession(customerId, returnUrl) {
    const stripe = StripeService.getInstance();
    
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      new Logger().log('Stripe', `Billing portal session created: ${session.id}`);
      return session;
    } catch (error) {
      new Logger().error('Stripe', `Error creating billing portal session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all products with prices
   * @returns {Promise<Array>} Products with prices
   */
  static async getProducts() {
    const stripe = StripeService.getInstance();
    
    try {
      const products = await stripe.products.list({
        active: true,
        expand: ['data.default_price'],
      });

      return products.data;
    } catch (error) {
      new Logger().error('Stripe', `Error getting products: ${error.message}`);
      throw error;
    }
  }
}

export default StripeService;
