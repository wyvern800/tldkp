import {
  REST,
  Routes,
  ApplicationCommandOptionType,
  PermissionFlagsBits,
} from "discord.js";
import { config } from "dotenv";
import { Logger } from "../utils/logger.js";
import * as api from "../database/repository.js";
import { isAfter, add, formatDistance } from "date-fns";
import admin from "firebase-admin";
import { LANGUAGE_EN, LANGUAGE_PT_BR } from "./constants.js";
import { servers } from "./servers.js";

config();

const PREFIX = "Discord.js/SlashCommands";

/**
 * Check if user is permitted to execute interaction
 *
 * @param { any } interaction Interaction
 * @param { PermissionFlagsBits[] } permissions Permissions
 * @returns { boolean } Wheter if its allowed or not
 */
export function isInteractionPermitted(interaction, permissions) {
  return permissions?.every((permission) =>
    interaction?.member?.permissions.has(permission)
  );
}

/**
 * Loads commands to discord cache
 */
export async function loadCommands() {
  servers.forEach(async (serverId) => {
    const rest = new REST({ version: "10" }).setToken(
      process.env.DISCORD_TOKEN
    );
    const correctedCommands = commands?.map((command) => ({
      ...command,
      commandExecution: undefined,
      permissions: undefined,
    }));

    try {
      if (process.env.ENV === "dev") {
        await rest.put(
          Routes.applicationGuildCommands(process.env.CLIENT_ID, serverId),
          { body: correctedCommands }
        );
      } else {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
          body: correctedCommands,
        });
      }
      new Logger().log(
        PREFIX,
        `Started ${commands?.length} refreshing application (/) command${
          commands?.length > 1 ? "s" : ""
        }.`
      );
    } catch (error) {
      new Logger().log(PREFIX, error);
    }
  });
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
    const response = await api.getDkpByUserId(
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
      await api?.logError(interaction.guild, msg, error);
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
    const response = await api.getDkpByUserId(
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
      await api?.logError(interaction.guild, msg, error);
    } catch (err) {}
    return interaction.reply({
      content: msg,
      ephemeral: true,
    });
  }
};

/**
 * Updates the Nickname
 *
 * @param { any } interaction Interação
 * @returns { void }
 */
export const updateNickname = async (interaction) => {
  const user = interaction.user;
  const nickname = interaction.options.getString("nickname");

  try {
    const guildData = await api.getGuildConfig(interaction.guild.id);
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
          await api.updateNickname(interaction, copyGuildData);
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
    const msg = "Error updating in-game nickname";
    new Logger(interaction).log(PREFIX, msg);
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

    // Direct query to Firestore for the specific guild document
    const guildRef = admin.firestore().collection('guilds').doc(guildId);

    // Fetch the document snapshot
    const guildSnapshot = await guildRef.get();
    
    // Ensure the document exists
    if (!guildSnapshot.exists) {
      throw new Error('Guild document not found');
    }

    // Get the data from the document snapshot
    const guildData = guildSnapshot.data();

    // Destructure the lastUpdatedGuildAlias field
    const { lastUpdatedGuildAlias } = guildData?.guildData;
    const notSetYet = !lastUpdatedGuildAlias;

    // Handle date parsing
    const updatedAtDate = lastUpdatedGuildAlias?.toDate ? lastUpdatedGuildAlias.toDate() : new Date();
    if (isNaN(updatedAtDate.getTime())) {
      new Logger(interaction).log(PREFIX, 'Invalid lastUpdatedGuildAlias date');
      return;
    }

    const future = add(updatedAtDate, { days: 10 });

    // Check if 10 days have passed or if lastUpdatedGuildAlias was never set
    if (notSetYet || isAfter(new Date(), future)) {
      // Perform the update in Firestore
      await guildRef.update({
        'guildData.alias': nickname,
        'guildData.lastUpdatedGuildAlias': admin.firestore.FieldValue.serverTimestamp(),
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
    console.log(error);
    const msg = "Error updating guild's name (alias)";
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

    // Direct query to Firestore for the specific guild document
    const guildRef = admin.firestore().collection("guilds").doc(guildId);

    // Fetch the document snapshot
    const guildSnapshot = await guildRef.get();

    // Ensure the document exists
    if (!guildSnapshot.exists) {
      new Logger(interaction).log(PREFIX, "Guild document not found");
    }
    
    const togglablesPrefix = "togglables.dkpSystem";

    const enabled = guildSnapshot.data()?.togglables?.dkpSystem?.dmNotifications;

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

// ---------------------------------------------------------------

// Here's the commands list
export const commands = [
  {
    name: "manage",
    description:
      "Manages the DKP of a player (You can set, increase or decrease)",
    options: [
      {
        name: "user",
        description: "The player we are going to attribute the DKP to",
        type: ApplicationCommandOptionType.User,
        required: true,
      },
      {
        name: "operation",
        description: "Are you Setting, Increasing or Decreasing?",
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          {
            name: "Set a player's DKP",
            value: "set",
          },
          {
            name: "Increase a player's DKP",
            value: "add",
          },
          {
            name: "Decrease a player's DKP",
            value: "remove",
          },
        ],
      },
      {
        name: "amount",
        description:
          "The value we are going to set/increase/decrease fom the DKP of a player",
        type: ApplicationCommandOptionType.Integer,
        required: true,
      },
    ],
    commandExecution: api.handleUpdateDkp,
    permissions: [PermissionFlagsBits.Administrator],
  },
  {
    name: "check",
    description: "Shows informations about your DKP",
    commandExecution: handleCheck,
    permissions: [PermissionFlagsBits.SendMessages],
  },
  {
    name: "check-other",
    description: "Check other people's DKP",
    options: [
      {
        name: "user",
        description: "Target user we're checking DKP from",
        type: ApplicationCommandOptionType.User,
        required: true,
      },
    ],
    commandExecution: checkOther,
    permissions: [PermissionFlagsBits.Administrator],
  },
  {
    name: "nickname",
    description: "Sets your ingame name",
    options: [
      {
        name: "nickname",
        description: "Your Throne & Liberty nickname",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
    commandExecution: updateNickname,
    permissions: [PermissionFlagsBits.SendMessages],
  },
  {
    name: "guild-name",
    description: "Sets your guild name (alias)",
    options: [
      {
        name: "alias",
        description: "Your Throne & Liberty guild's name",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
    commandExecution: setGuildNickname,
    permissions: [PermissionFlagsBits.Administrator],
  },
  {
    name: "language",
    description: "Changes the language of the responses of the bot.",
    options: [
      {
        name: "language",
        description: "Are you Setting, Increasing or Decreasing?",
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          {
            name: "English (en-us)",
            value: LANGUAGE_EN,
          },
          {
            name: "Portuguese (pt-BR)",
            value: LANGUAGE_PT_BR,
          },
        ],
      },
    ],
    commandExecution: api.changeLanguage,
    permissions: [PermissionFlagsBits.SendMessages],
  },
  {
    name: "help",
    description: "Get help from the bot",
    commandExecution: async (interaction) => {
      const msg = `There is a section in the website where you can see all the commands available and their usage, and also now you can check all of your member's DKPS at our brand new Dashboard.  
      [Click here to check out!](https://tldkp.net/)
      `;
      return interaction.reply({
        content: msg,
        ephemeral: true,
      });
    },
    permissions: [PermissionFlagsBits.SendMessages],
  },
  {
    name: "dkp-notifications-toggle",
    description:
      "Toggles the sending of DKP changes notifications.",
    commandExecution: toggleDkpNotifications,
    permissions: [PermissionFlagsBits.Administrator],
  },
  {
    name: "clear",
    description: "Cleans messages from a channel (Limited to 100 messages)",
    options: [
      {
        name: "amount",
        description: "Amount of messages to exclude",
        type: ApplicationCommandOptionType.Integer,
        required: true,
      },
    ],
    commandExecution: handleClear,
    permissions: [PermissionFlagsBits.Administrator],
  },
];

/**
 * Handles the commands
 *
 * @param { string } commandName The command name
 */
export async function handleCommands(interaction, commandName) {
  const commandToFind = commands?.find(
    (c) => c.name?.toLowerCase() === commandName
  );

  if (!commandToFind) {
    new Logger(interaction).log(
      `${PREFIX}/SlashCommand`,
      `Command not found: ${commandName}`
    );
    return;
  }

  // Check if user can use this command
  if (!isInteractionPermitted(interaction, commandToFind.permissions)) {
    interaction.reply({
      content: "You don't have permission to use this command.",
      ephemeral: true,
    });
  } else {
    try {
      return commandToFind.commandExecution(interaction);
    } catch (e) {
      new Logger(interaction).error(
        `${PREFIX}`,
        `Error executing command: ${commandName}`,
        e
      );
      try {
        await api?.logError(
          interaction.guild,
          `Error executing command: ${commandName}`,
          e
        );
      } catch (err) {}
      return interaction.reply({
        content: "An error occurred while executing the command.",
        ephemeral: true,
      });
    }
  }
}
