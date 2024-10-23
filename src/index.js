import { createBotClient } from "./instances/bot.js";
import { createServer } from "./instances/server.js";
import { config } from "dotenv";
import { start } from "./instances/nodecron.js";
import { setupRealtimeUpdates } from "../utils/realtimeUpdates.js";

config();

await start();

// Start the Discord bot
const client = createBotClient();

client.login(process.env.DISCORD_TOKEN);

setupRealtimeUpdates();

// Start the Express server
createServer(client);
