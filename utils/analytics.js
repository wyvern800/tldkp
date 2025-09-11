import { Logger } from './logger.js';
import crypto from 'crypto';

const PREFIX = "Analytics";

// Google Analytics configuration
const MEASUREMENT_ID = process.env.GOOGLE_ANALYTICS_MEASUREMENT_ID;
const API_SECRET = process.env.GOOGLE_ANALYTICS_API_SECRET;

/**
 * Hash a string for privacy
 * @param {string} input - String to hash
 * @returns {string} - Hashed string
 */
function hashString(input) {
  if (!input) return '';
  return crypto.createHash('sha256').update(input.toString()).digest('hex').substring(0, 16);
}

/**
 * Send event to Google Analytics
 * @param {string} eventName - Event name
 * @param {string} eventCategory - Event category
 * @param {Object} parameters - Event parameters
 * @param {string} userId - User ID (will be hashed)
 * @param {string} guildId - Guild ID (will be hashed)
 */
async function sendToGoogleAnalytics(eventName, eventCategory, parameters, userId, guildId) {
  if (!MEASUREMENT_ID || !API_SECRET) {
    new Logger().logLocal(PREFIX, 'Google Analytics not configured, skipping event');
    return;
  }

  try {
    const hashedUserId = hashString(userId);
    const hashedGuildId = hashString(guildId);
    
    // Prepare the event data for Google Analytics Measurement Protocol
    const eventData = {
      client_id: hashedUserId, // Use hashed user ID as client ID
      events: [{
        name: eventName,
        params: {
          // Standard GA4 parameters
          event_category: eventCategory,
          // Custom parameters (these will show up in GA4)
          user_id: hashedUserId,
          guild_id: hashedGuildId,
          premium_status: parameters.premiumStatus || 'free',
          event_type: parameters.eventType || eventName,
          success_status: parameters.success ? 'success' : 'failed',
          // Add other parameters with proper naming
          ...Object.fromEntries(
            Object.entries(parameters)
              .filter(([key, value]) => value !== undefined && value !== null)
              .map(([key, value]) => [
                key.replace(/([A-Z])/g, '_$1').toLowerCase(), 
                typeof value === 'object' ? JSON.stringify(value) : value
              ])
          )
        }
      }]
    };

    // Debug: Log the event data being sent
    new Logger().logLocal(PREFIX, `Sending GA event data:`, {
      url: `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET.substring(0, 8)}...`,
      eventData: eventData
    });

    // Send to Google Analytics Measurement Protocol
    const response = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData)
    });

    if (response.ok) {
      new Logger().logLocal(PREFIX, `GA Event sent successfully: ${eventName}`, {
        category: eventCategory,
        userId: hashedUserId,
        guildId: hashedGuildId,
        measurementId: MEASUREMENT_ID
      });
    } else {
      const errorText = await response.text();
      new Logger().logLocal(PREFIX, `Failed to send GA event: ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        measurementId: MEASUREMENT_ID
      });
    }
    
  } catch (error) {
    new Logger().logLocal(PREFIX, 'Failed to send event to Google Analytics', error);
  }
}

/**
 * Track DKP actions for analytics
 * @param {string} action - The action performed
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @param {number} amount - DKP amount
 */
export async function trackDkpAction(action, guildId, userId, amount) {
  new Logger().logLocal(PREFIX, `DKP Action: ${action} - Guild: ${guildId}, User: ${userId}, Amount: ${amount}`);
  
  await sendToGoogleAnalytics('dkp_action', 'dkp', {
    eventType: action,
    amount: amount,
    success: true
  }, userId, guildId);
}

/**
 * Track auction actions for analytics
 * @param {string} action - The action performed
 * @param {string} guildId - Guild ID
 * @param {string} auctionId - Auction ID
 */
export async function trackAuctionAction(action, guildId, auctionId) {
  new Logger().logLocal(PREFIX, `Auction Action: ${action} - Guild: ${guildId}, Auction: ${auctionId}`);
  
  await sendToGoogleAnalytics('auction_action', 'auctions', {
    eventType: action,
    auctionId: auctionId,
    success: true
  }, 'system', guildId);
}

/**
 * Track premium events for analytics
 * @param {string} event - The event type
 * @param {string} guildId - Guild ID
 * @param {Object} data - Event data
 */
export async function trackPremiumEvent(event, guildId, data) {
  new Logger().logLocal(PREFIX, `Premium Event: ${event} - Guild: ${guildId}`, data);
  
  await sendToGoogleAnalytics('premium_event', 'subscriptions', {
    eventType: event,
    premiumStatus: 'premium',
    ...data,
    success: true
  }, data.userId || 'system', guildId);
}

/**
 * Track bot status
 * @param {string} status - Bot status
 * @param {Object} data - Status data
 */
export async function trackBotStatus(status, data) {
  new Logger().logLocal(PREFIX, `Bot Status: ${status}`, data);
  
  await sendToGoogleAnalytics('bot_status', 'system', {
    eventType: status,
    ...data,
    success: true
  }, 'system', 'global');
}

/**
 * Track errors
 * @param {string} error - Error message
 * @param {Object} data - Error data
 */
export async function trackError(error, data) {
  new Logger().logLocal(PREFIX, `Error: ${error}`, data);
  
  await sendToGoogleAnalytics('bot_error', 'errors', {
    eventType: 'error',
    errorMessage: error,
    ...data,
    success: false
  }, data.userId || 'system', data.guildId || 'global');
}

/**
 * Track command usage
 * @param {string} command - Command name
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @param {Object} data - Command data
 */
export async function trackCommand(command, guildId, userId, data) {
  new Logger().logLocal(PREFIX, `Command: ${command} - Guild: ${guildId}, User: ${userId}`, data);
  
  await sendToGoogleAnalytics('discord_command', 'commands', {
    eventType: command,
    executionTime: data.executionTime,
    channelId: data.channelId,
    options: data.options,
    ...data,
    success: data.success !== false
  }, userId, guildId);
}

/**
 * Send a test event to verify GA4 setup
 */
export async function sendTestEvent() {
  new Logger().logLocal(PREFIX, 'Sending test event to Google Analytics');
  
  await sendToGoogleAnalytics('test_event', 'testing', {
    eventType: 'test',
    testMessage: 'Bot analytics test',
    timestamp: new Date().toISOString(),
    success: true
  }, 'test_user', 'test_guild');
}

/**
 * Default analytics object
 */
export const analytics = {
  trackDkpAction,
  trackAuctionAction,
  trackPremiumEvent,
  trackBotStatus,
  trackError,
  trackCommand,
  sendTestEvent
};