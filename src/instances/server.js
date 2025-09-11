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

      return new ResponseBase(res).success(guildData);
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

  // Data import endpoint
  apiRouter.post("/admin/import/:guildId", upload.single('file'), async (req, res) => {
    const { userDiscordId } = req;
    const { guildId } = req.params;

    if (userDiscordId) {
      const adminDiscordIds = process.env.ADMINS?.split(",");
      const isAdmin = adminDiscordIds.includes(userDiscordId);

      if (isAdmin) {
        try {
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
    }
  },
  "Import member data from CSV file"
  );

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
