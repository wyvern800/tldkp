import {
  REST,
  Routes,
  ApplicationCommandOptionType,
  PermissionFlagsBits,
} from "discord.js";
import { config } from "dotenv";
import { Logger } from "../utils/logger.js";
import * as api from "../database/repository.js";
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
      commandCategory: undefined
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
    commandCategory: "DKP System"
  },
  {
    name: "check",
    description: "Shows informations about your DKP",
    commandExecution: api.handleCheck,
    permissions: [PermissionFlagsBits.SendMessages],
    commandCategory: "DKP System"
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
    commandExecution: api.checkOther,
    permissions: [PermissionFlagsBits.Administrator],
    commandCategory: "DKP System"
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
    commandExecution: api.updateNickname,
    permissions: [PermissionFlagsBits.SendMessages],
    commandCategory: "General"
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
    commandExecution: api.setGuildNickname,
    permissions: [PermissionFlagsBits.Administrator],
    commandCategory: "General"
  },
  {
    name: "decay-set-auto",
    description:
      "Sets the values of the 'dkp decay' system, you have to enable the system after these settings",
    options: [
      {
        name: "percentage",
        description:
          "The amount in 'percentage' of how much DKP it will be decayed",
        type: ApplicationCommandOptionType.Number,
        required: true,
      },
      {
        name: "interval",
        description:
          "The amount in 'days' of the decaying interval (The delay of when it will be executed)",
        type: ApplicationCommandOptionType.Integer,
        required: true,
        choices: [
          {
            name: "Every 7 days",
            value: 7,
          },
          {
            name: "Every 14 days",
            value: 14,
          },
          {
            name: "Every 30 days",
            value: 30,
          },
        ],
      },
    ],
    commandExecution: api.setupAutoDecay,
    permissions: [PermissionFlagsBits.Administrator],
    commandCategory: "Decay System"
  },
  {
    name: "decay-change-minimum-cap",
    description:
      "Sets the minimum DKP value someone can lose for the 'dkp decay' system.",
    options: [
      {
        name: "minimum_cap",
        description: "The minimum cap value",
        type: ApplicationCommandOptionType.Integer,
        required: true,
      }
    ],
    commandExecution: api.setMinimumCap,
    permissions: [PermissionFlagsBits.Administrator],
    commandCategory: "Decay System"
  },
  {
    name: "decay-toggle",
    description:
      "Toggles the 'dkp decay' system.",
    commandExecution: api.toggleDecay,
    permissions: [PermissionFlagsBits.Administrator],
    category: "Decay System"
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
    commandCategory: "General"
  },
  {
    name: "help",
    description: "Get help from the bot",
    commandExecution: async (interaction) => {
      const msg = `There is a section in the website where you can see all the commands available and their usage, and also now you can check all of your member's DKPS at our brand new Dashboard.  
      [Click here to check out!](https://tldkp.online/)
      `;
      return interaction.reply({
        content: msg,
        ephemeral: true,
      });
    },
    permissions: [PermissionFlagsBits.SendMessages],
    commandCategory: "General"
  },
  {
    name: "dkp-notifications-toggle",
    description:
      "Toggles the sending of DKP changes notifications.",
    commandExecution: api.toggleDkpNotifications,
    permissions: [PermissionFlagsBits.Administrator],
    commandCategory: "DKP System"
  },
  {
    name: "dkp-allow-below-zero",
    description:
      "Toggles the possibility of having DKP below zero (to allow debit).",
    commandExecution: api.toggleBelowZero,
    permissions: [PermissionFlagsBits.Administrator],
    category: "DKP System"
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
    commandExecution: api.handleClear,
    permissions: [PermissionFlagsBits.Administrator],
    commandCategory: "General"
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
