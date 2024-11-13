import { config } from "dotenv";
import { createClerkClient } from '@clerk/backend';
import { Logger } from "./logger.js";

config();

class Clerk {
  static clerkClient = null;
  
  static init() {
    if (!Clerk.clerkClient) {
      Clerk.clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY, publishableKey: process.env.CLERK_PUBLISHABLE_KEY });
      new Logger().log('Clerk', 'Clerk initialized');
    }
    return Clerk.clerkClient;
  }

  static getInstance() {
    return Clerk.init();
  }
}

export default Clerk;