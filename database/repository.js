import { db } from "./firebase.js"; // Import Firestore
import admin from "firebase-admin";
import { Logger } from "../utils/logger.js";
import { updateDkp, setDkp, isPositiveNumber } from "../utils/index.js";
import { LANGUAGE_EN, LANGUAGE_PT_BR } from "../utils/constants.js";
import { getMemberById } from "../utils/discord.js";

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
          memberDkps: filteredMembers, // Only include relevant members
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
      lastUpdatedGuild : null,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    language: LANGUAGE_EN,
    memberDkps: [],
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

      setDkp(newDkp, user.id, amount, user, guildDataResponse?.guildData?.name);

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
        guildDataResponse?.guildData?.name
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
 * Handles the nickname update
 *
 * @param { any } interaction The interaction
 * @param { string } guildData The new nickname
 * @returns { any } Response
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
