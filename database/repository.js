import { db } from "./firebase.js"; // Import Firestore
import admin from "firebase-admin";
import { Logger } from "../utils/logger.js";
import { updateDkp, setDkp, isPositiveNumber } from "../utils/index.js";
import { LANGUAGE_EN, LANGUAGE_PT_BR } from "../utils/constants.js";
import { getMemberById } from "../utils/discord.js";
import cache from "../utils/cache.js";
import { config } from "dotenv";
import { isAfter, add, formatDistance } from "date-fns";

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

export async function getGuildsByOwnerOrUser(userOrOwnerId) {
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
          memberDkps: members, // Only include relevant members
        });
      }
    });

    const [owner, member] = await Promise.all([ownerGuilds, memberGuilds]).then(
      async (values) => {
        const parseMembers = async (_guilds) => {
          return Promise.all(
            _guilds.map(async (guild) => {
              const { id, ownerId } = guild?.guildData;
              const owner = await getMemberById(id, ownerId);

              const memberDkps = await Promise.all(
                guild?.memberDkps.map(async (member) => {
                  const memberDiscord = await getMemberById(id, member?.userId);

                  return {
                    ...member,
                    discordData: {
                      displayName: memberDiscord?.user?.global_name ?? "",
                      preferredColor: memberDiscord?.user?.accent_color,
                    },
                  };
                })
              );

              return {
                ...guild,
                guildData: {
                  ...guild?.guildData,
                  ownerDiscordData: {
                    displayName: owner?.user?.global_name ?? "",
                    preferredColor: owner?.user?.accent_color,
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
  const cacheKey = `dkp-${guildId}`;
  let cachedData = cache.get(cacheKey);

  if (cachedData) {
    return cachedData;
  }

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

  // Cache the result
  cache.set(cacheKey, userDkpData);

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
 * Logs an error to firebase
 *
 * @param { any } guild Guild
 * @param { string } message Message
 * @param { any } err Error
 * @returns
 */
export async function logError(guild, message, err) {
  // Create the default error object
  const defaultError = {
    guildName: guild.name,
    createdAt: new Date(),
    error: err?.message || "Unknown error",
  };

  // Fetch existing errors for the guild
  const errorsDoc = await getData(guild.id, "errors");

  // Ensure errorsCollection is initialized as an empty array if it doesn't exist
  const errorsCollection = Array.isArray(errorsDoc?.errors)
    ? errorsDoc.errors
    : [];

  // Create a new errors array by adding the default error
  const newError = {
    errors: [...errorsCollection, defaultError],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Save the updated error log to Firestore
  const res = await db.collection("errors").doc(guild.id).set(newError);

  // Log the error in the system
  new Logger().error(PREFIX, message);

  return res;
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
    return interaction.reply({ content: msg, ephemeral: true });
  }

  switch (choices?.toLowerCase()) {
    case "set":
      // Initialize newDkp as a copy of the existing memberDkps array or an empty array if it doesn't exist
      let newDkp = memberDkps ? [...memberDkps] : [];

      // Validate the amount for positive number
      if (!isPositiveNumber(amount)) {
        const errorMsg = "The DKP amount must be a positive number.";
        return interaction.reply({ content: errorMsg, ephemeral: true });
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
        return interaction.reply({ content: errorMsg, ephemeral: true });
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
      break;

    default:
      const msg = `Operation not recognized.`;
      new Logger(interaction).log(PREFIX, msg);
      return interaction.reply({ content: msg, ephemeral: true });
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
  return interaction.reply({ content: msg, ephemeral: true });
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

      const future = add(updatedAtDate, { hours: 12 });

      // You can only change the nickname if it is not set yet or if 12 hours have passed since updatedAt
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
          return interaction.reply({
            content: msg,
            ephemeral: true,
          });
        }
      } else {
        // Send a message if nickname change is not allowed
        const allowedDateFormatted = formatDistance(future, new Date(), {
          addSuffix: true,
        });
        const msg = `You can only change your nickname once in 12 hours, you will be able ${allowedDateFormatted}.`;
        new Logger(interaction).log(PREFIX, msg);
        return interaction.reply({
          content: msg,
          ephemeral: true,
        });
      }
    }
  } catch (error) {
    console.log(error);
    const msg = "Error updating in-game nickname";
    new Logger(interaction).log(PREFIX, msg);
    return interaction.reply({
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
      return interaction.reply({
        content: `You don't have DKP yet.`,
        ephemeral: true,
      });
    } else if (response === "guild-not-found") {
      return interaction.reply({
        content: `Guild not found.`,
        ephemeral: true,
      });
    } else {
      const { ign, dkp } = response;

      return interaction.reply({
        content: `Your current DKP is **${dkp}**!
        ${ign ? `IGN: **${ign}**` : ""}`,
        ephemeral: true,
      });
    }
  } catch (error) {
    const msg = "Error checking DKP";
    new Logger(interaction).error(PREFIX, msg);
    try {
      await logError(interaction.guild, msg, error);
    } catch (err) {}
    return interaction.reply({
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
      return interaction.reply({
        content: `${user.globalName} doesn't have DKP yet.`,
        ephemeral: true,
      });
    } else if (response === "guild-not-found") {
      return interaction.reply({
        content: `Guild not found.`,
        ephemeral: true,
      });
    } else {
      const { ign, dkp } = response;

      return interaction.reply({
        content: `${user.globalName}'s current DKP is **${dkp}**!
        ${ign ? `IGN: **${ign}**` : ""}`,
        ephemeral: true,
      });
    }
  } catch (error) {
    const msg = "Error checking DKP";
    new Logger(interaction).error(PREFIX, msg);
    try {
      await logError(interaction.guild, msg, error);
    } catch (err) {}
    return interaction.reply({
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
      return interaction.reply({ content: msg, ephemeral: true });
    } else {
      // Calculate the time left until the next allowed update
      const allowedDateFormatted = formatDistance(future, new Date(), {
        addSuffix: true,
      });
      const msg = `You can only change your guild alias once every 10 days, you will be able to change it ${allowedDateFormatted}.`;

      new Logger(interaction).log(PREFIX, msg);
      return interaction.reply({ content: msg, ephemeral: true });
    }
  } catch (error) {
    console.log(error);
    const msg = "Error updating guild's name (alias)";
    new Logger(interaction).log(PREFIX, msg);
    return interaction.reply({ content: msg, ephemeral: true });
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
    return interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    const msg = "Error while setting up the auto-decaying system";
    new Logger(interaction).log(PREFIX, msg);
    return interaction.reply({ content: msg, ephemeral: true });
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
        return interaction.reply({
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
    return interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    const msg = "Error updating DKP notifications";
    new Logger(interaction).log(PREFIX, msg);
    return interaction.reply({ content: msg, ephemeral: true });
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
        return interaction.reply({
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
      return interaction.reply({ content: msg, ephemeral: true });
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
    return interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    console.log(error);
    const msg = "Error toggling decay";
    new Logger(interaction).log(PREFIX, msg);
    return interaction.reply({ content: msg, ephemeral: true });
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
        return interaction.reply({
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
    return interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    const msg = "Error updating decay";
    new Logger(interaction).log(PREFIX, msg);
    return interaction.reply({ content: msg, ephemeral: true });
  }
};
