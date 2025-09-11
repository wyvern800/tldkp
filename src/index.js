import { createBotClient } from "./instances/bot.js";
import { createServer } from "./instances/server.js";
import { config } from "dotenv";
import { start } from "./instances/nodecron.js";
import { setupRealtimeUpdates } from "../utils/realtimeUpdates.js";

config();

let cronStarted = false;
let realTimeUpdatesStarted = false;
let expressServer = null;

if (!cronStarted) {
  await start().then(() => cronStarted = true);
}

// Start the Discord bot
export const client = createBotClient();

client.login(process.env.DISCORD_TOKEN);

if (!realTimeUpdatesStarted) {
  setupRealtimeUpdates();
  realTimeUpdatesStarted = true;
}

// Start the Express server
if (!expressServer) {
  expressServer = createServer(client);
}
