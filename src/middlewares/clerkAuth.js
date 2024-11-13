import { getAuth } from "@clerk/express";
import ResponseBase from "../../utils/responses.js";
import Clerk from "../../utils/clerk.js";

export const protectedRouteMiddleware = async (req, res, next) => {
  try {
    const clerk = Clerk.getInstance();
    const { users } = clerk;

    const { userId, sessionId } = getAuth(req);

    // Check if the user is authenticated
    if (!sessionId) {
      return new ResponseBase(res).notAllowed("User is not authenticated");
    }

    // Retrieve the user and their Discord account
    const user = await users.getUser(userId);

    const discordAccount = user.externalAccounts?.find(
      (account) => account.provider === "oauth_discord"
    );

    // Check if a Discord account was found
    if (!discordAccount) {
      return new ResponseBase(res).notAllowed(
        "Sorry this could not be completed"
      );
    }

    const externalId = discordAccount.externalId;

    // Attach the guild data to the request for further handling
    req.userDiscordId = externalId;

    // Proceed to the next middleware or route handler
    next();
  } catch (error) {
    // Handle unexpected errors
    return new ResponseBase(res).error("An error occurred", error);
  }
};
