import express from "express";
import path from "path";
import cors from "cors";
import { commands } from "../../utils/commands.js";
import { parseRoutes, getRoutes } from "../middlewares/routeCapturer.js";
import { ClerkExpressWithAuth } from "@clerk/clerk-sdk-node";
import { getAuth } from "@clerk/express";
import "dotenv/config";
import Clerk from "../../utils/clerk.js";
import ResponseBase from "../../utils/responses.js";
import { getGuildsByOwnerOrUser } from "../../database/repository.js";
import { config } from "dotenv";
import rateLimit from "express-rate-limit";
import { Logger } from "../../utils/logger.js";

config();

export const createServer = (client) => {

  const app = express();

  const port = process.env.PORT || 3000;

  const PREFIX = "Express.js";

  // start clerk
  const { users } = new Clerk().getInstance();

  const limiter = rateLimit({
    windowMs: parseInt(process.env.MAX_REQ_TIME, 10),
    max: parseInt(process.env.LIMIT_REQUESTS, 10)
  });

  // test
  app.set('trust proxy', parseInt(process.env.TRUST_PROXY, 10))
  app.get('/ip', (request, response) => {
    const clientIp = request.headers['true-client-ip'] || request.headers['x-forwarded-for'] || request.ip;
    new Logger().log(PREFIX, clientIp);
    response.send(clientIp);
  })

  app.get('/debug', (req, res) => {
    const debugInfo = {
        'Original IP': req.ip,
        'X-Forwarded-For': req.headers['x-forwarded-for'],
        'All Headers': req.headers,
        'Trust Proxy Setting': app.get('trust proxy')
    };
    new Logger().log(PREFIX, debugInfo);
    res.json(debugInfo); // Send the debug info as JSON
  });
  
  app.use(
    cors({
      origin: process.env.ENV === 'dev' ? "*" : "https://www.tldkp.online",
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      optionsSuccessStatus: 200
    })
  );

  // Serve static files from the React app build
  const __dirname = path.resolve();
  app.use(express.static(path.join(__dirname, "frontend", "build")));

  // Create a router for your /api routes
  const apiRouter = express.Router();
  apiRouter.use(express.json());

  apiRouter.use(
    cors({
      origin: process.env.ENV === 'dev' ? "*" : "https://www.tldkp.online",
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
      optionsSuccessStatus: 200
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
          commandCategory: command.commandCategory
        }))
      );
    },
    "Endpoint that shows all the commands from the bot service"
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

  // Clerk middleware
  apiRouter.use(ClerkExpressWithAuth());

  apiRouter.get("/dashboard", async (req, res) => {
    const { userId, sessionId } = getAuth(req);
    const user = await users.getUser(userId);
    const discordAccount = user.externalAccounts?.find(
      (account) => account.provider === "oauth_discord"
    );

    if (!sessionId) {
      return new ResponseBase(res).notAllowed("User is not authenticated");
    }

    if (discordAccount) {
      const externalId = discordAccount.externalId;

      // Gets the data
      await getGuildsByOwnerOrUser(externalId).then(guild => {
        return new ResponseBase(res).success(guild);
      });
    } else {
      return new ResponseBase(res).notFound("No account was found");
    }
  }, "Hold the dashboard data");

  apiRouter.use((err, req, res, next) => {
    return new ResponseBase(res).notAllowed("Unauthenticated!");
  });

  app.use("/api", apiRouter);

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "build", "index.html"));
  });

  app.listen(port, () => {
    new Logger().log(PREFIX, `HTTP Server running on port ${port}`);
  });
};
