import express from "express";
import path from "path";
import cors from "cors";
import { commands } from "../../utils/commands.js";
import { parseRoutes, getRoutes } from "../middlewares/routeCapturer.js";
import { generateOrigins } from "../../utils/index.js";

export const createServer = (client) => {
  const app = express();

  const port = process.env.PORT || 3000;

  app.use(
    cors({
      origin: '*',
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"]
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
      origin: '*',
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"]
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
    "/health",
    (req, res) => {
      if (client) {
        const status = client.user.presence.status; // Get the bot's status
        if (status === "online") {
          res.status(200).send("Bot is healthy!");
        } else {
          res.status(500).send("Bot is unhealthy!");
        }
      } else {
        res.status(200).send("");
      }
    },
    "Endpoint that shows bot status"
  );

  apiRouter.get(
    "/commands",
    (req, res) => {
      return res.status(200).json(
        commands.map((command) => ({
          name: command.name,
          description: command.description,
          options: command.options,
        }))
      );
    },
    "Endpoint that shows all the commands from the bot service"
  );

  app.use("/api", apiRouter);

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "build", "index.html"));
  });

  app.listen(port, () => {
    console.log(`[Express] HTTP Server running on port ${port}`);
  });
};
