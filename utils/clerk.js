import { config } from "dotenv";
import { createClerkClient } from '@clerk/clerk-sdk-node';

config();

class Clerk {
  static clerkClient = null;

  static async init() {
    if (!Clerk.clerkClient) {
      Clerk.clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY, publishableKey: process.env.CLERK_PUBLISHABLE_KEY });
      console.log('Clerk initialized');
    }
    return Clerk.clerkClient;
  }

  static async getInstance() {
    return await Clerk.init();
  }
}

export default Clerk;