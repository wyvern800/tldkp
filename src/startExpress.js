import { createServer } from "./instances/server.js";

import { config } from "dotenv";

config();

// Start the Express server
createServer();