import { db } from "./firebase.js"; // Import Firestore
import admin from "firebase-admin";
import { Logger } from "../utils/logger.js";
import {
  updateDkp,
  decreaseDkp,
  setDkp,
  isPositiveNumber,
} from "../utils/index.js";
import { LANGUAGE_EN, LANGUAGE_PT_BR } from "../utils/constants.js";
import { config } from "dotenv";
import { isAfter, add, formatDistance } from "date-fns";
import { generateClaimCode } from "../utils/index.js";

const PREFIX = "Firebase";

config();

/**
 * Gets the guild config
 *
 * @param { string } guildId The guild id
 * @returns { any } Data
 */
export async function getGuildConfig(guildId) {
  const guildSnapshot = await db.collection("guilds").doc(guildId).get();

  if (!guildSnapshot.exists) {
    new Logger().log(PREFIX, `No config found for guild ${guildId}`);
    return null;
  }

  return guildSnapshot.data();
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

export async function getGuildsByOwnerOrUser(userOrOwnerId, discordBot) {
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
  const doc = await db.collection(collection).doc(guildId).get();

  if (!doc.exists) {
    new Logger().log(PREFIX, `No config found for guild ${guildId}`);
    return null;
  }

  const data = doc.data();

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
      const guildRef = admin.firestore().collection("guilds").doc(guildId);
      await guildRef.update({
        "guildData.alias": nickname,
        "guildData.lastUpdatedGuildAlias":
          admin.firestore.FieldValue.serverTimestamp(),
      });

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
    const guildData = guildSnapshot.data();

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
    const guildData = guildSnapshot.data();

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

    const togglablesPrefix = "togglables.decaySystem";

    await admin
      .firestore()
      .collection("guilds")
      .doc(guildId)
      .update({
        [`${togglablesPrefix}.minimumCap`]: minimumCap,
      });

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

  // Calculate expiration date
  const expirationDate = add(new Date(), { minutes: expiration });

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
  const snapshot = await db.collection("codes").get();

  if (snapshot.empty) {
    new Logger().log(PREFIX, `No codes found`);
    return [];
  }

  const codes = [];
  snapshot.forEach((doc) => {
    codes.push({ id: doc.id, ...doc.data() });
  });

  const codesData = codes;

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
