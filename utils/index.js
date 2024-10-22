import { logError } from "../database/repository.js";
/**
 * Updates the DKP value for a user in the provided DKP array.
 * 
 * @param {Array} dkpArray - The array of DKP objects.
 * @param {string} userId - The ID of the user to update.
 * @param {number} amount - The amount to add or set for the user's DKP.
 */
export async function updateDkp(dkpArray, userId, amount, user, serverName, guildDataResponse) {
    const userIndex = dkpArray.findIndex((memberDkp) => memberDkp?.userId === userId);

    const allowBelowZero = guildDataResponse?.togglables?.dkpSystem?.allowBelowZero;
    const allowBelowZeroBoolean = (allowBelowZero && allowBelowZero === true) || allowBelowZero === undefined || allowBelowZero === null;

    // Validate the amount for positive number
    if (!isPositiveNumber(amount) && !allowBelowZeroBoolean) {
      const errorMsg = "The DKP amount must be a positive number.";
      return interaction.reply({ content: errorMsg, ephemeral: true });
    }
  
    if (userIndex !== -1) {
      // Calculate the new DKP value only once
      const currentDkp = dkpArray[userIndex].dkp;
      const newDkpValue = currentDkp + amount;
  
      // If the new DKP value is less than 0, set it to 0
      dkpArray[userIndex].dkp = newDkpValue < 0 ? 0 : newDkpValue;
    } else {
      // Create a new DKP object and add it to the array
      const newDKPObject = { userId, dkp: amount < 0 ? 0 : amount };
      dkpArray.push(newDKPObject);
    }
  
    // Send a private message to the user about the DKP update
    const dmNotifications = guildDataResponse?.togglables?.dkpSystem?.dmNotifications;
    if ((dmNotifications && dmNotifications === true) || dmNotifications === undefined || dmNotifications === null) {
      const message = `Your DKP has been updated to **${dkpArray[userIndex]?.dkp || amount}** in the server **${serverName}**.`;
      try {
        await user.send({ content: message, ephemeral: true });
      } catch (error) {
        const msg = `Could not send DM to user ${userId}`;
        await logError({ name: serverName }, msg, error);
      }
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
export async function setDkp(dkpArray, userId, amount, user, serverName, guildDataResponse) {
  const userIndex = dkpArray.findIndex((memberDkp) => memberDkp?.userId === userId);

  const allowBelowZero = guildDataResponse?.togglables?.dkpSystem?.allowBelowZero;
  const allowBelowZeroBoolean = (allowBelowZero && allowBelowZero === true) || allowBelowZero === undefined || allowBelowZero === null;

  // Validate the amount for positive number
  if (!isPositiveNumber(amount) && !allowBelowZeroBoolean) {
    const errorMsg = "The DKP amount must be a positive number.";
    return interaction.reply({ content: errorMsg, ephemeral: true });
  }

  if (userIndex !== -1) {
      // If the user exists, set their DKP value to the new amount
      dkpArray[userIndex].dkp = amount;
  } else {
      // If the user doesn't exist, create a new DKP object and add it to the array
      const newDKPObject = { userId, dkp: amount };
      dkpArray.push(newDKPObject);
  }

  // Construct the message including the server name
  const dmNotifications = guildDataResponse?.togglables?.dkpSystem?.dmNotifications;
  
  if ((dmNotifications && dmNotifications === true) || dmNotifications === undefined || dmNotifications === null) { 
    const message = `Your DKP has been set to ${amount} in the server **${serverName}**.`;
    try {
        await user.send(message);
    } catch (error) {
        console.error(`Could not send DM to user ${userId}:`, error);
    }
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

export function generateOrigins() {
  const ports = [3000, 5173, 80];
  const routes = ["localhost", "tldkp.online"];
  const methods = ["http", "https"];
  
  const origins = [];

  methods.forEach(method => {
    routes.forEach(route => {
      ports.forEach(port => {
        if (port === 80 && method === "http") {
          origins.push(`${method}://${route}`);
        } else if (port === 443 && method === "https") {
          origins.push(`${method}://${route}`);
        } else {
          origins.push(`${method}://${route}:${port}`);
        }
      });
    });
  });
  return origins;
};