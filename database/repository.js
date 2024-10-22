import { db } from "./firebase.js"; // Import Firestore
import admin from "firebase-admin";
import { Logger } from "../utils/logger.js";
import { updateDkp, setDkp } from "../utils/index.js";
import { LANGUAGE_EN, LANGUAGE_PT_BR } from "../utils/constants.js";
import { getMemberById } from "../utils/discord.js";
import { isAfter, add, formatDistance } from "date-fns";

const PREFIX = "Firebase";

/**
 * Gets the guild config
 *
 * @param { string } guildId The guild id
 * @returns { any } Data
 */
export async function getGuildConfig(guildId) {
  const doc = await db.collection("guilds").doc(guildId).get();

  if (!doc.exists) {
    new Logger().log(PREFIX, `No config found for guild ${guildId}`);
    return null;
  }

  return doc.data();
}

/**
 * Gets the guild config
 *
 * @param { string } guildId The guild id
 * @returns { any } Data
 */
export async function getAllGuilds() {
  const snapshot = await db.collection("guilds").get();

  if (snapshot.empty) {
    new Logger().log(PREFIX, `No guilds found`);
    return [];
  }

  const guilds = [];
  snapshot.forEach((doc) => {
    guilds.push({ id: doc.id, ...doc.data() });
  });

  return guilds;
}

export async function getGuildsByOwnerOrUser(userOrOwnerId) {
  try {
    const guildsRef = db.collection("guilds"); // Supondo que os documentos estejam na coleção 'guilds'

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

    return {
      ownerGuilds: owner,
      memberGuilds: member,
    };
  } catch (error) {
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
  const doc = await db.collection(collection).doc(guildId).get();

  if (!doc.exists) {
    new Logger().log(PREFIX, `No config found for guild ${guildId}`);
    return null;
  }

  return doc.data();
}

export async function getDkpByUserId(interaction, guildId, userId) {
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
        allowBelowZero: false,
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
 * Handles updating the DKP (Dragon Kill Points) for a user in a guild.
 *
 * This function retrieves the operation type, user, and amount from the interaction options.
 * It then fetches the current guild configuration and updates the DKP for the specified user based on the operation type.
 * If an error occurs during the process, it logs the error and sends an ephemeral reply to the user.
 *
 * @param {any} interaction - The interaction object from Discord.
 * @param {any} interaction.options - The options object from the interaction.
 * @param {Function} interaction.options.getString - Function to get a string option from the interaction.
 * @param {string} interaction.options.getString.operation - The type of operation to perform (e.g., add, subtract).
 * @param {Function} interaction.options.getUser - Function to get a user option from the interaction.
 * @param {any} interaction.options.getUser.user - The user whose DKP is to be updated.
 * @param {Function} interaction.options.getInteger - Function to get an integer option from the interaction.
 * @param {number} interaction.options.getInteger.amount - The amount of DKP to update.
 * @param {any} interaction.guild - The guild object from Discord.
 * @param {string} interaction.guild.id - The ID of the guild.
 * @param {any} interaction.user - The user object from the interaction.
 * @param {string} interaction.user.id - The ID of the user performing the interaction.
 * @param {Function} getGuildConfig - Function to get the guild configuration.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
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

/**
 * Updates the in-game nickname for a user in a guild.
 *
 * This function retrieves the new nickname from the interaction options and updates the corresponding guild document in Firestore.
 * If the update is successful, it sends an ephemeral reply to the user confirming the nickname change.
 * If an error occurs during the update process, it logs the error and sends an ephemeral reply to the user indicating the failure.
 *
 * @param {any} interaction - The interaction object from Discord.
 * @param {any} interaction.options - The options object from the interaction.
 * @param {Function} interaction.options.getString - Function to get a string option from the interaction.
 * @param {string} interaction.options.getString.nickname - The new nickname to set for the user.
 * @param {any} interaction.guild - The guild object from Discord.
 * @param {string} interaction.guild.id - The ID of the guild.
 * @param {any} guildData - The data object containing the updated guild information.
 * @param {Function} interaction.reply - Function to send a reply to the interaction.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
export async function updateNickname(interaction, guildData) {
  const nickname = interaction.options.getString("nickname");

  try {
    await db.collection("guilds").doc(interaction.guild.id).update(guildData);
    const msg = `Your in-game nickname was changed to: ${nickname}!`;
    new Logger(interaction).log(PREFIX, msg);
    interaction.reply({ content: msg, ephemeral: true });
  } catch (err) {
    const msg = `Failed to update your in-game nickname.`;
    new Logger(interaction).error(PREFIX, msg, err);
    interaction.reply({ content: msg, ephemeral: true });
  }
}

/**
 * Changes the language setting for a guild.
 *
 * This function retrieves the new language from the interaction options and updates the corresponding guild document in Firestore.
 * It fetches the current guild configuration, merges it with the new language setting, and updates the document.
 * If the language is not recognized, it defaults to English (en-US).
 * If an error occurs during the update process, it logs the error and sends an ephemeral reply to the user.
 *
 * @param {any} interaction - The interaction object from Discord.
 * @param {any} interaction.options - The options object from the interaction.
 * @param {Function} interaction.options.getString - Function to get a string option from the interaction.
 * @param {string} interaction.options.getString.language - The new language to set for the guild.
 * @param {any} interaction.guild - The guild object from Discord.
 * @param {string} interaction.guild.id - The ID of the guild.
 * @param {Function} interaction.reply - Function to send a reply to the interaction.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
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

    // Direct query to Firestore for the specific guild document
    const guildRef = admin.firestore().collection("guilds").doc(guildId);

    // Fetch the document snapshot
    const guildSnapshot = await guildRef.get();

    // Ensure the document exists
    if (!guildSnapshot.exists) {
      new Logger(interaction).log(PREFIX, "Guild document not found");
    }

    const togglablesPrefix = "togglables.dkpSystem";

    const enabled =
      guildSnapshot.data()?.togglables?.dkpSystem?.dmNotifications;

    const newValue = !enabled;

    await guildRef.update({
      [`${togglablesPrefix}.dmNotifications`]: newValue,
    });

    const msg = `Togglable: directly messages updated to: ${newValue}!`;
    return interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    const msg = "Error updating decay";
    new Logger(interaction).log(PREFIX, msg);
    return interaction.reply({ content: msg, ephemeral: true });
  }
};

/**
 * Toggles the direct message notifications for the DKP system in a guild.
 *
 * This function retrieves the current state of the DM notifications from the guild document in Firestore.
 * It then toggles the state and updates the guild document with the new value.
 * If an error occurs during the update process, it logs the error and sends an ephemeral reply to the user.
 *
 * @param {any} interaction - The interaction object from Discord.
 * @param {any} interaction.guild - The guild object from Discord.
 * @param {string} interaction.guild.id - The ID of the guild.
 * @param {Function} interaction.reply - Function to send a reply to the interaction.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
export const toggleBelowZero = async (interaction) => {
  try {
    const guildId = interaction.guild.id;

    // Direct query to Firestore for the specific guild document
    const guildRef = admin.firestore().collection("guilds").doc(guildId);

    // Fetch the document snapshot
    const guildSnapshot = await guildRef.get();

    // Ensure the document exists
    if (!guildSnapshot.exists) {
      new Logger(interaction).log(PREFIX, "Guild document not found");
    }

    const togglablesPrefix = "togglables.dkpSystem";

    const enabled = guildSnapshot.data()?.togglables?.dkpSystem?.allowBelowZero;

    const newValue = !enabled;

    await guildRef.update({
      [`${togglablesPrefix}.allowBelowZero`]: newValue,
    });

    const msg = `Togglable: allow dkp bellow zero updated to: ${newValue}!`;
    return interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    const msg = "Error updating decay";
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

    // Direct query to Firestore for the specific guild document
    const guildRef = admin.firestore().collection("guilds").doc(guildId);

    // Fetch the document snapshot
    const guildSnapshot = await guildRef.get();

    // Ensure the document exists
    if (!guildSnapshot.exists) {
      new Logger(interaction).log(PREFIX, "Guild document not found");
    }

    const togglablesPrefix = "togglables.decaySystem";

    const enabled = guildSnapshot.data()?.togglables?.decaySystem?.enabled;
    const { percentage, interval, minimumCap } =
      guildSnapshot.data()?.togglables?.decaySystem;

    if (!percentage || !interval || !minimumCap) {
      const msg =
        "You must set the decay system first, use **/decay-set-auto** to set the values";
      return interaction.reply({ content: msg, ephemeral: true });
    }

    await guildRef.update({
      [`${togglablesPrefix}.enabled`]: !enabled,
      [`${togglablesPrefix}.lastUpdated`]: !enabled
        ? admin.firestore.FieldValue.serverTimestamp()
        : null,
    });

    const msg = `Togglable: decaying system is now ${
      !enabled ? "enabled" : "disabled"
    }!`;
    return interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    const msg = "Error updating decay";
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

    // Direct query to Firestore for the specific guild document
    const guildRef = admin.firestore().collection("guilds").doc(guildId);

    // Fetch the document snapshot
    const guildSnapshot = await guildRef.get();

    // Ensure the document exists
    if (!guildSnapshot.exists) {
      new Logger(interaction).log(PREFIX, "Guild document not found");
    }

    const togglablesPrefix = "togglables.decaySystem";

    await guildRef.update({
      [`${togglablesPrefix}.minimumCap`]: minimumCap,
    });

    const msg = `Togglable: decay minimum cap updated successfully to **${minimumCap}**!`;
    return interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    const msg = "Error updating decay";
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

    // Direct query to Firestore for the specific guild document
    const guildRef = admin.firestore().collection("guilds").doc(guildId);

    // Fetch the document snapshot
    const guildSnapshot = await guildRef.get();

    // Ensure the document exists
    if (!guildSnapshot.exists) {
      new Logger(interaction).log(PREFIX, "Guild document not found");
    }

    const togglablesPrefix = "togglables.decaySystem";

    await guildRef.update({
      [`${togglablesPrefix}.percentage`]: percentage,
      [`${togglablesPrefix}.interval`]: interval,
      [`${togglablesPrefix}.enabled`]: false,
      [`${togglablesPrefix}.minimumCap`]: 100,
    });

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

    // Direct query to Firestore for the specific guild document
    const guildRef = admin.firestore().collection("guilds").doc(guildId);

    // Fetch the document snapshot
    const guildSnapshot = await guildRef.get();

    // Ensure the document exists
    if (!guildSnapshot.exists) {
      throw new Error("Guild document not found");
    }

    // Get the data from the document snapshot
    const guildData = guildSnapshot.data();

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
      await guildRef.update({
        "guildData.alias": nickname,
        "guildData.lastUpdatedGuildAlias":
          admin.firestore.FieldValue.serverTimestamp(),
      });

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
    const msg = "Error updating guild's name (alias)";
    new Logger(interaction).log(PREFIX, msg);
    return interaction.reply({ content: msg, ephemeral: true });
  }
};

/**
 * Checks the DKP (Dragon Kill Points) of another user.
 *
 * This function retrieves the user from the interaction options and fetches their DKP from the API using the user's ID and the guild ID from the interaction.
 * If the DKP is not found, it sends an ephemeral reply to the user indicating that the specified user does not have DKP yet.
 * If the DKP is found, it sends an ephemeral reply to the user with the specified user's current DKP and in-game name (IGN), if available.
 * If an error occurs during the process, it logs the error and sends an ephemeral reply to the user.
 *
 * @param {any} interaction - The interaction object from Discord.
 * @param {any} interaction.options - The options object from the interaction.
 * @param {Function} interaction.options.getUser - Function to get a user option from the interaction.
 * @param {any} interaction.options.getUser.user - The user object to check DKP for.
 * @param {any} interaction.guild - The guild object from Discord.
 * @param {string} interaction.guild.id - The ID of the guild.
 * @param {Function} interaction.reply - Function to send a reply to the interaction.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
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
        content: `${user.globalName}'s current DKP is **${dkp}**!\n${ign ? `IGN: **${ign}**` : ""}`,
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
 * Handles the check for a user's DKP (Dragon Kill Points).
 *
 * This function retrieves the user's DKP from the API using the user's ID and the guild ID from the interaction.
 * If the DKP is not found, it sends an ephemeral reply to the user indicating that the DKP was not found.
 * If the DKP is found, it sends an ephemeral reply to the user with their current DKP and in-game name (IGN), if available.
 * If an error occurs during the process, it logs the error and sends an ephemeral reply to the user.
 *
 * @param {any} interaction - The interaction object from Discord.
 * @param {any} interaction.user - The user object from the interaction.
 * @param {string} interaction.user.id - The ID of the user.
 * @param {any} interaction.guild - The guild object from Discord.
 * @param {string} interaction.guild.id - The ID of the guild.
 * @param {Function} interaction.reply - Function to send a reply to the interaction.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
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
        content: `Your current DKP is **${dkp}**!\n${ign ? `IGN: **${ign}**` : ""}`,
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
 * Clears a specified number of messages from a channel.
 *
 * This function retrieves the number of messages to clear from the interaction options.
 * If the number is less than 1 or greater than 100, it sends an ephemeral reply to the user indicating that the number must be between 1 and 100.
 * If the number is valid, it fetches the specified number of messages from the channel and proceeds to delete them.
 * If an error occurs during the process, it logs the error and sends an ephemeral reply to the user.
 *
 * @param {any} interaction - The interaction object from Discord.
 * @param {any} interaction.options - The options object from the interaction.
 * @param {Function} interaction.options.getInteger - Function to get an integer option from the interaction.
 * @param {number} interaction.options.getInteger.amount - The number of messages to clear from the channel.
 * @param {any} interaction.channel - The channel object from Discord.
 * @param {Function} interaction.channel.messages.fetch - Function to fetch messages from the channel.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
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
