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
  return permissions?.every((permission) => interaction?.member?.permissions.has(permission));
}

/**
 * Loads commands to discord cache
 */
export async function loadCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  const correctedCommands = commands?.map((command) => ({
    ...command,
    commandExecution: undefined,
    permissions: undefined,
  }));

  try {
    if (process.env.ENV === "dev") {
      await rest.put(
        Routes.applicationGuildCommands(
          process.env.CLIENT_ID,
          process.env.GUILD_ID
        ),
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
  console.log(user)
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
    permissions: [PermissionFlagsBits.SendMessages],
  },
  {
    name: "check",
    description: "Shows informations about your DKP",
    commandExecution: handleCheck,
    permissions: [PermissionFlagsBits.SendMessages],
  },
  {
    name: "check-other",
    description: "Sets your ingame name",
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
      return interaction.reply({
        content: "https://tldkp.net",
        ephemeral: true,
      });
    },
    permissions: [PermissionFlagsBits.SendMessages],
  },
  {
    name: "clear",
    description: "Cleans messages from a channel (Limited to 100 messages)",
    options: [
      {
        name: "amount",
        description: "Amount of messages to exclude",
        type: ApplicationCommandOptionType.Integer,
        required: true
      },
    ],
    commandExecution: handleClear,
    permissions: [PermissionFlagsBits.Administrator],
  }
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
