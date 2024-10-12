import { logError } from "../database/repository.js";
/**
 * Updates the DKP value for a user in the provided DKP array.
 * 
 * @param {Array} dkpArray - The array of DKP objects.
 * @param {string} userId - The ID of the user to update.
 * @param {number} amount - The amount to add or set for the user's DKP.
 */
export async function updateDkp(dkpArray, userId, amount, user, serverName) {
  const userIndex = dkpArray.findIndex((memberDkp) => memberDkp?.userId === userId);

  if (userIndex !== -1) {
      // Update the existing user's DKP value
      dkpArray[userIndex].dkp += amount;
  } else {
      // Create a new DKP object and add it to the array
      const newDKPObject = { userId, dkp: amount };
      dkpArray.push(newDKPObject);
  }

  // Send a private message to the user about the DKP update
  const message = `Your DKP has been updated to **${dkpArray[userIndex]?.dkp || amount}** in the server **${serverName}**.`;
  try {
      await user.send({ content: message, ephemeral: true });
  } catch (error) {
      const msg = `Could not send DM to user ${userId}`;
      await logError({ name: serverName }, msg, error)
  }
}

/**
 * Sets the DKP value for a user in the provided DKP array and sends a private message.
 * 
 * @param {Array} dkpArray - The array of DKP objects.
 * @param {string} userId - The ID of the user to set the DKP for.
 * @param {number} amount - The amount to set for the user's DKP.
 * @param {User} user - The user object to send a private message.
 * @param {string} serverName - The name of the server (guild) where the DKP was changed.
 */
export async function setDkp(dkpArray, userId, amount, user, serverName) {
  const userIndex = dkpArray.findIndex((memberDkp) => memberDkp?.userId === userId);

  if (userIndex !== -1) {
      // If the user exists, set their DKP value to the new amount
      dkpArray[userIndex].dkp = amount;
  } else {
      // If the user doesn't exist, create a new DKP object and add it to the array
      const newDKPObject = { userId, dkp: amount };
      dkpArray.push(newDKPObject);
  }

  // Construct the message including the server name
  const message = `Your DKP has been set to ${amount} in the server **${serverName}**.`;
  try {
      await user.send(message);
  } catch (error) {
      console.error(`Could not send DM to user ${userId}:`, error);
  }
}

/**
 * Checks if a number is positive.
 * 
 * @param {number} value - The value to check.
 * @returns {boolean} - True if the value is positive, false otherwise.
 */
export function isPositiveNumber(value) {
  return typeof value === "number" && value > 0;
}