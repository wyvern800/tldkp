import express from "express";
import path from "path";
import cors from "cors";
import { commands } from "../../utils/commands.js";
import { parseRoutes, getRoutes } from "../middlewares/routeCapturer.js";
import { clerkMiddleware } from "@clerk/express";
import "dotenv/config";
import ResponseBase from "../../utils/responses.js";
import {
  getGuildsByOwnerOrUser,
  getAllGuilds,
  getGuildConfig,
  deleteGuild,
  searchGuildsByName,
  updateGuildSubscription,
  getGuildSubscription,
  isGuildPremium,
} from "../../database/repository.js";
import "dotenv/config";
import rateLimit from "express-rate-limit";
import { protectedRouteMiddleware } from "../../src/middlewares/clerkAuth.js";
import * as uiRepository from "../../database/repositoryUi.js";
import { validatePostHud } from "../validators/index.js";
import multer from "multer";
import Clerk from "../../utils/clerk.js";
import { uploadFile } from "../../utils/index.js";
import { getPermissionVerbose } from "../../utils/commands.js";
import { Logger } from "../../utils/logger.js";
import { db, admin } from "../../database/firebase.js";
import { trackPremiumEvent } from "../../utils/analytics.js";
import StripeService from "../../utils/stripe.js";

export const createServer = (client) => {
  const app = express();

  const clerkClient = Clerk.getInstance();

  const port = process.env.PORT || 3000;

  const storage = multer.memoryStorage();
  const upload = multer({ storage });

  // Initialize the storage bucket


  const limiter = rateLimit({
    windowMs: parseInt(process.env.MAX_REQ_TIME, 10),
    max: parseInt(process.env.LIMIT_REQUESTS, 10),
  });

  // test
  app.set("trust proxy", parseInt(process.env.TRUST_PROXY, 10));

  // Mount webhook routes BEFORE any JSON parsing middleware
  // This ensures raw body is available for signature verification
  app.use("/api/stripe/webhook", (req, res, next) => {
    let rawBody = '';
    
    req.on('data', (chunk) => {
      rawBody += chunk.toString();
    });
    
    req.on('end', () => {
      // Store the raw body as a Buffer for signature verification
      req.rawBody = Buffer.from(rawBody, 'utf8');
      webhookRouter(req, res, next);
    });
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  /*app.get('/ip', (request, response) => {
    const clientIp = request.headers['true-client-ip'] || request.headers['x-forwarded-for'] || request.ip;
    console.log('Client IP:', clientIp);
    response.send(clientIp);
  })

  app.get('/debug', (req, res) => {
    const debugInfo = {
        'Original IP': req.ip,
        'X-Forwarded-For': req.headers['x-forwarded-for'],
        'All Headers': req.headers,
        'Trust Proxy Setting': app.get('trust proxy')
    };
    console.log(debugInfo);
    res.json(debugInfo); // Send the debug info as JSON
  });*/

  app.use(
    cors({
      origin: process.env.ENV === "dev" ? "*" : "https://www.tldkp.org",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      optionsSuccessStatus: 200,
    })
  );

  // Create webhook router and define routes BEFORE mounting
  const webhookRouter = express.Router();

  // Webhook handler functions
  async function handleCheckoutCompleted(session) {
    const guildId = session.metadata.guildId;
    if (!guildId) return;

    try {
      const subscription = await StripeService.getSubscription(session.subscription);
      const expiresAt = new Date(subscription.current_period_end * 1000);
      await updateGuildSubscription(guildId, true, expiresAt, 'premium');

      // Track analytics
      await trackPremiumEvent({
        event: 'subscription_created',
        guildId: guildId,
        subscriptionId: subscription.id
      });

      new Logger().log('Stripe', `Checkout completed for guild ${guildId}`);
    } catch (error) {
      new Logger().error('Stripe', `Error handling checkout completion: ${error.message}`);
    }
  }

  async function handleSubscriptionCreated(subscription) {
    const guildId = subscription.metadata.guildId;
    if (!guildId) return;

    try {
      const expiresAt = new Date(subscription.current_period_end * 1000);
      await updateGuildSubscription(guildId, true, expiresAt, 'premium');

      new Logger().log('Stripe', `Subscription created for guild ${guildId}`);
    } catch (error) {
      new Logger().error('Stripe', `Error handling subscription creation: ${error.message}`);
    }
  }

  async function handleSubscriptionUpdated(subscription) {
    const guildId = subscription.metadata.guildId;
    if (!guildId) return;

    try {
      const isActive = subscription.status === 'active';
      const isCanceled = subscription.status === 'canceled' || subscription.status === 'cancelled';
      
      if (isCanceled) {
        // Handle subscription cancellation
        await updateGuildSubscription(guildId, false, null, 'free');
        
        // Track analytics
        await trackPremiumEvent({
          event: 'subscription_cancelled',
          guildId: guildId,
          subscriptionId: subscription.id
        });
        
        new Logger().log('Stripe', `Subscription cancelled for guild ${guildId}`);
      } else {
        // Handle active subscription
        const expiresAt = isActive ? new Date(subscription.current_period_end * 1000) : null;
        await updateGuildSubscription(guildId, isActive, expiresAt, 'premium');
        
        new Logger().log('Stripe', `Subscription updated for guild ${guildId}: ${subscription.status}`);
      }
    } catch (error) {
      new Logger().error('Stripe', `Error handling subscription update: ${error.message}`);
    }
  }

  async function handleSubscriptionDeleted(subscription) {
    const guildId = subscription.metadata.guildId;
    if (!guildId) return;

    try {
      await updateGuildSubscription(guildId, false, null, 'free');

      // Track analytics
      await trackPremiumEvent({
        event: 'subscription_cancelled',
        guildId: guildId,
        subscriptionId: subscription.id
      });

      new Logger().log('Stripe', `Subscription cancelled for guild ${guildId}`);
    } catch (error) {
      new Logger().error('Stripe', `Error handling subscription deletion: ${error.message}`);
    }
  }

  async function handlePaymentSucceeded(invoice) {
    const subscription = await StripeService.getSubscription(invoice.subscription);
    const guildId = subscription.metadata.guildId;
    
    if (!guildId) return;

    try {
      const expiresAt = new Date(subscription.current_period_end * 1000);
      await updateGuildSubscription(guildId, true, expiresAt, 'premium');

      new Logger().log('Stripe', `Payment succeeded for guild ${guildId}`);
    } catch (error) {
      new Logger().error('Stripe', `Error handling payment success: ${error.message}`);
    }
  }

  async function handlePaymentFailed(invoice) {
    const subscription = await StripeService.getSubscription(invoice.subscription);
    const guildId = subscription.metadata.guildId;
    
    if (!guildId) return;

    try {
      // Track analytics
      await trackPremiumEvent({
        event: 'payment_failed',
        guildId: guildId,
        subscriptionId: subscription.id
      });

      new Logger().log('Stripe', `Payment failed for guild ${guildId}`);
    } catch (error) {
      new Logger().error('Stripe', `Error handling payment failure: ${error.message}`);
    }
  }

  // Webhook debug endpoint (for testing signature verification)
  webhookRouter.post("/debug", async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const rawBody = req.rawBody;
    const rawBodyString = rawBody ? rawBody.toString('utf8') : '';

    return new ResponseBase(res).success({
      hasSignature: !!sig,
      hasSecret: !!endpointSecret,
      bodyType: typeof rawBody,
      isBuffer: Buffer.isBuffer(rawBody),
      bodyLength: rawBody ? rawBody.length : 0,
      bodyStringLength: rawBodyString.length,
      bodyPreview: rawBodyString.substring(0, 100),
      signature: sig,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });
  });

  // Simple test endpoint that returns immediately
  webhookRouter.post("/test", async (req, res) => {
    new Logger().log('Stripe', 'Webhook test endpoint called');
    return res.json({ 
      message: 'Webhook test endpoint working',
      timestamp: new Date().toISOString()
    });
  });
  
  webhookRouter.post("/", async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    new Logger().log('Stripe', `Webhook received: ${req.method} ${req.url}`);
    new Logger().log('Stripe', `Signature header: ${sig}`);
    new Logger().log('Stripe', `Content-Type: ${req.headers['content-type']}`);

    if (!endpointSecret) {
      new Logger().error('Stripe', 'Webhook secret not configured');
      return res.status(400).send('Webhook secret not configured');
    }

    if (!sig) {
      new Logger().error('Stripe', 'No Stripe signature found in headers');
      return res.status(400).send('No Stripe signature found');
    }

    // Get raw body for signature verification
    const rawBody = req.rawBody;
    new Logger().log('Stripe', `Raw body type: ${typeof rawBody}, isBuffer: ${Buffer.isBuffer(rawBody)}, length: ${rawBody ? rawBody.length : 'undefined'}`);
    
    // Convert Buffer to string for Stripe signature verification
    const rawBodyString = rawBody.toString('utf8');
    new Logger().log('Stripe', `Raw body string length: ${rawBodyString.length}`);

    let event;

    try {
      event = StripeService.getInstance().webhooks.constructEvent(rawBodyString, sig, endpointSecret);
      new Logger().log('Stripe', `Webhook event verified: ${event.type}`);
    } catch (err) {
      new Logger().error('Stripe', `Webhook signature verification failed: ${err.message}`);
      new Logger().error('Stripe', `Signature: ${sig}`);
      new Logger().error('Stripe', `Body length: ${rawBodyString.length}`);
      new Logger().error('Stripe', `Body preview: ${rawBodyString.substring(0, 100)}...`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Set a timeout for the webhook processing
    const timeout = setTimeout(() => {
      new Logger().error('Stripe', 'Webhook processing timeout');
      if (!res.headersSent) {
        res.status(500).json({ error: 'Webhook processing timeout' });
      }
    }, 10000); // 10 second timeout

    try {
      // Handle the event
      new Logger().log('Stripe', `Processing webhook event: ${event.type}`);
      switch (event.type) {
        case 'checkout.session.completed':
          new Logger().log('Stripe', 'Handling checkout.session.completed');
          await handleCheckoutCompleted(event.data.object);
          break;
        case 'customer.subscription.created':
          new Logger().log('Stripe', 'Handling customer.subscription.created');
          await handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          new Logger().log('Stripe', 'Handling customer.subscription.updated');
          await handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          new Logger().log('Stripe', 'Handling customer.subscription.deleted');
          await handleSubscriptionDeleted(event.data.object);
          break;
        case 'customer.subscription.cancelled':
          new Logger().log('Stripe', 'Handling customer.subscription.cancelled');
          await handleSubscriptionDeleted(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          new Logger().log('Stripe', 'Handling invoice.payment_succeeded');
          await handlePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          new Logger().log('Stripe', 'Handling invoice.payment_failed');
          await handlePaymentFailed(event.data.object);
          break;
        default:
          new Logger().log('Stripe', `Unhandled event type: ${event.type}`);
          new Logger().log('Stripe', `Event data: ${JSON.stringify(event.data, null, 2)}`);
      }

      clearTimeout(timeout);
      new Logger().log('Stripe', `Webhook processed successfully: ${event.type}`);
      res.json({ received: true });
    } catch (error) {
      clearTimeout(timeout);
      new Logger().error('Stripe', `Webhook handler error: ${error.message}`);
      new Logger().error('Stripe', `Error stack: ${error.stack}`);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Webhook handler failed' });
      }
    }
  });

  // Webhook middleware is now mounted earlier in the middleware chain

  // Serve static files from the React app build
  const __dirname = path.resolve();
  app.use(express.static(path.join(__dirname, "frontend", "build")));

  // Create a router for your /api routes
  const apiRouter = express.Router();
  apiRouter.use(express.json());
  apiRouter.use(express.urlencoded({ extended: true }));

  apiRouter.use(
    cors({
      origin: process.env.ENV === "dev" ? "*" : "https://www.tldkp.org",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      optionsSuccessStatus: 200,
    })
  );

  // Middleware to parse the routes to display as default endpoint
  parseRoutes(apiRouter);

  apiRouter.get(
    "/",
    (req, res) => {
      res.status(200).json(getRoutes());
    },
    "Endpoint that shows all the api endpoints"
  );

  apiRouter.get(
    "/commands",
    (req, res) => {
      return new ResponseBase(res).success(
        commands
          .filter((command) => !command.isHidden) // Filter out hidden commands
          .map((command) => ({
          name: command.name,
          description: command.description,
          options: command.options,
          commandCategory: command.commandCategory,
          new: command.new,
          permissions: command?.permissions?.length ? command.permissions.map(permission => getPermissionVerbose(permission)) : []
        }))
      );
    },
    "Endpoint that shows all the commands from the bot service"
  );

  apiRouter.get(
    "/huds",
    async (req, res) => {
      const { limit = 10, cursor = null } = req.query;
      const parsedLimit = parseInt(limit, 10);
      const parsedCursor = parseInt(cursor, 10);

      try {
        const hudsData = await uiRepository.getAllHUDS(parsedLimit, parsedCursor); 
        return new ResponseBase(res).success(hudsData);
      } catch (err) {
        console.log(err)
        return new ResponseBase(res).notFound("HUDs not found");
      }
    },
    "Endpoint that shows all the HUDs from the database"
  );

  apiRouter.get(
    "/health",
    (req, res) => {
      if (client) {
        const status = client.user.presence.status; // Get the bot's status
        if (status === "online") {
          return new ResponseBase(res).success("Bot is healthy");
        } else {
          return new ResponseBase(res).error("Bot is unhealthy!");
        }
      } else {
        return new ResponseBase(res).successEmpty();
      }
    },
    "Endpoint that shows bot status"
  );

  // Public Stripe endpoints (no authentication required)
  apiRouter.get("/stripe/products", async (req, res) => {
    try {
      const products = await StripeService.getProducts();
      return new ResponseBase(res).success(products);
    } catch (error) {
      new Logger().error('Stripe', `Error getting products: ${error.message}`);
      return new ResponseBase(res).error("Failed to get products");
    }
  },
  "Get available Stripe products and prices"
  );

  // Test webhook endpoint (no authentication required)
  apiRouter.get("/stripe/webhook-test", async (req, res) => {
    new Logger().log('Stripe', 'Webhook test endpoint accessed');
    return new ResponseBase(res).success({ 
      message: 'Webhook endpoint is accessible',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  },
  "Test webhook endpoint accessibility"
  );

  // Duplicate webhook routes removed - now defined earlier in the middleware chain

  apiRouter.use(limiter);

  // clerkMiddleware is required to be set in the middleware chain before req.auth is used
  apiRouter.use(clerkMiddleware({ clerkClient }));

  // Protected route middleware
  apiRouter.use(protectedRouteMiddleware);

  // File upload middleware
  apiRouter.use(
    "/huds",
    upload.fields([
      { name: "screenshots[]", minCount: 1, maxCount: 3 },
      { name: "interfaceFile", minCount: 1, maxCount: 1 },
    ])
  );
  apiRouter.post("/huds", async (req, res) => {
    const { userDiscordId } = req;
    const { title, description } = req.body;

    if (userDiscordId) {
      const { interfaceFile } = req.files;
      let screenshots = req.files["screenshots[]"];

      const formData = req.body;

      if (!title || !description) {
        return new ResponseBase().error("Title or description missing");
      }

      if (!interfaceFile || !interfaceFile[0]) {
        return new ResponseBase().error("No interface file uploaded");
      }

      if (!screenshots?.length) {
        return new ResponseBase().error("No screenshots uploaded");
      }

      const fileBuffer = interfaceFile[0]?.buffer;
      const fileContent = fileBuffer.toString("utf-16le");

      let body;
      try {
        // Remove BOM if present
        const cleanedContent = fileContent.replace(/^\uFEFF/, "");
        body = JSON.parse(cleanedContent);
      } catch (error) {
        return new ResponseBase(res).badRequest(
          "Invalid JSON in interfaceFile"
        );
      }

      const valid = validatePostHud(body);

      if (!valid) {
        return new ResponseBase(res).badRequest("Invalid interfaceFile");
      }

      const screenshotsUploaded = await Promise.all(
        screenshots.map(async (screenshot) => await uploadFile("screenshots", screenshot))
      ).then((values) => values);

      const interfaceFileUploaded = await uploadFile("huds", interfaceFile[0]).then((value) => value);

      if (screenshotsUploaded.length !== screenshots.length) {
        return new ResponseBase(res).error("Error uploading screenshots");
      }

      if (!interfaceFileUploaded) {
        return new ResponseBase(res).error("Error uploading interfaceFile");
      }

      const newHUD = {
        screenshots: screenshotsUploaded,
        interfaceFile: interfaceFileUploaded,
        stars: 0,
        downloads: 0,
        title,
        description,
        userId: userDiscordId,
      };

      const huds = await uiRepository.createHUD(newHUD);
      if (huds) {
        return new ResponseBase(res).success(formData);
      } else {
        return new ResponseBase(res).error("Something unexpected happened");
      }
    } else {
      return res.status(400).json({ error: "userDiscordId missing" });
    }
  });

  apiRouter.get("/dashboard", async (req, res) => {
    const { userDiscordId } = req;

    // Gets the data
    if (userDiscordId) {
      await getGuildsByOwnerOrUser(userDiscordId, client).then((guild) => {
        return new ResponseBase(res).success(guild);
      });
    }
  });

  apiRouter.get("/guilds/:guildId", async (req, res) => {
    const { userDiscordId } = req;
    const { guildId } = req.params;

    if (!userDiscordId) {
      return new ResponseBase(res).notAllowed("Unauthorized");
    }

    try {
      // Get guild data
      const guildData = await getGuildConfig(guildId);
      
      if (!guildData) {
        return new ResponseBase(res).notFound("Guild not found");
      }

      // Check if user is owner or member
      const isOwner = guildData.guildData?.ownerId === userDiscordId;
      const isMember = guildData.memberDkps?.some(member => member.userId === userDiscordId);
      
      if (!isOwner && !isMember) {
        return new ResponseBase(res).notAllowed("You don't have access to this guild");
      }

      return new ResponseBase(res).success({
        ...guildData,
        userDiscordId: userDiscordId
      });
    } catch (error) {
      console.error('Error fetching guild data:', error);
      return new ResponseBase(res).error("Failed to fetch guild data");
    }
  });

  apiRouter.delete("/guilds/:guildId", async (req, res) => {
    const { userDiscordId } = req;
    const { guildId } = req.params;

    if (!userDiscordId) {
      return new ResponseBase(res).notAllowed("Unauthorized");
    }

    try {
      // Get guild data to check ownership
      const guildData = await getGuildConfig(guildId);
      
      if (!guildData) {
        return new ResponseBase(res).notFound("Guild not found");
      }

      // Check if user is owner
      if (guildData.guildData.ownerId !== userDiscordId) {
        return new ResponseBase(res).notAllowed("Only guild owner can delete the guild");
      }

      // Delete guild
      await deleteGuild(guildId);
      return new ResponseBase(res).success({ message: "Guild deleted successfully" });
    } catch (error) {
      console.error("Error deleting guild:", error);
      return new ResponseBase(res).error("Failed to delete guild");
    }
  });

  apiRouter.get("/admin", async (req, res) => {
    const { userDiscordId } = req;

    if (userDiscordId) {
      const adminDiscordIds = process.env.ADMINS?.split(",");
      const isAdmin = adminDiscordIds.includes(userDiscordId);

      const allGuilds = await getAllGuilds();

      if (isAdmin) {
        return new ResponseBase(res).success({ isAdmin, guilds: allGuilds });
      } else {
        return new ResponseBase(res).notAllowed("Unauthorized");
      }
    }
  },
  "Admin endpoint to get all guilds and admin status"
  );

  // Subscription management endpoints
  apiRouter.get("/admin/subscriptions/search", async (req, res) => {
    const { userDiscordId } = req;
    const { search_term, limit = 10 } = req.query;

    if (userDiscordId) {
      const adminDiscordIds = process.env.ADMINS?.split(",");
      const isAdmin = adminDiscordIds.includes(userDiscordId);

      if (isAdmin) {
        try {
          const guilds = await searchGuildsByName(search_term, parseInt(limit));
          return new ResponseBase(res).success({ guilds });
        } catch (error) {
          return new ResponseBase(res).error("Failed to search guilds");
        }
      } else {
        return new ResponseBase(res).notAllowed("Unauthorized");
      }
    }
  },
  "Search guilds by name for subscription management"
  );

  apiRouter.get("/admin/subscriptions/:guildId", async (req, res) => {
    const { userDiscordId } = req;
    const { guildId } = req.params;

    if (userDiscordId) {
      const adminDiscordIds = process.env.ADMINS?.split(",");
      const isAdmin = adminDiscordIds.includes(userDiscordId);

      if (isAdmin) {
        try {
          const subscription = await getGuildSubscription(guildId);
          const guildConfig = await getGuildConfig(guildId, 'admin-subscription-check');
          
          if (!guildConfig) {
            return new ResponseBase(res).notFound("Guild not found");
          }

          return new ResponseBase(res).success({ 
            subscription,
            guild: {
              id: guildConfig.guildData.id,
              name: guildConfig.guildData.name,
              ownerId: guildConfig.guildData.ownerId,
              icon: guildConfig.guildData.icon
            }
          });
        } catch (error) {
          return new ResponseBase(res).error("Failed to get subscription info");
        }
      } else {
        return new ResponseBase(res).notAllowed("Unauthorized");
      }
    }
  },
  "Get subscription info for a specific guild"
  );

  apiRouter.put("/admin/subscriptions/:guildId", async (req, res) => {
    const { userDiscordId } = req;
    const { guildId } = req.params;
    const { isPremium, expiresAt, planType } = req.body;

    if (userDiscordId) {
      const adminDiscordIds = process.env.ADMINS?.split(",");
      const isAdmin = adminDiscordIds.includes(userDiscordId);

      if (isAdmin) {
        try {
          // Validate guild exists
          const guildConfig = await getGuildConfig(guildId, 'admin-subscription-update');
          if (!guildConfig) {
            return new ResponseBase(res).notFound("Guild not found");
          }

          // Parse expiration date if provided
          let parsedExpiresAt = null;
          if (expiresAt) {
            parsedExpiresAt = new Date(expiresAt);
            if (isNaN(parsedExpiresAt.getTime())) {
              return new ResponseBase(res).badRequest("Invalid date format");
            }
          }

          // Update subscription
          await updateGuildSubscription(guildId, isPremium, parsedExpiresAt, planType);

          // Get updated subscription info
          const updatedSubscription = await getGuildSubscription(guildId);

          return new ResponseBase(res).success({ 
            message: "Subscription updated successfully",
            subscription: updatedSubscription,
            guild: {
              id: guildConfig.guildData.id,
              name: guildConfig.guildData.name,
              ownerId: guildConfig.guildData.ownerId,
              icon: guildConfig.guildData.icon
            }
          });
        } catch (error) {
          return new ResponseBase(res).error("Failed to update subscription");
        }
      } else {
        return new ResponseBase(res).notAllowed("Unauthorized");
      }
    }
  },
  "Update subscription for a specific guild"
  );

  apiRouter.get("/admin/subscriptions", async (req, res) => {
    const { userDiscordId } = req;
    const { page = 1, limit = 20, search = "", status = "all" } = req.query;

    if (userDiscordId) {
      const adminDiscordIds = process.env.ADMINS?.split(",");
      const isAdmin = adminDiscordIds.includes(userDiscordId);

      if (isAdmin) {
        try {
          let guilds = await getAllGuilds();
          
          // Filter by search term if provided
          if (search) {
            const searchLower = search.toLowerCase();
            guilds = guilds.filter(guild => 
              guild.guildData?.name?.toLowerCase().includes(searchLower)
            );
          }

          // Filter by subscription status
          if (status !== "all") {
            guilds = guilds.filter(guild => {
              const subscription = guild.subscription || { isPremium: false, expiresAt: null, planType: 'free' };
              
              if (status === "premium") {
                return subscription.isPremium && (subscription.planType === 'lifetime' || 
                  (subscription.expiresAt && subscription.expiresAt.toDate() > new Date()));
              } else if (status === "expired") {
                return subscription.isPremium && subscription.expiresAt && 
                  subscription.expiresAt.toDate() <= new Date();
              } else if (status === "free") {
                return !subscription.isPremium;
              }
              return true;
            });
          }

          // Pagination
          const startIndex = (parseInt(page) - 1) * parseInt(limit);
          const endIndex = startIndex + parseInt(limit);
          const paginatedGuilds = guilds.slice(startIndex, endIndex);

          // Add subscription status to each guild
          const guildsWithStatus = paginatedGuilds.map(guild => ({
            ...guild,
            subscriptionStatus: guild.subscription ? {
              isPremium: guild.subscription.isPremium,
              expiresAt: guild.subscription.expiresAt ? guild.subscription.expiresAt.toDate() : null,
              planType: guild.subscription.planType,
              isActive: guild.subscription.isPremium && (
                guild.subscription.planType === 'lifetime' || 
                (guild.subscription.expiresAt && guild.subscription.expiresAt.toDate() > new Date())
              )
            } : {
              isPremium: false,
              expiresAt: null,
              planType: 'free',
              isActive: false
            }
          }));

          return new ResponseBase(res).success({
            guilds: guildsWithStatus,
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: guilds.length,
              totalPages: Math.ceil(guilds.length / parseInt(limit))
            }
          });
        } catch (error) {
          return new ResponseBase(res).error("Failed to get subscriptions");
        }
      } else {
        return new ResponseBase(res).notAllowed("Unauthorized");
      }
    }
  },
  "Get all guilds with subscription status and pagination"
  );

  // Analytics tracking endpoint
  apiRouter.post("/analytics/track", async (req, res) => {
    const { userDiscordId } = req;
    const { event, category, guildId, userId, data } = req.body;

    if (userDiscordId) {
      try {
        // Track the analytics event
        await trackPremiumEvent(event, guildId, {
          userId: userId || userDiscordId,
          category: category,
          ...data,
          success: event.includes('success')
        });

        return new ResponseBase(res).success("Analytics event tracked");
      } catch (error) {
        console.error('Analytics tracking error:', error);
        return new ResponseBase(res).error("Failed to track analytics event");
      }
    } else {
      return new ResponseBase(res).notAllowed("User is not authenticated");
    }
  },
  "Track analytics events"
  );

  // Data import endpoint
  apiRouter.use("/admin/import/:guildId", upload.single('file'));
  apiRouter.post("/admin/import/:guildId", async (req, res) => {
    const { userDiscordId } = req;
    const { guildId } = req.params;

    if (userDiscordId) {
      const adminDiscordIds = process.env.ADMINS?.split(",");
      const isAdmin = adminDiscordIds.includes(userDiscordId);

      if (isAdmin) {
        try {
          // Check if guild is premium
          const isPremium = await isGuildPremium(guildId);
          if (!isPremium) {
            return new ResponseBase(res).error("Data importing is a premium feature. This guild does not have an active premium subscription.");
          }

          if (!req.file) {
            return new ResponseBase(res).error("No file provided");
          }

          // Check file type
          if (!req.file.originalname.toLowerCase().endsWith('.csv')) {
            return new ResponseBase(res).error("Please provide a CSV file (.csv extension)");
          }

          // Parse CSV content
          const csvContent = req.file.buffer.toString('utf8');
          const lines = csvContent.split('\n').filter(line => line.trim());
          
          if (lines.length < 2) {
            return new ResponseBase(res).error("CSV file is empty or invalid");
          }

          // Validate header
          const header = lines[0].toLowerCase().trim();
          const expectedHeader = 'discord_user_id,ign,dkp';
          if (header !== expectedHeader) {
            return new ResponseBase(res).error(`Invalid CSV format. Expected header: ${expectedHeader}, Found: ${header}`);
          }

          // Parse data rows
          const members = [];
          const errors = [];
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const columns = line.split(',');
            if (columns.length !== 3) {
              errors.push(`Row ${i + 1}: Invalid number of columns (expected 3, found ${columns.length})`);
              continue;
            }

            const [discordUserId, ign, dkpStr] = columns.map(col => col.trim());
            
            // Validate Discord User ID
            if (!discordUserId || !/^\d{17,19}$/.test(discordUserId)) {
              errors.push(`Row ${i + 1}: Invalid Discord User ID: ${discordUserId}`);
              continue;
            }

            // Validate DKP
            const dkp = parseInt(dkpStr);
            if (isNaN(dkp) || dkp < 0) {
              errors.push(`Row ${i + 1}: Invalid DKP amount: ${dkpStr}`);
              continue;
            }

            // Validate IGN (optional)
            const cleanIGN = ign && ign !== '' ? ign.trim() : null;
            if (cleanIGN && (cleanIGN.length < 2 || cleanIGN.length > 20)) {
              errors.push(`Row ${i + 1}: Invalid IGN length: ${cleanIGN} (must be 2-20 characters)`);
              continue;
            }

            members.push({
              userId: discordUserId,
              ign: cleanIGN,
              dkp: dkp
            });
          }

          // Check limits
          if (members.length > 100) {
            return new ResponseBase(res).error("Too many members. Maximum 100 members per import");
          }

          if (members.length === 0) {
            return new ResponseBase(res).error("No valid member data found in the CSV file");
          }

          // Show errors if any
          if (errors.length > 0) {
            return new ResponseBase(res).error(`Found ${errors.length} error(s) in the CSV file: ${errors.slice(0, 5).join(', ')}${errors.length > 5 ? `... and ${errors.length - 5} more errors` : ''}`);
          }

          // Get current guild data
          const guildDataResponse = await getGuildConfig(guildId, 'web-import-member-data');
          const currentMemberDkps = guildDataResponse.memberDkps || [];

          // Process imports
          let updatedCount = 0;
          let addedCount = 0;
          const newMemberDkps = [...currentMemberDkps];

          for (const member of members) {
            const existingIndex = newMemberDkps.findIndex(m => m.userId === member.userId);
            
            if (existingIndex !== -1) {
              // Update existing member
              newMemberDkps[existingIndex].dkp = member.dkp;
              if (member.ign) {
                newMemberDkps[existingIndex].ign = member.ign;
              }
              updatedCount++;
            } else {
              // Add new member
              newMemberDkps.push({
                userId: member.userId,
                dkp: member.dkp,
                ign: member.ign || null
              });
              addedCount++;
            }
          }

          // Update guild data
          const newGuildData = {
            ...guildDataResponse,
            memberDkps: newMemberDkps,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          await db.collection("guilds").doc(guildId).update(newGuildData);

          return new ResponseBase(res).success({
            addedCount,
            updatedCount,
            totalProcessed: members.length
          });

        } catch (error) {
          console.error('Import error:', error);
          return new ResponseBase(res).error("Failed to import member data");
        }
      } else {
        return new ResponseBase(res).notAllowed("Unauthorized");
      }
    } else {
      return new ResponseBase(res).notAllowed("User is not authenticated");
    }
  },
  "Import member data from CSV file"
  );

  // User subscription endpoint (non-admin)
  apiRouter.get("/subscription/:guildId", async (req, res) => {
    const { userDiscordId } = req;
    const { guildId } = req.params;

    if (!userDiscordId) {
      return new ResponseBase(res).notAllowed("User is not authenticated");
    }

    try {
      // Check if user has access to this guild
      const userGuilds = await getGuildsByOwnerOrUser(userDiscordId);
      const allUserGuilds = [...userGuilds.ownerGuilds, ...userGuilds.memberGuilds];
      const hasAccess = allUserGuilds.some(guild => guild.guildData.id === guildId);
      
      if (!hasAccess) {
        return new ResponseBase(res).notAllowed("You don't have access to this guild");
      }

      const subscription = await getGuildSubscription(guildId);
      return new ResponseBase(res).success(subscription);
    } catch (error) {
      new Logger().error('Subscription', `Error getting subscription: ${error.message}`);
      return new ResponseBase(res).error("Failed to get subscription info");
    }
  },
  "Get subscription info for a specific guild (user access)"
  );

  // Stripe Routes (protected)

  apiRouter.post("/stripe/create-checkout-session", async (req, res) => {
    const { userDiscordId } = req;
    const { priceId, guildId, successUrl, cancelUrl } = req.body;

    if (!userDiscordId) {
      return new ResponseBase(res).notAllowed("User is not authenticated");
    }

    if (!priceId || !guildId || !successUrl || !cancelUrl) {
      return new ResponseBase(res).badRequest("Missing required fields");
    }

    try {
      // Get user info from Clerk
      const clerk = Clerk.getInstance();
      const { users } = clerk;
      const user = await users.getUser(req.auth.userId);
      const email = user.emailAddresses[0]?.emailAddress;

      if (!email) {
        return new ResponseBase(res).badRequest("User email not found");
      }

      // Get or create customer
      let customer = await StripeService.getCustomerByEmail(email);
      if (!customer) {
        customer = await StripeService.createCustomer(email, userDiscordId, guildId);
      }

      // Create checkout session
      const session = await StripeService.createCheckoutSession(
        priceId,
        customer.id,
        guildId,
        successUrl,
        cancelUrl
      );

      return new ResponseBase(res).success({
        sessionId: session.id,
        url: session.url
      });
    } catch (error) {
      new Logger().error('Stripe', `Error creating checkout session: ${error.message}`);
      return new ResponseBase(res).error("Failed to create checkout session");
    }
  },
  "Create Stripe checkout session for subscription"
  );

  apiRouter.post("/stripe/create-billing-portal-session", async (req, res) => {
    const { userDiscordId } = req;
    const { returnUrl } = req.body;

    if (!userDiscordId) {
      return new ResponseBase(res).notAllowed("User is not authenticated");
    }

    if (!returnUrl) {
      return new ResponseBase(res).badRequest("Missing return URL");
    }

    try {
      // Get user info from Clerk
      const clerk = Clerk.getInstance();
      const { users } = clerk;
      const user = await users.getUser(req.auth.userId);
      const email = user.emailAddresses[0]?.emailAddress;

      if (!email) {
        return new ResponseBase(res).badRequest("User email not found");
      }

      // Get customer
      const customer = await StripeService.getCustomerByEmail(email);
      if (!customer) {
        return new ResponseBase(res).notFound("No subscription found");
      }

      // Create billing portal session
      const session = await StripeService.createBillingPortalSession(customer.id, returnUrl);

      return new ResponseBase(res).success({
        url: session.url
      });
    } catch (error) {
      new Logger().error('Stripe', `Error creating billing portal session: ${error.message}`);
      return new ResponseBase(res).error("Failed to create billing portal session");
    }
  },
  "Create Stripe billing portal session"
  );

  // Test endpoint to manually update subscription (for debugging)
  apiRouter.post("/stripe/test-update-subscription", async (req, res) => {
    const { userDiscordId } = req;
    const { guildId, isPremium = true, planType = 'premium' } = req.body;

    if (!userDiscordId) {
      return new ResponseBase(res).notAllowed("User is not authenticated");
    }

    if (!guildId) {
      return new ResponseBase(res).badRequest("Guild ID is required");
    }

    try {
      // Check if user has access to this guild
      const userGuilds = await getGuildsByOwnerOrUser(userDiscordId);
      const allUserGuilds = [...userGuilds.ownerGuilds, ...userGuilds.memberGuilds];
      const hasAccess = allUserGuilds.some(guild => guild.guildData.id === guildId);
      
      if (!hasAccess) {
        return new ResponseBase(res).notAllowed("You don't have access to this guild");
      }

      // Update subscription
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      await updateGuildSubscription(guildId, isPremium, expiresAt, planType);

      // Get updated subscription
      const subscription = await getGuildSubscription(guildId);

      return new ResponseBase(res).success({
        message: "Subscription updated successfully",
        subscription
      });
    } catch (error) {
      new Logger().error('Stripe', `Error updating subscription: ${error.message}`);
      return new ResponseBase(res).error("Failed to update subscription");
    }
  },
  "Test endpoint to manually update subscription"
  );

  // Webhook handlers
  async function handleCheckoutSessionCompleted(session) {
    new Logger().log('Stripe', `handleCheckoutSessionCompleted called with session: ${JSON.stringify(session)}`);
    
    const guildId = session.metadata?.guildId;
    if (!guildId) {
      new Logger().error('Stripe', 'No guildId found in session metadata');
      return;
    }

    new Logger().log('Stripe', `Processing checkout completion for guild: ${guildId}`);

    try {
      // Get subscription details
      const subscription = await StripeService.getSubscription(session.subscription);
      new Logger().log('Stripe', `Retrieved subscription: ${JSON.stringify(subscription)}`);
      
      // Update guild subscription in Firebase
      const expiresAt = new Date(subscription.current_period_end * 1000);
      new Logger().log('Stripe', `Updating guild subscription: guildId=${guildId}, isPremium=true, expiresAt=${expiresAt}, planType=premium`);
      
      await updateGuildSubscription(guildId, true, expiresAt, 'premium');
      new Logger().log('Stripe', `Successfully updated guild subscription in Firebase`);

      // Track analytics
      await trackPremiumEvent({
        event: 'subscription_created',
        guildId: guildId,
        subscriptionId: subscription.id,
        planType: 'premium'
      });

      new Logger().log('Stripe', `Checkout completed successfully for guild ${guildId}`);
    } catch (error) {
      new Logger().error('Stripe', `Error handling checkout completion: ${error.message}`);
      new Logger().error('Stripe', `Error stack: ${error.stack}`);
    }
  }

  async function handleSubscriptionCreated(subscription) {
    const guildId = subscription.metadata.guildId;
    if (!guildId) return;

    try {
      const expiresAt = new Date(subscription.current_period_end * 1000);
      await updateGuildSubscription(guildId, true, expiresAt, 'premium');

      new Logger().log('Stripe', `Subscription created for guild ${guildId}`);
    } catch (error) {
      new Logger().error('Stripe', `Error handling subscription creation: ${error.message}`);
    }
  }

  async function handleSubscriptionUpdated(subscription) {
    const guildId = subscription.metadata.guildId;
    if (!guildId) return;

    try {
      const isActive = subscription.status === 'active';
      const expiresAt = isActive ? new Date(subscription.current_period_end * 1000) : null;
      
      await updateGuildSubscription(guildId, isActive, expiresAt, 'premium');

      new Logger().log('Stripe', `Subscription updated for guild ${guildId}: ${subscription.status}`);
    } catch (error) {
      new Logger().error('Stripe', `Error handling subscription update: ${error.message}`);
    }
  }

  async function handleSubscriptionDeleted(subscription) {
    const guildId = subscription.metadata.guildId;
    if (!guildId) return;

    try {
      await updateGuildSubscription(guildId, false, null, 'free');

      // Track analytics
      await trackPremiumEvent({
        event: 'subscription_cancelled',
        guildId: guildId,
        subscriptionId: subscription.id
      });

      new Logger().log('Stripe', `Subscription cancelled for guild ${guildId}`);
    } catch (error) {
      new Logger().error('Stripe', `Error handling subscription deletion: ${error.message}`);
    }
  }

  async function handlePaymentSucceeded(invoice) {
    const subscription = await StripeService.getSubscription(invoice.subscription);
    const guildId = subscription.metadata.guildId;
    
    if (!guildId) return;

    try {
      const expiresAt = new Date(subscription.current_period_end * 1000);
      await updateGuildSubscription(guildId, true, expiresAt, 'premium');

      new Logger().log('Stripe', `Payment succeeded for guild ${guildId}`);
    } catch (error) {
      new Logger().error('Stripe', `Error handling payment success: ${error.message}`);
    }
  }

  async function handlePaymentFailed(invoice) {
    const subscription = await StripeService.getSubscription(invoice.subscription);
    const guildId = subscription.metadata.guildId;
    
    if (!guildId) return;

    try {
      // Track analytics
      await trackPremiumEvent({
        event: 'payment_failed',
        guildId: guildId,
        subscriptionId: subscription.id
      });

      new Logger().log('Stripe', `Payment failed for guild ${guildId}`);
    } catch (error) {
      new Logger().error('Stripe', `Error handling payment failure: ${error.message}`);
    }
  }

  apiRouter.use((err, req, res, next) => {
    return new ResponseBase(res).notAllowed("Unauthenticated!");
  });

  app.use("/api", apiRouter);

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "build", "index.html"));
  });

  app.listen(port, () => {
    new Logger().log("express", `HTTP Server running on port ${port}`);
  });

  return app;
};
