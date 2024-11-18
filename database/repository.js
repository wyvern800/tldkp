import { db } from "./firebase.js"; // Import Firestore
import admin from "firebase-admin";
import { Logger } from "../utils/logger.js";
import {
  updateDkp,
  decreaseDkp,
  setDkp,
  isPositiveNumber,
  convertDateStringToDateObject,
} from "../utils/index.js";
import { LANGUAGE_EN, LANGUAGE_PT_BR } from "../utils/constants.js";
import cache from "../utils/cache.js";
import { config } from "dotenv";
import { isAfter, add, formatDistance, isBefore, isEqual } from "date-fns";
import {
  generateClaimCode,
  createOrModifyAuctionEmbed,
  convertFirestoreTimestamp,
} from "../utils/index.js";
import {
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { items } from "../database/allItems.js";

const PREFIX = "Firebase";

config();

/**
 * Gets the guild config
 *
 * @param { string } guildId The guild id
 * @returns { any } Data
 */
export async function getGuildConfig(guildId) {
  const cacheKey = `guild-${guildId}`;
  let guildData = cache.get(cacheKey);

  if (!guildData) {
    const guildSnapshot = await db.collection("guilds").doc(guildId).get();

    if (!guildSnapshot.exists) {
      new Logger().log(PREFIX, `No config found for guild ${guildId}`);
      return null;
    }

    guildData = guildSnapshot.data();
    cache.set(cacheKey, guildData);
  }

  return guildData;
}

/**
 * Gets the guild config
 *
 * @param { string } guildId The guild id
 * @returns { any } Data
 */
export async function getAuctionData(auctionId) {
  const cacheKey = `auction-${auctionId}`;
  let auctionData = cache.get(cacheKey);

  if (!auctionData) {
    const auctionSnapshot = await db
      .collection("auctions")
      .doc(auctionId)
      .get();

    if (!auctionSnapshot.exists) {
      new Logger().log(PREFIX, `No auction found with id ${auctionId}`);
      return null;
    }

    auctionData = auctionSnapshot.data();
    cache.set(cacheKey, auctionData);
  }

  return auctionData;
}

/**
 *
 * @param {any} discordBot The discord bot
 * @returns {Promise<void>}
 */
export async function loadAllAuctions(discordBot) {
  const auctionsSnapshot = await db.collection("auctions").get();

  if (auctionsSnapshot.empty) {
    new Logger().log(PREFIX, `No auctions found`);
    return;
  }

  const auctions = [];
  auctionsSnapshot.forEach((doc) => {
    auctions.push({ id: doc.id, ...doc.data() });
  });

  for (const auction of auctions) {
    try {
      let channel = await discordBot.channels.fetch(auction.data.channelId);
      let message = await channel.messages.fetch(auction.data.messageId);

      if (channel && message) {
        updateAuction({ _message: message, auction });
      }
    } catch (e) {
      console.log(e);
      new Logger().logLocal(PREFIX, `Error loading auction ${auction.id}`, e);
    }
  }
  return auctions?.length;
}

/**
 * Gets the guild config
 *
 * @param { string } guildId The guild id
 * @returns { any } Data
 */
export async function getAllGuilds() {
  const cacheKey = `guilds-all`;
  let guildsData = cache.get(cacheKey);

  if (!guildsData) {
    const snapshot = await db.collection("guilds").get();

    if (snapshot.empty) {
      new Logger().log(PREFIX, `No guilds found`);
      return [];
    }

    const guilds = [];
    snapshot.forEach((doc) => {
      guilds.push({ id: doc.id, ...doc.data() });
    });

    guildsData = guilds;
    cache.set(cacheKey, guildsData);
  }

  return guildsData;
}

export async function getGuildsByOwnerOrUser(userOrOwnerId, discordBot) {
  const cacheKey = `guilds-${userOrOwnerId}`;
  let cachedData = cache.get(cacheKey);

  if (cachedData) {
    return cachedData;
  }

  try {
    const guildsRef = db.collection("guilds");

    const ownerQuery = guildsRef.where(
      "guildData.ownerId",
      "==",
      userOrOwnerId
    );
    const ownerSnapshot = await ownerQuery.get();

    const allGuildsSnapshot = await guildsRef.get();

    const ownerGuilds = [];
    if (!ownerSnapshot.empty) {
      ownerSnapshot.forEach((doc) => {
        ownerGuilds.push({ ...doc.data() });
      });
    }

    // Guildas em que o usuário é membro
    const memberGuilds = [];
    allGuildsSnapshot.forEach((doc) => {
      const data = doc.data();
      const members = data?.memberDkps || [];

      // Filter the members that match the userOrOwnerId
      const filteredMembers = members.filter(
        (member) => member?.userId === userOrOwnerId
      );

      // Only add the guild if there are matching members
      if (filteredMembers.length > 0) {
        memberGuilds.push({
          ...data,
          memberDkps: members,
        });
      }
    });

    const [owner, member] = await Promise.all([ownerGuilds, memberGuilds]).then(
      async (values) => {
        const parseMembers = async (_guilds) => {
          return Promise.all(
            _guilds.map(async (guild) => {
              const { id, ownerId } = guild?.guildData;
              const guildData = discordBot?.guilds?.cache.get(id);
              let owner = {};
              let avatarURL = "";

              // try and grab data
              try {
                owner = await guildData?.members?.fetch(ownerId);
                avatarURL = owner?.user.displayAvatarURL({
                  dynamic: true,
                  size: 32,
                });
              } catch (error) {
                new Logger().logLocal(
                  PREFIX,
                  `Owner not found for guild ${id}`
                );
              }

              const memberDkps = await Promise.all(
                guild?.memberDkps.map(async (memberDkp) => {
                  let memberData = {};
                  let avatarURL = "";

                  // try and grab data
                  try {
                    memberData = await guildData?.members?.fetch(
                      memberDkp.userId
                    );
                    avatarURL = memberData?.user?.displayAvatarURL({
                      dynamic: true,
                      size: 32,
                    });
                  } catch (error) {
                    new Logger().logLocal(
                      PREFIX,
                      `Member not found for guild ${id}`
                    );
                  }

                  return {
                    ...memberDkp,
                    discordData: {
                      displayName: memberData?.user?.globalName ?? "",
                      preferredColor: memberData?.user?.accentColor ?? "",
                      avatarURL,
                    },
                  };
                })
              );

              return {
                ...guild,
                guildData: {
                  ...guild?.guildData,
                  ownerDiscordData: {
                    displayName: owner?.user?.globalName ?? "",
                    preferredColor: owner?.user?.accentColor ?? "",
                    avatarURL,
                  },
                },
                memberDkps,
              };
            })
          );
        };

        const ownerGuilds = await parseMembers(values[0]);
        const memberGuilds = await parseMembers(values[1]);

        return [ownerGuilds, memberGuilds];
      }
    );

    const result = {
      ownerGuilds: owner,
      memberGuilds: member,
    };

    // Store the result in the cache
    cache.set(cacheKey, result);

    return result;
  } catch (error) {
    console.log(error);
    new Logger().log(PREFIX, `Some error happened`);
  }
}

/**
 * Gets data
 *
 * @param { string } guildId The guild id
 * @param { any } collection The collection
 * @returns { any[] } The data
 */
export async function getData(guildId, collection) {
  const cacheKey = `${collection}-${guildId}`;
  let cachedData = cache.get(cacheKey);

  if (cachedData) {
    return cachedData;
  }

  const doc = await db.collection(collection).doc(guildId).get();

  if (!doc.exists) {
    new Logger().log(PREFIX, `No config found for guild ${guildId}`);
    return null;
  }

  const data = doc.data();
  cache.set(cacheKey, data);

  return data;
}

async function getDkpByUserId(interaction, guildId, userId) {
  const doc = await db.collection("guilds").doc(guildId).get();

  // If the document doesn't exist, log an error and return null
  if (!doc.exists) {
    new Logger(interaction).log(PREFIX, `Guild not found`);
    return "guild-not-found";
  }

  const guildData = doc.data();

  // Check if the memberDkps array exists
  const memberDkps = guildData.memberDkps || [];

  // Find the user with the specified userId in the memberDkps array
  const userDkpData = memberDkps.find(
    (memberDkp) => memberDkp.userId === userId
  );

  // If user not found, log an error and return null
  if (!userDkpData) {
    new Logger(interaction).log(PREFIX, `No DKP found for user ${userId}`);
    return "dkp-not-found";
  }

  // Return the DKP of the user
  return userDkpData;
}

/**
 * Create the guild config
 *
 * @param { string } guildId The guild id
 * @returns { any } Response
 */
export async function guildCreate(guild) {
  const defaultConfig = {
    guildData: {
      id: guild.id,
      icon: guild.iconURL(),
      name: guild.name,
      ownerId: guild.ownerId,
      alias: null,
      lastUpdatedGuild: null,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    language: LANGUAGE_EN,
    memberDkps: [],
    togglables: {
      dkpSystem: {
        dmNotifications: true,
      },
    },
  };

  const res = await db.collection("guilds").doc(guild.id).set(defaultConfig);
  new Logger().log(PREFIX, `Config added for guild ${guild.id}`);
  return res;
}

/**
 * Create the auction
 *
 * @param { string } guildId The guild id
 * @returns { any } Response
 */
async function auctionCreate(auctionData) {
  const res = await db.collection("auctions").add(auctionData);
  if (res) {
    return auctionData;
  } else {
    return false;
  }
}

/**
 * Handles dkp management
 *
 * @param { any } interaction The interaction
 * @param { SET | ADD | SUBTRACT } type Type
 * @returns
 */
export async function handleUpdateDkp(interaction) {
  const choices = interaction.options.getString("operation");
  const user = interaction.options.getUser("user");
  const amount = interaction.options.getInteger("amount");

  const { memberDkps } = await getGuildConfig(interaction.guild.id);
  const guildDataResponse = await getGuildConfig(interaction.guild.id);

  const { id } = interaction.user;

  let newGuildData = guildDataResponse;

  if (!user && !choices && !amount && !id) {
    const msg = `Something unexpected happened`;
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }

  switch (choices?.toLowerCase()) {
    case "set":
      // Initialize newDkp as a copy of the existing memberDkps array or an empty array if it doesn't exist
      let newDkp = memberDkps ? [...memberDkps] : [];

      // Validate the amount for positive number
      if (!isPositiveNumber(amount)) {
        const errorMsg = "The DKP amount must be a positive number.";
        return await interaction.reply({ content: errorMsg, ephemeral: true });
      }

      setDkp(
        newDkp,
        user.id,
        amount,
        user,
        guildDataResponse?.guildData?.name,
        guildDataResponse
      );

      // Update the guild data with the new memberDkps array and the current timestamp
      newGuildData = {
        ...guildDataResponse,
        memberDkps: newDkp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      break;

    case "add":
    case "remove":
      // Initialize increasedDkp as a copy of the existing memberDkps array or an empty array if it doesn't exist
      let increasedDkp = memberDkps ? [...memberDkps] : [];

      // Validate the amount for positive number
      if (!isPositiveNumber(amount)) {
        const errorMsg = "The DKP amount must be a positive number.";
        return await interaction.reply({ content: errorMsg, ephemeral: true });
      }

      if (choices === "add") {
        updateDkp(
          increasedDkp,
          user.id,
          amount,
          user,
          guildDataResponse?.guildData?.name,
          guildDataResponse
        );
      } else {
        decreaseDkp(
          increasedDkp,
          user.id,
          amount,
          user,
          guildDataResponse?.guildData?.name,
          guildDataResponse
        );
      }

      // Update the guild data with the new memberDkps array and the current timestamp
      newGuildData = {
        ...guildDataResponse,
        memberDkps: increasedDkp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      break;

    default:
      const msg = `Operation not recognized.`;
      new Logger(interaction).log(PREFIX, msg);
      return await interaction.reply({ content: msg, ephemeral: true });
  }

  await db.collection("guilds").doc(interaction.guild.id).update(newGuildData);

  const answer = {
    add: "increased to",
    remove: "subtracted to",
    set: "set to",
  };

  const value = newGuildData?.memberDkps?.find(
    (member) => member.userId === user.id
  );
  const msg = `<@${user.id}>'s DKP was ${
    answer[choices?.toLowerCase() ?? "updated to"]
  } ${value?.dkp}!`;
  new Logger(interaction).log(PREFIX, msg);
  return await interaction.reply({ content: msg, ephemeral: true });
}

export const updateNickname = async (interaction) => {
  const user = interaction.user;
  const nickname = interaction.options.getString("nickname");

  try {
    const guildData = await getGuildConfig(interaction.guild.id);
    let copyGuildData = { ...guildData };
    const { memberDkps } = guildData;

    let memberIndex = memberDkps.findIndex(
      (member) => member.userId === user.id
    );

    if (memberIndex !== -1) {
      const { updatedAt } = memberDkps[memberIndex]; // Assuming this is a Firestore Timestamp
      const notSetYet = !updatedAt; // Check if updatedAt is set

      // Ensure updatedAt is a valid Timestamp
      const updatedAtDate =
        updatedAt instanceof admin.firestore.Timestamp
          ? updatedAt.toDate() // Convert Timestamp to Date
          : new Date();

      // Check if the date is valid
      if (isNaN(updatedAtDate.getTime())) {
        throw new Error("Invalid updatedAt date.");
      }

      const future = add(updatedAtDate, { hours: 1 });

      // You can only change the nickname if it is not set yet or if 1 hour have passed since updatedAt
      if (notSetYet || isAfter(new Date(), future)) {
        // Update the nickname
        copyGuildData.memberDkps[memberIndex].ign = nickname;
        copyGuildData.memberDkps[memberIndex].updatedAt = new Date();

        try {
          const nickname = interaction.options.getString("nickname");

          try {
            await db
              .collection("guilds")
              .doc(interaction.guild.id)
              .update(copyGuildData);
            const msg = `Your in-game nickname was changed to: ${nickname}!`;
            new Logger(interaction).log(PREFIX, msg);
            interaction.reply({ content: msg, ephemeral: true });
          } catch (err) {
            console.log(err);
            const msg = `Failed to update your in-game nickname.`;
            new Logger(interaction).error(PREFIX, msg, err);
            interaction.reply({ content: msg, ephemeral: true });
          }
        } catch (err) {
          const msg = "Error setting in-game nickname";
          new Logger(interaction).log(PREFIX, msg);
          return await interaction.reply({
            content: msg,
            ephemeral: true,
          });
        }
      } else {
        // Send a message if nickname change is not allowed
        const allowedDateFormatted = formatDistance(future, new Date(), {
          addSuffix: true,
        });
        const msg = `You can only change your nickname once in 1 hour, you will be able ${allowedDateFormatted}.`;
        new Logger(interaction).log(PREFIX, msg);
        return await interaction.reply({
          content: msg,
          ephemeral: true,
        });
      }
    } else {
      // Send a message if the user is not found in the memberDkps array
      const msg =
        "You don't have DKP yet, you must have before setting a nickname.";
      new Logger(interaction).log(PREFIX, msg);
    }
  } catch (error) {
    console.log(error);
    const msg = "Error updating in-game nickname";
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({
      content: msg,
      ephemeral: true,
    });
  }
};

/**
 * Handles the language change
 *
 * @param { any } interaction The interaction
 * @returns { any } Response
 */
export async function changeLanguage(interaction) {
  const language = interaction.options.getString("language");

  const guildDataResponse = await getGuildConfig(interaction.guild.id);

  const newGuildData = { ...guildDataResponse, language };

  const langs = {
    [LANGUAGE_EN]: "English (en-US)",
    [LANGUAGE_PT_BR]: "Brazilian Portuguese (pt-BR)",
  };
  const newLang = langs[language] ?? LANGUAGE_EN;

  try {
    await db
      .collection("guilds")
      .doc(interaction.guild.id)
      .update(newGuildData);
    const msg = `The bot responses language was set to: ${newLang}!`;
    new Logger(interaction).log(PREFIX, msg);
    interaction.reply({ content: msg, ephemeral: true });
  } catch (err) {
    const msg = `Failed to update the language.`;
    new Logger(interaction).error(PREFIX, msg, err);
    interaction.reply({ content: msg, ephemeral: true });
  }
}

/**
 * Comando de limpar
 *
 * @param { any } interaction Interação
 * @returns { void }
 */
export const handleClear = async (interaction) => {
  const { options } = interaction;

  const amount = options.getInteger("amount") || 100;
  if (amount < 1 || amount > 100) {
    interaction.reply({
      content: "You have to type a number between 1 and 100.",
      ephemeral: true,
    });
    return;
  }

  try {
    const fetched = await interaction?.channel?.messages?.fetch({
      limit: amount,
    });

    if (fetched?.size > 0) {
      await interaction.channel.bulkDelete(fetched);
      const deleteMsg = `Deleting ${fetched.size} messages...`;
      interaction
        .reply({
          content: deleteMsg,
          ephemeral: true,
        })
        .then((msg) => {
          setTimeout(() => msg.delete(), 5000);
        });
      new Logger(interaction).log(PREFIX, deleteMsg);
    } else {
      new Logger(interaction).log(
        PREFIX,
        `There are no messages to be deleted.`
      );
      interaction.reply({
        content: `There are no messages to be deleted.`,
        ephemeral: true,
      });
    }
  } catch (error) {
    new Logger(interaction).log(
      PREFIX,
      `Error cleaning messages: ${error?.message}`
    );
    interaction.reply({
      content: "There was an error when deleting.",
      ephemeral: true,
    });
  }
};

/**
 * Check DKP
 *
 * @param { any } interaction Interação
 * @returns { void }
 */
export const handleCheck = async (interaction) => {
  const user = interaction.user;

  try {
    const response = await getDkpByUserId(
      interaction,
      interaction.guild.id,
      user.id
    );
    if (response === "dkp-not-found") {
      return await interaction.reply({
        content: `You don't have DKP yet.`,
        ephemeral: true,
      });
    } else if (response === "guild-not-found") {
      return await interaction.reply({
        content: `Guild not found.`,
        ephemeral: true,
      });
    } else {
      const { ign, dkp } = response;

      return await interaction.reply({
        content: `Your current DKP is **${dkp}**!\n${
          ign ? `In-game Nickname: **${ign}**` : ""
        }`,
        ephemeral: true,
      });
    }
  } catch (error) {
    const msg = "Error checking DKP";
    new Logger(interaction).error(PREFIX, msg);
    return await interaction.reply({
      content: msg,
      ephemeral: true,
    });
  }
};

/**
 * Check other player's DKP
 *
 * @param { any } interaction Interação
 * @returns { void }
 */
export const checkOther = async (interaction) => {
  const { options } = interaction;
  const user = options.getUser("user");
  try {
    const response = await getDkpByUserId(
      interaction,
      interaction.guild.id,
      user.id
    );
    if (response === "dkp-not-found") {
      return await interaction.reply({
        content: `${user.globalName} doesn't have DKP yet.`,
        ephemeral: true,
      });
    } else if (response === "guild-not-found") {
      return await interaction.reply({
        content: `Guild not found.`,
        ephemeral: true,
      });
    } else {
      const { ign, dkp } = response;

      return await interaction.reply({
        content: `${user.globalName}'s current DKP is **${dkp}**!
        ${ign ? `IGN: **${ign}**` : ""}`,
        ephemeral: true,
      });
    }
  } catch (error) {
    const msg = "Error checking DKP";
    new Logger(interaction).error(PREFIX, msg);
    return await interaction.reply({
      content: msg,
      ephemeral: true,
    });
  }
};

/**
 * Sets the in-game nickname (alias) for a guild.
 *
 * This function retrieves the alias from the interaction options and updates the corresponding guild document in Firestore.
 * If the guild document does not exist, it throws an error.
 * If an error occurs during the update process, it logs the error and sends an ephemeral reply to the user.
 *
 * @param {any} interaction - The interaction object from Discord.
 * @param {any} interaction.options - The options object from the interaction.
 * @param {Function} interaction.options.getString - Function to get a string option from the interaction.
 * @param {string} interaction.options.getString.alias - The alias to set for the guild.
 * @param {any} interaction.guild - The guild object from Discord.
 * @param {string} interaction.guild.id - The ID of the guild.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
export const setGuildNickname = async (interaction) => {
  const nickname = interaction.options.getString("alias");

  try {
    const guildId = interaction.guild.id;
    const cacheKey = `guild-${guildId}`;
    let guildData = cache.get(cacheKey);

    if (!guildData) {
      // Direct query to Firestore for the specific guild document
      const guildRef = admin.firestore().collection("guilds").doc(guildId);

      // Fetch the document snapshot
      const guildSnapshot = await guildRef.get();

      // Ensure the document exists
      if (!guildSnapshot.exists) {
        throw new Error("Guild document not found");
      }

      // Get the data from the document snapshot
      guildData = guildSnapshot.data();
      cache.set(cacheKey, guildData);
    }

    // Destructure the lastUpdatedGuildAlias field
    const { lastUpdatedGuildAlias } = guildData?.guildData;
    const notSetYet = !lastUpdatedGuildAlias;

    // Handle date parsing
    const updatedAtDate = lastUpdatedGuildAlias?.toDate
      ? lastUpdatedGuildAlias.toDate()
      : new Date();
    if (isNaN(updatedAtDate.getTime())) {
      new Logger(interaction).log(PREFIX, "Invalid lastUpdatedGuildAlias date");
      return;
    }

    const future = add(updatedAtDate, { days: 10 });

    // Check if 10 days have passed or if lastUpdatedGuildAlias was never set
    if (notSetYet || isAfter(new Date(), future)) {
      // Perform the update in Firestore
      const guildRef = admin.firestore().collection("guilds").doc(guildId);
      await guildRef.update({
        "guildData.alias": nickname,
        "guildData.lastUpdatedGuildAlias":
          admin.firestore.FieldValue.serverTimestamp(),
      });

      // Invalidate the cache
      cache.del(cacheKey);

      const msg = "Guild alias updated successfully!";
      return await interaction.reply({ content: msg, ephemeral: true });
    } else {
      // Calculate the time left until the next allowed update
      const allowedDateFormatted = formatDistance(future, new Date(), {
        addSuffix: true,
      });
      const msg = `You can only change your guild alias once every 10 days, you will be able to change it ${allowedDateFormatted}.`;

      new Logger(interaction).log(PREFIX, msg);
      return await interaction.reply({ content: msg, ephemeral: true });
    }
  } catch (error) {
    console.log(error);
    const msg = "Error updating guild's name (alias)";
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }
};

/**
 * Sets up the auto decay system for a guild.
 *
 * This function retrieves the decay percentage and interval from the interaction options and updates the corresponding guild document in Firestore.
 * If an error occurs during the update process, it logs the error and sends an ephemeral reply to the user.
 *
 * @param {any} interaction - The interaction object from Discord.
 * @param {any} interaction.options - The options object from the interaction.
 * @param {Function} interaction.options.getNumber - Function to get a number option from the interaction.
 * @param {number} interaction.options.getNumber.percentage - The decay percentage to set for the guild.
 * @param {Function} interaction.options.getInteger - Function to get an integer option from the interaction.
 * @param {number} interaction.options.getInteger.interval - The decay interval to set for the guild.
 * @param {any} interaction.guild - The guild object from Discord.
 * @param {string} interaction.guild.id - The ID of the guild.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
export const setupAutoDecay = async (interaction) => {
  const percentage = interaction.options.getNumber("percentage");
  const interval = interaction.options.getInteger("interval");

  try {
    const guildId = interaction.guild.id;
    const cacheKey = `guild-${guildId}`;
    let guildData = cache.get(cacheKey);

    if (!guildData) {
      // Direct query to Firestore for the specific guild document
      const guildRef = admin.firestore().collection("guilds").doc(guildId);

      // Fetch the document snapshot
      const guildSnapshot = await guildRef.get();

      // Ensure the document exists
      if (!guildSnapshot.exists) {
        new Logger(interaction).log(PREFIX, "Guild document not found");
        return;
      }

      // Get the data from the document snapshot
      guildData = guildSnapshot.data();
      cache.set(cacheKey, guildData);
    }

    const togglablesPrefix = "togglables.decaySystem";

    await admin
      .firestore()
      .collection("guilds")
      .doc(guildId)
      .update({
        [`${togglablesPrefix}.percentage`]: percentage,
        [`${togglablesPrefix}.interval`]: interval,
        [`${togglablesPrefix}.enabled`]: false,
        [`${togglablesPrefix}.minimumCap`]: 100,
      });

    // Invalidate the cache
    cache.del(cacheKey);

    const msg = `The auto decaying system was set, now you must execute **/decay-toggle** once to enable the scheduler, please have in mind
      that if you don't enable the system, the decay will not be executed, also the default minimum cap is 100, which means a person will only
      lose their DKPs only if their cap is above 100, if it reaches 100, it will stop being removed, you can change that with **/decay-change-minimum-cap** command.
    `;
    return await interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    const msg = "Error while setting up the auto-decaying system";
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }
};

/**
 * Toggles DKP notifications for a guild.
 *
 * This function fetches the guild document from Firestore using the guild ID from the interaction.
 * If the guild document exists, it toggles the DKP notifications setting.
 * If the guild document does not exist, it logs an error message.
 *
 * @param {any} interaction - The interaction object from Discord.
 * @param {any} interaction.guild - The guild object from Discord.
 * @param {string} interaction.guild.id - The ID of the guild.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
export const toggleDkpNotifications = async (interaction) => {
  try {
    const guildId = interaction.guild.id;
    const cacheKey = `guild-${guildId}`;
    let guildData = cache.get(cacheKey);

    if (!guildData) {
      // Direct query to Firestore for the specific guild document
      const guildRef = admin.firestore().collection("guilds").doc(guildId);

      // Fetch the document snapshot
      const guildSnapshot = await guildRef.get();

      // Ensure the document exists
      if (!guildSnapshot.exists) {
        new Logger(interaction).log(PREFIX, "Guild document not found");
        return await interaction.reply({
          content: "Guild document not found",
          ephemeral: true,
        });
      }

      // Get the data from the document snapshot
      guildData = guildSnapshot.data();
      cache.set(cacheKey, guildData);
    }

    const togglablesPrefix = "togglables.dkpSystem";
    const enabled = guildData?.togglables?.dkpSystem?.dmNotifications;
    const newValue = !enabled;

    await admin
      .firestore()
      .collection("guilds")
      .doc(guildId)
      .update({
        [`${togglablesPrefix}.dmNotifications`]: newValue,
      });

    // Invalidate the cache
    cache.del(cacheKey);

    const msg = `Togglable: direct messages updated to: ${newValue}!`;
    return await interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    const msg = "Error updating DKP notifications";
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }
};

/**
 * Toggles the decay system for a guild.
 *
 * This function retrieves the guild document from Firestore using the guild ID from the interaction.
 * If the guild document exists, it toggles the decay system settings.
 * If the guild document does not exist, it logs an error message.
 * If an error occurs during the update process, it logs the error and sends an ephemeral reply to the user.
 *
 * @param {any} interaction - The interaction object from Discord.
 * @param {any} interaction.guild - The guild object from Discord.
 * @param {string} interaction.guild.id - The ID of the guild.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
export const toggleDecay = async (interaction) => {
  try {
    const guildId = interaction.guild.id;
    const cacheKey = `guild-${guildId}`;
    let guildData = cache.get(cacheKey);

    if (!guildData) {
      // Direct query to Firestore for the specific guild document
      const guildRef = admin.firestore().collection("guilds").doc(guildId);

      // Fetch the document snapshot
      const guildSnapshot = await guildRef.get();

      // Ensure the document exists
      if (!guildSnapshot.exists) {
        new Logger(interaction).log(PREFIX, "Guild document not found");
        return await interaction.reply({
          content: "Guild document not found",
          ephemeral: true,
        });
      }

      // Get the data from the document snapshot
      guildData = guildSnapshot.data();
      cache.set(cacheKey, guildData);
    }

    const togglablesPrefix = "togglables.decaySystem";

    const enabled = guildData?.togglables?.decaySystem?.enabled;
    const { percentage, interval, minimumCap } =
      guildData?.togglables?.decaySystem ?? {};

    if (!percentage || !interval || !minimumCap) {
      const msg =
        "You must set the decay system first, use **/decay-set-auto** to set the values";
      return await interaction.reply({ content: msg, ephemeral: true });
    }

    await admin
      .firestore()
      .collection("guilds")
      .doc(guildId)
      .update({
        [`${togglablesPrefix}.enabled`]: !enabled,
        [`${togglablesPrefix}.lastUpdated`]: !enabled
          ? admin.firestore.FieldValue.serverTimestamp()
          : null,
      });

    // Invalidate the cache
    cache.del(cacheKey);

    const msg = `Togglable: decaying system is now ${
      !enabled ? "enabled" : "disabled"
    }!`;
    return await interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    console.log(error);
    const msg = "Error toggling decay";
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }
};

/**
 * Sets the minimum cap for a guild.
 *
 * This function retrieves the minimum cap value from the interaction options and updates the corresponding guild document in Firestore.
 * If the minimum cap value is less than zero, it sends an ephemeral reply to the user indicating that the value must be above zero.
 * If the guild document does not exist, it throws an error.
 * If an error occurs during the update process, it logs the error and sends an ephemeral reply to the user.
 *
 * @param {any} interaction - The interaction object from Discord.
 * @param {any} interaction.options - The options object from the interaction.
 * @param {Function} interaction.options.getInteger - Function to get an integer option from the interaction.
 * @param {number} interaction.options.getInteger.minimum_cap - The minimum cap value to set for the guild.
 * @param {any} interaction.guild - The guild object from Discord.
 * @param {string} interaction.guild.id - The ID of the guild.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
export const setMinimumCap = async (interaction) => {
  const minimumCap = interaction.options.getInteger("minimum_cap");

  if (minimumCap < 0) {
    interaction.reply({ content: "Value must be above zero", ephemeral: true });
    return;
  }

  try {
    const guildId = interaction.guild.id;
    const cacheKey = `guild-${guildId}`;
    let guildData = cache.get(cacheKey);

    if (!guildData) {
      // Direct query to Firestore for the specific guild document
      const guildRef = admin.firestore().collection("guilds").doc(guildId);

      // Fetch the document snapshot
      const guildSnapshot = await guildRef.get();

      // Ensure the document exists
      if (!guildSnapshot.exists) {
        new Logger(interaction).log(PREFIX, "Guild document not found");
        return await interaction.reply({
          content: "Guild document not found",
          ephemeral: true,
        });
      }

      // Get the data from the document snapshot
      guildData = guildSnapshot.data();
      cache.set(cacheKey, guildData);
    }

    const togglablesPrefix = "togglables.decaySystem";

    await admin
      .firestore()
      .collection("guilds")
      .doc(guildId)
      .update({
        [`${togglablesPrefix}.minimumCap`]: minimumCap,
      });

    // Invalidate the cache
    cache.del(cacheKey);

    const msg = `Togglable: decay minimum cap updated successfully to **${minimumCap}**!`;
    return await interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    const msg = "Error updating decay";
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }
};

/**
 * Claim DKP code
 *
 * @param { any } interaction The interaction
 * @returns
 */
export async function claimDkpCode(interaction) {
  const amount = interaction.options.getInteger("amount");
  const expiration = interaction.options.getNumber("expiration-in-minutes");

  const { memberDkps } = await getGuildConfig(interaction.guild.id);
  const guildDataResponse = await getGuildConfig(interaction.guild.id);

  const { id } = interaction.user;

  let newGuildData = guildDataResponse;

  if (!expiration && !amount && !id) {
    const msg = `Something unexpected happened`;
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }

  // Initialize increasedDkp as a copy of the existing memberDkps array or an empty array if it doesn't exist
  let increasedDkp = memberDkps ? [...memberDkps] : [];

  // Validate the amount for positive number
  if (!isPositiveNumber(amount)) {
    const errorMsg = "The DKP amount must be a positive number.";
    return await interaction.reply({ content: errorMsg, ephemeral: true });
  }

  updateDkp(
    increasedDkp,
    user.id,
    choices === "add" ? amount : -amount,
    user,
    guildDataResponse?.guildData?.name,
    guildDataResponse
  );

  // Update the guild data with the new memberDkps array and the current timestamp
  newGuildData = {
    ...guildDataResponse,
    memberDkps: increasedDkp,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("guilds").doc(interaction.guild.id).update(newGuildData);

  const answer = {
    add: "increased to",
    remove: "subtracted to",
    set: "set to",
  };

  const value = newGuildData?.memberDkps?.find(
    (member) => member.userId === user.id
  );
  const msg = `<@${user.id}>'s DKP was ${
    answer[choices?.toLowerCase() ?? "updated to"]
  } ${value?.dkp}!`;
  new Logger(interaction).log(PREFIX, msg);
  return await interaction.reply({ content: msg, ephemeral: true });
}

/**
 * Generates and saves a DKP code
 *
 * @param { any } interaction The interaction
 * @returns { any } Response
 */
export async function generateDkpCode(interaction) {
  const amount = interaction.options.getInteger("amount");
  const expiration = interaction.options.getNumber("expiration-in-minutes");
  const note = interaction.options.getString("note");

  if (!amount || !expiration) {
    const msg = `Amount and expiration are required.`;
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }

  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  // Validate the amount for positive number
  if (!isPositiveNumber(amount)) {
    const errorMsg = "The DKP amount must be a positive number.";
    return await interaction.reply({ content: errorMsg, ephemeral: true });
  }

  // Generate a unique code
  const code = generateClaimCode();

  let expirationDate = null;
  const errorToReturn = "Something unexpected happened, please generate again";

  // Calculate expiration date
  try {
    expirationDate = add(new Date(), { minutes: expiration });
  } catch (e) {
    return await interaction.reply({ content: errorToReturn, ephemeral: true });
  }

  if (!expirationDate) {
    return await interaction.reply({ content: errorToReturn, ephemeral: true });
  }

  // Create the code document
  const codeData = {
    guildId,
    userId,
    code,
    amount,
    expirationDate: admin.firestore.Timestamp.fromDate(expirationDate),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    note,
    redeemers: [],
  };

  try {
    // Save the code document to Firestore
    await db.collection("codes").add(codeData);

    const msg = `Code generated successfully: **${code}**\n- NOTE: It will expire in ${expiration} minutes.`;
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    const msg = "Error generating code";
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }
}

/**
 * Redeems a DKP code
 *
 * @param { any } interaction The interaction
 * @returns { any } Response
 */
export async function redeemDkpCode(interaction) {
  const code = interaction.options.getString("code");

  if (!code) {
    const msg = `Code is required.`;
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }

  try {
    // Query the code document from Firestore
    const codeSnapshot = await db
      .collection("codes")
      .where("code", "==", code)
      .get();

    if (codeSnapshot.empty) {
      const msg = `Invalid code.`;
      new Logger(interaction).log(PREFIX, msg);
      return await interaction.reply({ content: msg, ephemeral: true });
    }

    const codeDoc = codeSnapshot.docs[0];
    const codeData = codeDoc.data();

    // Check if the user has already redeemed the code
    if (
      codeData?.redeemers?.some(
        (redeemer) => redeemer.userId === interaction.user.id
      )
    ) {
      const msg = `You have already redeemed this code.`;
      new Logger(interaction).log(PREFIX, msg);
      return await interaction.reply({ content: msg, ephemeral: true });
    }

    // Check if the code is expired
    if (isAfter(new Date(), codeData?.expirationDate.toDate())) {
      const msg = `Sorry, but this code has already expired.`;
      new Logger(interaction).log(PREFIX, msg);
      return await interaction.reply({ content: msg, ephemeral: true });
    }

    // Get the guild and user data
    const guildId = codeData.guildId;
    const userId = interaction.user.id;

    // Get the guild config
    const guildDataResponse = await getGuildConfig(guildId);
    let newGuildData = guildDataResponse;

    // Initialize increasedDkp as a copy of the existing memberDkps array or an empty array if it doesn't exist
    let increasedDkp = guildDataResponse.memberDkps
      ? [...guildDataResponse.memberDkps]
      : [];

    // Update the DKP for the user
    updateDkp(
      increasedDkp,
      userId,
      codeData.amount,
      interaction.user,
      guildDataResponse?.guildData?.name,
      guildDataResponse
    );

    // Update the guild data with the new memberDkps array and the current timestamp
    newGuildData = {
      ...guildDataResponse,
      memberDkps: increasedDkp,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Save the updated guild data to Firestore
    await db.collection("guilds").doc(guildId).update(newGuildData);

    // Mark the code as redeemed
    let copyRedeemers = [...codeData?.redeemers];
    copyRedeemers.push({ userId, redeemedAt: new Date() });
    await db.collection("codes").doc(codeDoc.id).update({
      redeemers: copyRedeemers,
    });

    const msg = `Code of **+${codeData.amount}** was redeemed successfully! Your DKP has been updated.`;
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    const msg = "Error redeeming code";
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }
}

/**
 * Gets all DKP codes
 *
 * @returns { any[] } List of codes
 */
export async function getAllCodes() {
  const cacheKey = `codes-all`;
  let codesData = cache.get(cacheKey);

  if (!codesData) {
    const snapshot = await db.collection("codes").get();

    if (snapshot.empty) {
      new Logger().log(PREFIX, `No codes found`);
      return [];
    }

    const codes = [];
    snapshot.forEach((doc) => {
      codes.push({ id: doc.id, ...doc.data() });
    });

    codesData = codes;
    cache.set(cacheKey, codesData);
  }

  return codesData;
}

/**
 * Upadtes a guild config file
 *
 * @param {string} guildId The guildId
 * @param {any} guildConfig The document we're updating
 * @returns
 */
export async function updateGuildConfig(guildId, guildConfig) {
  const response = await db
    .collection("guilds")
    .doc(guildId)
    .update(guildConfig);
  return response;
}

export const setRoleOnJoin = async (interaction) => {
  const role = interaction.options.getRole("role");
  const amount = interaction.options.getInteger("amount");

  if (amount < 0) {
    interaction.reply({ content: "Value must be above zero", ephemeral: true });
    return;
  }

  if (!role && !amount) {
    interaction.reply({
      content: "You must specify at least a role or an amount",
      ephemeral: true,
    });
    return;
  }

  try {
    const guildId = interaction.guild.id;
    const cacheKey = `guild-${guildId}`;
    let guildData = cache.get(cacheKey);

    if (!guildData) {
      // Direct query to Firestore for the specific guild document
      const guildRef = admin.firestore().collection("guilds").doc(guildId);

      // Fetch the document snapshot
      const guildSnapshot = await guildRef.get();

      // Ensure the document exists
      if (!guildSnapshot.exists) {
        new Logger(interaction).log(PREFIX, "Guild document not found");
        return await interaction.reply({
          content: "Guild document not found",
          ephemeral: true,
        });
      }

      // Get the data from the document snapshot
      guildData = guildSnapshot.data();
      cache.set(cacheKey, guildData);
    }

    const prefix = "togglables.dkpSystem";

    await admin
      .firestore()
      .collection("guilds")
      .doc(guildId)
      .update({
        ...(amount
          ? { [`${prefix}.onJoinDKPAmount`]: amount ? amount : 0 }
          : undefined),
        ...(role ? { [`${prefix}.roleToAssign`]: role.id } : undefined),
      });

    // Invalidate the cache
    cache.del(cacheKey);

    let msg = `Now when a member joins, they will:`;
    if (role) {
      msg = msg.concat(`\n- Be assigned to: <@&${role.id}>`);
    }
    if (amount) {
      msg = msg.concat(`\n- Receive: **${amount ? amount : 0}** DKP`);
    }
    return await interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    console.log(error);
    const msg = "Error updating decay";
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }
};

/**
 * Handle the autocompletion of the item name for the auction
 *
 * @param {any} interaction The interaction
 */
export const handleAuctionAutocomplete = async (interaction) => {
  const focusedValue = interaction.options.getFocused();
  const choices = items.map((item) => item.name?.trim());
  const filtered = choices.filter((choice) =>
    choice.toLowerCase().trim().includes(focusedValue.toLowerCase().trim())
  );

  await interaction.respond(
    filtered.slice(0, 25).map((choice) => ({ name: choice, value: choice }))
  );
};

/**
 * Parses the status of the auction
 *
 * @param { string } auctionStatus
 * @returns Parse the status
 */
export const statusParser = (_auctionStatus) => {
  let auctionPrefix = "";
  let auctionStatus = "";
  let modalColor = 0x000000;

  switch (_auctionStatus) {
    case "started":
      auctionPrefix = "has been";
      auctionStatus = "started";
      modalColor = 0x00ff99;
      break;
    case "cancelled":
      auctionPrefix = "has been";
      auctionStatus = "cancelled";
      modalColor = 0xff0000;
      break;
    case "scheduled":
      auctionPrefix = "has been";
      auctionStatus = "scheduled";
      modalColor = 0xffff00;
      break;
    default:
      auctionPrefix = "has been";
      auctionStatus = "finished";
      modalColor = 0x00ff00;
      break;
  }

  return {
    prefix: auctionPrefix,
    status: auctionStatus,
    modal: modalColor,
  };
};

export const updateAuction = ({ _message = null, auction }) => {
  const message = _message;

  const firestoreAuctionMaxTime =
    auction?.auctionMaxTime instanceof admin.firestore.Timestamp
      ? convertFirestoreTimestamp(auction?.auctionMaxTime)
      : auction?.auctionMaxTime;
  const firestoreStarting =
    auction?.startingAt instanceof admin.firestore.Timestamp
      ? convertFirestoreTimestamp(auction?.startingAt)
      : auction?.startingAt;

  const formattedStarting = firestoreStarting
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

  const formattedMaxTime = firestoreAuctionMaxTime
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

  const dynamicAuctionStatus = () => {
    const now = new Date();

    if (isBefore(now, firestoreStarting)) {
      return "scheduled";
    } else if (
      isEqual(now, firestoreAuctionMaxTime) ||
      isAfter(now, firestoreAuctionMaxTime)
    ) {
      return "finalized";
    } else if (
      isAfter(now, firestoreStarting) &&
      isBefore(now, firestoreAuctionMaxTime)
    ) {
      return "started";
    } else {
      return "cancelled";
    }
  };

  let theEmbed;
  let theComponents;

  const { prefix, status, modal } = statusParser(dynamicAuctionStatus());
  const { embed, components } = createOrModifyAuctionEmbed({
    itemName: auction.itemName,
    startingPrice: `${auction.startingPrice}`,
    maxPrice: `${auction.maxPrice}`,
    gapBetweenBids: `${auction.gapBetweenBids}`,
    startingAt: `${formattedStarting}`,
    auctionMaxTime: `${formattedMaxTime}`,
    auctionPrefix: prefix,
    auctionStatus: status,
    modalColor: modal,
  });
  theEmbed = embed;
  theComponents = components;

  (async () => {
    try {
      await message.edit({
        embeds: [theEmbed],
        components: theComponents ? theComponents : [],
      });
    } catch (error) {
      console.error("Error editing message:", error);
      await i.reply({
        content: "An error occurred while editing the message.",
        ephemeral: true,
      });
    }
  })();

  // Create an interaction collector
  const filter = (i) =>
    ["bid", "start_auction", "stop_auction"].includes(i.customId);
  const collector = message.createMessageComponentCollector({
    filter,
    time: firestoreAuctionMaxTime?.getTime() - Date.now(),
  });

  collector.on("collect", async (i) => {
    if (i.customId === "bid") {
      console.log(`${i.user.tag} bid`);
    } else if (i.customId === "start_auction") {
      const userId = i?.user?.id;

      const isUserOwner = auction.ownerDiscordId === userId;

      console.log("isOwner", isUserOwner);

      if (!isUserOwner) {
        await i.reply({
          content: "You are not the owner of this auction, and can't do that.",
          ephemeral: true,
        });
        return;
      }

      let embed, components;
      try {
        const { prefix, status, modal } = statusParser("started");

        ({ embed, components } = createOrModifyAuctionEmbed({
          itemName: auction.itemName,
          startingPrice: `${auction.startingPrice}`,
          maxPrice: `${auction.maxPrice}`,
          gapBetweenBids: `${auction.gapBetweenBids}`,
          startingAt: `${formattedStarting}`,
          auctionMaxTime: `${formattedMaxTime}`,
          auctionPrefix: prefix,
          auctionStatus: status,
          modalColor: modal,
        }));
      } catch (error) {
        console.error("Error in createOrModifyAuctionEmbed:", error);
        await i.reply({
          content: "An error occurred while modifying the auction embed.",
          ephemeral: true,
        });
        return;
      }

      try {
        await message.edit({
          embeds: [embed],
          components: components ? components : [],
        });
        console.log(`${i.user.tag} start.`);
      } catch (error) {
        console.error("Error editing message:", error);
        await i.reply({
          content: "An error occurred while editing the message.",
          ephemeral: true,
        });
      }
    } else if (i.customId === "stop_auction") {
      // STOP_AUCTION
      const userId = i?.user?.id;

      const isUserOwner = auction.ownerDiscordId === userId;

      console.log("isOwner", isUserOwner);

      if (!isUserOwner) {
        await i.reply({
          content: "You are not the owner of this auction, and can't do that.",
          ephemeral: true,
        });
        return;
      }

      let embed, components;
      try {
        const { prefix, status, modal } = statusParser("cancelled");

        ({ embed, components } = createOrModifyAuctionEmbed({
          itemName: auction.itemName,
          startingPrice: `${auction.startingPrice}`,
          maxPrice: `${auction.maxPrice}`,
          gapBetweenBids: `${auction.gapBetweenBids}`,
          startingAt: `${formattedStarting}`,
          auctionMaxTime: `${formattedMaxTime}`,
          auctionPrefix: prefix,
          auctionStatus: status,
          modalColor: modal,
        }));
      } catch (error) {
        console.error("Error in createOrModifyAuctionEmbed:", error);
        await i.reply({
          content: "An error occurred while modifying the auction embed.",
          ephemeral: true,
        });
        return;
      }

      try {
        await message.edit({
          embeds: [embed],
          components: components ? components : [],
        });
        console.log(`${i.user.tag} start.`);
      } catch (error) {
        console.error("Error editing message:", error);
        await i.reply({
          content: "An error occurred while editing the message.",
          ephemeral: true,
        });
      }
    }
  });

  collector.on("end", (collected) => {
    console.log(`Collected ${collected.size} interactions.`);
  });
};

/**
 * Handle the modal submission for creating an auction
 *
 * @param {any} interaction Handle the modal submission for creating an auction
 */
export const handleSubmitModalCreateAuction = async (interaction) => {
  const [, itemName] = interaction.customId.split("#").slice(1);
  try {
    // Defer the interaction response immediately
    await interaction.deferReply({ ephemeral: true });

    const [command] = interaction.customId.split("#");
    const startingPrice = interaction.fields.getTextInputValue(
      `${command}#startingPrice`
    );
    const maxPrice = interaction.fields.getTextInputValue(
      `${command}#maxPrice`
    );
    const startingAt = interaction.fields.getTextInputValue(
      `${command}#startingAt`
    );
    const auctionMaxTime = interaction.fields.getTextInputValue(
      `${command}#auctionMaxTime`
    );
    const gapBetweenBids = interaction.fields.getTextInputValue(
      `${command}#gapBetweenBids`
    );

    let errors = [];

    // Validate if it's a number
    const parsedStartingPrice = parseFloat(startingPrice);
    if (isNaN(startingPrice) && parsedStartingPrice <= 0) {
      errors.push("Starting price must be a number and greater than 0.");
    }

    const parsedMaxPrice = parseFloat(maxPrice);
    if (
      maxPrice &&
      isNaN(maxPrice) &&
      parsedMaxPrice < parsedStartingPrice &&
      parsedMaxPrice <= 0
    ) {
      errors.push(
        "Max price must be a number, greater than 0, and greater than the starting price'."
      );
    }

    if (
      gapBetweenBids &&
      isNaN(gapBetweenBids) &&
      parsedMaxPrice < parsedStartingPrice
    ) {
      errors.push("Gap between bids must be a number and greater 0'.");
    }

    // Validate startingAt format
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}-\d{2}:\d{2}:\d{2}$/;
    if (!dateRegex.test(startingAt)) {
      errors.push("Starting time must be in the format dd/mm/yyyy-hh:mm:ss.");
    }

    const dateRegexAuctionMaxTime = /^\d{2}\/\d{2}\/\d{4}-\d{2}:\d{2}:\d{2}$/;
    if (!dateRegexAuctionMaxTime.test(auctionMaxTime)) {
      errors.push(
        "Auction max time must be in the format dd/mm/yyyy-hh:mm:ss."
      );
    }

    // Validate startingAt is a future date
    const parsedStartingAt = convertDateStringToDateObject(startingAt);
    const parsedAuctionMaxTime = convertDateStringToDateObject(auctionMaxTime);

    if (
      isNaN(parsedStartingAt.getTime()) ||
      isNaN(parsedAuctionMaxTime.getTime())
    ) {
      errors.push("Invalid date format for startingAt or auctionMaxTime.");
    } else if (parsedStartingAt <= new Date()) {
      errors.push("Starting time must be a future date.");
    } else if (parsedStartingAt >= parsedAuctionMaxTime) {
      errors.push("Starting time must be before the auction max time.");
    }

    if (errors.length > 0) {
      return await interaction.editReply({
        content: "- " + errors.join("\n -"),
      });
    } else {
      await interaction.editReply({
        content: `All done, everything is set up! Now its time to see them battling =)`,
        ephemeral: true,
      });
    }

    /**
     * TODO: bids = [{ userId: string, bidValue: number, createdAt: Date }]
     */
    const { modal, prefix, status } = statusParser("scheduled");
    const auctionDTO = {
      itemName,
      auctionMaxTime: parsedAuctionMaxTime,
      gapBetweenBids: parseFloat(gapBetweenBids),
      maxPrice: parseFloat(maxPrice),
      startingAt: parsedStartingAt,
      startingPrice: parseFloat(startingPrice),
      auctionStatus: status,
      ownerDiscordId: interaction.user.id,
      data: {
        guildId: interaction.guild.id,
      },
      bids: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
      let { embed, components } = createOrModifyAuctionEmbed({
        auctionId: "ff",
        itemName,
        startingPrice,
        maxPrice,
        gapBetweenBids,
        startingAt,
        auctionMaxTime,
        auctionPrefix: prefix,
        auctionStatus: status,
        modalColor: modal,
      });

      try {
        // Send the embed with buttons
        const followUpMessage = await interaction.followUp({
          embeds: [embed],
          components: components ? components : undefined,
        });

        const parsedAuctionDTO = {
          ...auctionDTO,
          data: {
            ...auctionDTO.data,
            channelId: followUpMessage.channel.id,
            messageId: followUpMessage.id,
          },
        };

        await auctionCreate(parsedAuctionDTO).then(async (auction) => {
          try {
            updateAuction({ _message: followUpMessage, auction });
          } catch (err) {
            new Logger().log(PREFIX, `Error creating auction: ${err}`);
            await interaction.followUp({
              content: "An unexpected error occurred.",
              ephemeral: true,
            });
          }
        });
      } catch (err) {
        new Logger().log(PREFIX, `Error creating auction: ${err}`);
        await interaction.followUp({
          content: "An unexpected error occurred.",
          ephemeral: true,
        });
      }
    } catch (err) {
      new Logger().log(PREFIX, `Error creating auction: ${err}`);
      await interaction.followUp({
        content: "An unexpected error occurred.",
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error("Error handling modal submission:", error);
    if (!interaction.replied) {
      await interaction.reply({
        content: "An unexpected error occurred.",
        ephemeral: true,
      });
    }
  }
};

/**
 *
 *
 * @param {any} interaction The interaction
 */
export const createAuction = async (interaction) => {
  const itemName = interaction.options.getString("item");

  if (!itemName) {
    await interaction.reply({
      content: "You must select an item to create an auction!",
      ephemeral: true,
    });
    return;
  }

  const yes = new ButtonBuilder()
    .setCustomId("confirm")
    .setLabel("Confirm")
    .setStyle(ButtonStyle.Success);

  const no = new ButtonBuilder()
    .setCustomId("cancel")
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents([yes, no]);

  await interaction.reply({
    content: `Are you sure you want to select: **${itemName.trim()}**?`,
    ephemeral: true,
    components: [row],
  });

  const collectorFilter = (i) => i.user.id === interaction.user.id;

  try {
    const confirmation = await interaction.channel.awaitMessageComponent({
      filter: collectorFilter,
      time: 60_000,
    });

    if (confirmation.customId === "confirm") {
      const modal = new ModalBuilder()
        .setCustomId(`auction-create#modal#${itemName}`)
        .setTitle("Enter Auction Details");

      const startingPrice = new TextInputBuilder()
        .setCustomId("auction-create#startingPrice")
        .setLabel("Bid starting price:")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Enter a number here")
        .setRequired(true);

      const maxPrice = new TextInputBuilder()
        .setCustomId("auction-create#maxPrice")
        .setLabel("Bid max price:")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Enter a number here")
        .setRequired(false);

      const startingAt = new TextInputBuilder()
        .setCustomId("auction-create#startingAt")
        .setLabel("Starting time:")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Type in format (dd/mm/yyyy:hh:mm:ss)")
        .setRequired(true);

      const auctionMaxTime = new TextInputBuilder()
        .setCustomId("auction-create#auctionMaxTime")
        .setLabel("Auction max time:")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Type in format (dd/mm/yyyy:hh:mm:ss)")
        .setRequired(true);

      const gapBetweenBids = new TextInputBuilder()
        .setCustomId("auction-create#gapBetweenBids")
        .setLabel("Gap between bids:")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(
          "Only bids that have a difference of X or more will be accepted"
        )
        .setRequired(true);

      const actionRows = [
        new ActionRowBuilder().addComponents(startingPrice),
        new ActionRowBuilder().addComponents(maxPrice),
        new ActionRowBuilder().addComponents(startingAt),
        new ActionRowBuilder().addComponents(auctionMaxTime),
        new ActionRowBuilder().addComponents(gapBetweenBids),
      ];

      modal.addComponents(actionRows);

      await interaction.editReply({
        content: `Item selection confirmed: **${itemName}**`,
        ephemeral: true,
        components: [],
      });

      // Show the modal via the confirmation interaction
      await confirmation.showModal(modal);
    } else if (confirmation.customId === "cancel") {
      await confirmation.update({
        content: "Action cancelled",
        ephemeral: true,
        components: [],
      });
    }
  } catch (e) {
    console.log(e);
    await interaction.editReply({
      content: "Confirmation not received within 1 minute, cancelling",
      ephemeral: true,
      components: [],
    });
  }
};

export const handleStartAuction = async (interaction) => {
  const auctionId = interaction.options.getString("auction-id");

  const auction = await getAuctionData(auctionId);

  const message = await interaction.fetchReply();
  console.log(message);

  // Ensure the message has embeds before accessing them
  if (!message.embeds || message.embeds.length === 0) {
    await interaction.reply({
      content: "No embeds found in the message",
      ephemeral: true,
    });
    return;
  }

  // Update the embed here
  const embed = message.embeds[0];

  if (!auction) {
    await interaction.reply({
      content: "Auction not found",
      ephemeral: true,
    });
    return;
  }

  const embedBuilder = createOrModifyAuctionEmbed({
    embedBuilder: embed,
    data: {
      auctionId: auctionId,
      itemName: auction.itemName,
      startingPrice: auction.startingPrice,
      maxPrice: auction.maxPrice,
      gapBetweenBids: auction.gapBetweenBids,
      startingAt: auction.startingAt,
      auctionMaxTime: auction.auctionMaxTime,
      auctionStatus: "has started",
    },
  });

  await message.edit({ embeds: [embedBuilder] });
};
