import { config } from "dotenv";
import { createClerkClient } from '@clerk/clerk-sdk-node';

config();

class Clerk {
  clerkClient;

  constructor() {
    this.clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY, publishableKey: process.env.CLERK_PUBLISHABLE_KEY })
  }

  client() {
    return this.clerkClient;
  }
  
  get getInstance() {
    return this.client;
  }
}

export default Clerk;