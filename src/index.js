import { createBotClient } from "./instances/bot.js";
import { createServer } from "./instances/server.js";
import { config } from "dotenv";

config();

// Start the Express server
createServer();

// Start the Discord bot
const client = createBotClient();
client.login(process.env.DISCORD_TOKEN);
