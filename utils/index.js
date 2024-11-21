import { Logger } from "./logger.js";
import { v4 as uuidv4 } from "uuid";
import { config } from "dotenv";
import { admin } from "../database/firebase.js";
import { items } from "../database/allItems.js";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

config();

const bucket = admin.storage().bucket();

/**
 * Updates the DKP value for a user in the provided DKP array.
 *
 * @param {Array} dkpArray - The array of DKP objects.
 * @param {string} userId - The ID of the user to update.
 * @param {number} amount - The amount to add or set for the user's DKP.
 */
export async function updateDkp(
  dkpArray,
  userId,
  amount,
  user,
  serverName,
  guildDataResponse
) {
  const userIndex = dkpArray.findIndex(
    (memberDkp) => memberDkp?.userId === userId
  );

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
  const dmNotifications =
    guildDataResponse?.togglables?.dkpSystem?.dmNotifications;
  if (
    (dmNotifications && dmNotifications === true) ||
    dmNotifications === undefined ||
    dmNotifications === null
  ) {
    const message = `Your DKP has been updated to **${
      dkpArray[userIndex]?.dkp ?? (amount < 0 ? 0 : amount)
    }** in the server **${serverName}**.`;
    try {
      await user.send({ content: message, ephemeral: true });
    } catch (error) {
      const msg = `Could not send DM to user ${userId}`;
      new Logger().error("[Discord.js]", msg, error);
    }
  }
}

/**
 * Updates the DKP value for a user in the provided DKP array.
 *
 * @param {Array} dkpArray - The array of DKP objects.
 * @param {string} userId - The ID of the user to update.
 * @param {number} amount - The amount to add or set for the user's DKP.
 */
export async function decreaseDkp(
  dkpArray,
  userId,
  amount,
  user,
  serverName,
  guildDataResponse
) {
  const userIndex = dkpArray.findIndex(
    (memberDkp) => memberDkp?.userId === userId
  );

  if (userIndex !== -1) {
    // Calculate the new DKP value only once
    const currentDkp = dkpArray[userIndex].dkp;
    const newDkpValue = currentDkp - amount;

    // If the new DKP value is less than 0, set it to 0
    dkpArray[userIndex].dkp = newDkpValue < 0 ? 0 : newDkpValue;
  } else {
    // Create a new DKP object and add it to the array
    const newDKPObject = { userId, dkp: amount < 0 ? 0 : amount };
    dkpArray.push(newDKPObject);
  }

  // Send a private message to the user about the DKP update
  const dmNotifications =
    guildDataResponse?.togglables?.dkpSystem?.dmNotifications;
  if (
    (dmNotifications && dmNotifications === true) ||
    dmNotifications === undefined ||
    dmNotifications === null
  ) {
    const message = `Your DKP has been decreased to **${
      dkpArray[userIndex]?.dkp ?? (amount < 0 ? 0 : amount)
    }** in the server **${serverName}**.`;
    try {
      await user.send({ content: message, ephemeral: true });
    } catch (error) {
      const msg = `Could not send DM to user ${userId}`;
      new Logger().error("[Discord.js]", msg, error);
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
export async function setDkp(
  dkpArray,
  userId,
  amount,
  user,
  serverName,
  guildDataResponse
) {
  const userIndex = dkpArray.findIndex(
    (memberDkp) => memberDkp?.userId === userId
  );

  if (userIndex !== -1) {
    // If the user exists, set their DKP value to the new amount
    dkpArray[userIndex].dkp = amount;
  } else {
    // If the user doesn't exist, create a new DKP object and add it to the array
    const newDKPObject = { userId, dkp: amount };
    dkpArray.push(newDKPObject);
  }

  // Construct the message including the server name
  const dmNotifications =
    guildDataResponse?.togglables?.dkpSystem?.dmNotifications;
  if (
    (dmNotifications && dmNotifications === true) ||
    dmNotifications === undefined ||
    dmNotifications === null
  ) {
    const message = `Your DKP has been set to ${amount} in the server **${serverName}**.`;
    try {
      await user.send(message);
    } catch (error) {
      new Logger().error(
        "Discord.js",
        `Could not send DM to user ${userId}`,
        error
      );
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

/**
 * Generates a short fantasy code for claiming dkp
 * @returns Generates a short fantasy nickname.
 */
export function generateClaimCode() {
  const adjectives = process.env.ADJECTIVES.split(",");

  const nouns = process.env.NOUNS.split(",");

  // Randomly select an adjective and a noun
  let randomAdjective =
    adjectives[Math.floor(Math.random() * adjectives.length)];
  let randomNoun = nouns[Math.floor(Math.random() * nouns.length)];

  return randomAdjective + randomNoun.trim();
}

/**
 * Uploads a file to Firebase Storage.
 * @param { string } directory The directory to upload the file to
 * @param { any } file The file we're uploading to firebase
 * @returns { Promise } The promise of the file being uploaded
 */
export async function uploadFile(directory, file) {
  return new Promise((resolve, reject) => {
    const fileName = `${directory}/${uuidv4()}-${file.originalname}`;
    const fileUpload = bucket.file(fileName);

    fileUpload
      .createWriteStream()
      .on("finish", async () => {
        try {
          // Make the file public
          await bucket.file(fileName).makePublic();

          // Generate the public URL
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
          new Logger().log(
            "Express",
            `File uploaded and accessible at: ${publicUrl}`
          );
          resolve(publicUrl);
        } catch (err) {
          new Logger().error("Express", `Error making file public: ${err}`);
          reject(err);
        }
      })
      .on("error", (err) => {
        new Logger().error("Express", `Error uploading file: ${err}`);
        reject(err);
      })
      .end(file.buffer);
  });
}

/**
 * Create or modify auction embed
 *
 * @param { highestBidder: {  name: string, bid: number }, modalColor: string } data Data
 * 
 */
export function createOrModifyAuctionEmbed(data) {
  let newEmbed = new EmbedBuilder();

  // Create buttons
  let components = null;

  /*const bidComponent = new ButtonBuilder()
    .setCustomId("bid")
    .setLabel("Bid")
    .setEmoji("🤑")
    .setStyle(ButtonStyle.Secondary);*/
  const startAuctionComponent = new ButtonBuilder()
    .setCustomId("start_auction")
    .setLabel("Start Auction now!")
    .setEmoji("💸")
    .setStyle(ButtonStyle.Success);
  const cancelAuctionComponent = new ButtonBuilder()
    .setCustomId("stop_auction")
    .setLabel("Cancel auction now")
    .setEmoji("✖️")
    .setStyle(ButtonStyle.Danger);

  // The buttons
  if (data?.auctionStatus === "scheduled") {
    components = [startAuctionComponent, cancelAuctionComponent];
  /*} else if (data?.auctionStatus === "started") {
    components = [bidComponent];*/
  } else {
    components = null;
  }

  let row = null;

  if (components?.length) {
    row = new ActionRowBuilder().addComponents(components);
  }

  let theEmbed = newEmbed
  .setTitle(
    `An auction for ${data?.itemName?.trim()} ${data?.auctionPrefix} ${
      data?.auctionStatus
    }!`
  )
  .setDescription(
    `With the minimum price starting at: **${data?.startingPrice?.toString()} DKP**!`
  )
  .addFields(
    { name: "Item", value: `${data?.itemName?.trim()} (${data?.itemNote})` },
    {
      name: "Starting price",
      value: `${data?.startingPrice?.toString()} DKP`,
      inline: true,
    },
    {
      name: "Gap between bids",
      value: `${data?.gapBetweenBids} DKP`,
      inline: true,
    },
    { name: '\u200b', value: '\u200b', inline: true }
  )
  .addFields(
    { name: "Starting at", value: `${data?.startingAt?.replace('-', ' ')} **(UTC-3)**`, inline: true },
    {
      name: "Auction valid until",
      value: `${data?.auctionMaxTime?.replace('-', ' ')} **(UTC-3)**`,
      inline: true,
    },
    {
      name: "How to bid",
      value: `[Click to Learn](https://tldkp.online?knowledge-base?read=how-do-i-bid 'Click here to learn how to bid')`,
      inline: true,
    }
  )
  .setColor(data?.modalColor ?? 0x0099ff)
  .setThumbnail(
    items.find((item) => item.name.trim() === data?.itemName.trim())?.icon
  );

  // Only show bidders if the auction is not scheduled or cancelled
  if (data?.auctionStatus !== "scheduled" && data?.auctionStatus !== "cancelled") {
    const hasBidder = data?.highestBidder?.name !== undefined && data?.highestBidder?.bid !== 0;
    let textBidder = `Winning bid (Highest): Nobody has bidded yet!`;
    if (hasBidder) {
      textBidder = `Winning bid (Highest): ${data?.highestBidder?.name} with a bid of ${data?.highestBidder?.bid} DKP!`;
    }
    newEmbed.setFooter({
      text: textBidder,
      iconURL: "https://i.imgur.com/pvlqPKu.png",
    });
  }

  const toReturn = {
    embed: theEmbed,
    components: (row === null ? null : [row]),
  }

  return toReturn;
}


export function convertFirestoreTimestamp(timestamp) {
  // Convert Firestore _seconds and _nanoseconds to milliseconds
  const date = new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000);
  return date;
}

export function convertDateStringToDateObject(time) {
  const parsed = new Date(
    time.replace(
      /(\d{2})\/(\d{2})\/(\d{4})-(\d{2}):(\d{2}):(\d{2})/,
      "$3-$2-$1T$4:$5:$6"
    )
  );
  return parsed;
}

export function convertDateObjectToDateString(date) {
  const formattedStartingNew = date
          .toLocaleString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
          .replace(",", "")
          .replace(" ", "-");
  return formattedStartingNew;
}