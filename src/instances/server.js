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
} from "../../database/repository.js";
import "dotenv/config";
import rateLimit from "express-rate-limit";
import { protectedRouteMiddleware } from "../../src/middlewares/clerkAuth.js";
import * as uiRepository from "../../database/repositoryUi.js";
import { validatePostHud } from "../validators/index.js";
import multer from "multer";
import Clerk from "../../utils/clerk.js";
import { uploadFile } from "../../utils/index.js";

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
      origin: process.env.ENV === "dev" ? "*" : "https://www.tldkp.online",
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
      origin: process.env.ENV === "dev" ? "*" : "https://www.tldkp.online",
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
        commands.map((command) => ({
          name: command.name,
          description: command.description,
          options: command.options,
          commandCategory: command.commandCategory,
          new: command.new,
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
      await getGuildsByOwnerOrUser(userDiscordId).then((guild) => {
        return new ResponseBase(res).success(guild);
      });
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
  });

  apiRouter.use((err, req, res, next) => {
    return new ResponseBase(res).notAllowed("Unauthenticated!");
  });

  app.use("/api", apiRouter);

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "build", "index.html"));
  });

  app.listen(port, () => {
    console.log(`[Express] HTTP Server running on port ${port}`);
  });

  return app;
};
