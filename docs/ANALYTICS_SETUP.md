# Google Analytics Setup for TLDKP bot

This guide will help you set up Google Analytics tracking for your Discord bot events.

## Required Environment Variables

Add these to your `.env` file:

```env
# Google Analytics Configuration
GOOGLE_ANALYTICS_MEASUREMENT_ID=G-KDX4T0ZE4W
GOOGLE_ANALYTICS_API_SECRET=your_api_secret_here
```

## How to Get Your API Secret

1. Go to [Google Analytics](https://analytics.google.com/)
2. Select your property (or create one if you don't have one)
3. Go to **Admin** → **Data Streams** → **Web**
4. Click on your stream
5. Scroll down to **Measurement Protocol API secrets**
6. Click **Create** to generate a new API secret
7. Copy the secret value and add it to your `.env` file

## What Gets Tracked

The bot will automatically track:

### Commands
- All slash command executions
- Command success/failure rates
- Execution times
- Premium vs free guild usage
- Command parameters and options

### Events
- Guild join/leave events
- Member join events
- DKP actions (add, remove, set, transfer)
- Auction actions (create, bid, end)
- Premium subscription changes
- Bot startup and status

### Error Tracking
- Unhandled promise rejections
- Uncaught exceptions
- Command execution errors

## Analytics Data Structure

Events are sent to Google Analytics with the following structure:

- **Event Name**: `discord_command`, `discord_event`, `dkp_action`, `auction_action`, `premium_event`, `bot_status`, `bot_error`
- **Event Category**: `commands`, `events`, `dkp`, `auctions`, `subscriptions`, `system`, `errors`
- **Custom Dimensions**:
  - `dimension1`: User ID
  - `dimension2`: Guild ID
  - `dimension3`: Premium Status (free/premium)
  - `dimension4`: Command/Event Type
  - `dimension5`: Success Status (success/failed)

## Viewing Analytics

1. Go to your Google Analytics dashboard
2. Navigate to **Reports** → **Events**
3. Filter by event name to see specific bot activities
4. Use custom dimensions to segment data by user, guild, or premium status

## Troubleshooting

If events aren't appearing in Google Analytics:

1. Check that your `GOOGLE_ANALYTICS_API_SECRET` is correct
2. Verify your `GOOGLE_ANALYTICS_MEASUREMENT_ID` matches your property
3. Check the bot logs for any analytics errors
4. Note that it can take up to 24 hours for data to appear in Google Analytics

## Privacy Considerations

- User IDs and Guild IDs are hashed for privacy
- No personal messages or sensitive data is tracked
- Only command usage patterns and system events are recorded
- All tracking can be disabled by removing the environment variables
