import discord from "discord.js";
const { REST, Routes, ApplicationCommandOptionType, PermissionFlagsBits, InteractionType } = discord;
import { config } from "dotenv";
import { Logger } from "../utils/logger.js";
import * as api from "../database/repository.js";
import { LANGUAGE_EN, LANGUAGE_PT_BR } from "./constants.js";
import { servers } from "./servers.js";
import { isRateLimited } from '../utils/commandLimiter.js'; 

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
  return permissions?.some((permission) => interaction?.member?.permissions.has(permission));
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
      commandCategory: undefined,
      new: undefined,
      noExecution: undefined
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
    permissions: [PermissionFlagsBits.Administrator, PermissionFlagsBits.CreateEvents],
    commandCategory: "DKP System"
  },
  {
    name: "check",
    description: "Shows informations about your DKP",
    commandExecution: api.handleCheck,
    permissions: [PermissionFlagsBits.UseApplicationCommands],
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
    permissions: [PermissionFlagsBits.Administrator, PermissionFlagsBits.CreateEvents],
    commandCategory: "DKP System"
  },
  {
    name: "set-ign",
    description: "Set a member's In-Game Name (IGN)",
    options: [
      {
        name: "user",
        description: "The member whose IGN you want to set",
        type: ApplicationCommandOptionType.User,
        required: true,
      },
      {
        name: "ign",
        description: "The In-Game Name to set",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
    commandExecution: api.setMemberIgn,
    permissions: [PermissionFlagsBits.Administrator, PermissionFlagsBits.CreateEvents],
    commandCategory: "DKP System",
    new: true
  },
  {
    name: "view-igns",
    description: "View all member IGNs in the guild",
    commandExecution: api.viewMemberIgns,
    permissions: [PermissionFlagsBits.Administrator, PermissionFlagsBits.CreateEvents],
    commandCategory: "DKP System",
    new: true
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
    permissions: [PermissionFlagsBits.UseApplicationCommands],
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
    permissions: [PermissionFlagsBits.UseApplicationCommands],
    commandCategory: "General"
  },
  {
    name: "help",
    description: "Get help from the bot",
    commandExecution: async (interaction) => {
      const msg = `There is a section in the website where you can see all the commands available and their usage, and also now you can check all of your member's DKPS at our brand new Dashboard.  
      [Click here to check out!](https://tldkp.org/)
      `;
      return await interaction.reply({
        content: msg,
        ephemeral: true,
      });
    },
    permissions: [PermissionFlagsBits.UseApplicationCommands],
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
    name: "generate-code",
    description: "Generates a claimable code for earning DKP",
    options: [
      {
        name: "amount",
        description:
          "The amount of DKP the player will earn from the this code",
        type: ApplicationCommandOptionType.Integer,
        required: true,
      },
      {
        name: "expiration-in-minutes",
        description:
          "The expiration time (in minutes) of how long this code will be available for",
        type: ApplicationCommandOptionType.Number,
        choices: [
          {
            name: "2 minutes",
            value: 2,
          },
          {
            name: "5 minutes",
            value: 5,
          },
          {
            name: "10 minutes",
            value: 10,
          },
          {
            name: "15 minutes",
            value: 15,
          },
          {
            name: "20 minutes",
            value: 20,
          },
          {
            name: "25 minutes",
            value: 25,
          },
          {
            name: "30 minutes",
            value: 30,
          },
          {
            name: "35 minutes",
            value: 35,
          },
           {
            name: "40 minutes",
            value: 40,
          },
           {
            name: "45 minutes",
            value: 45,
          },
           {
            name: "50 minutes",
            value: 50,
           }, {
            name: "1 hour",
            value: 60,
          },
        ],
        required: true,
      },
      {
        name: "note",
        description:
          "Any note about this token? event name, etc... (Optional)",
        type: ApplicationCommandOptionType.String,
        required: false,
      },
    ],
    commandExecution: api.generateDkpCode,
    permissions: [PermissionFlagsBits.Administrator, PermissionFlagsBits.CreateEvents],
    commandCategory: "DKP System",
    new: false
  },
  {
    name: "claim",
    description: "Claim an existing code to earn DKP",
    options: [
      {
        name: "code",
        description: "The code you want to claim to earn",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
    commandExecution: api.redeemDkpCode,
    permissions: [PermissionFlagsBits.UseApplicationCommands],
    commandCategory: "DKP System",
    new: false
  },
  {
    name: "set-on-member-join",
    description:
      "Assigns a role to new members and optionally awards DKP",
    options: [
      {
        name: "role",
        description: "The role you want to assign to new members",
        type: ApplicationCommandOptionType.Role,
        required: false,
      },
      {
        name: "amount",
        description: "The amount of DKP you want to give to new members",
        type: ApplicationCommandOptionType.Integer,
        required: false,
      }
    ],
    commandExecution: api.setRoleOnJoin,
    permissions: [PermissionFlagsBits.Administrator],
    commandCategory: "DKP System",
    new: false
  },
  {
    name: "auction-create",
    description:
      "Creates an auction for an item",
    options: [
      {
        name: "item",
        type: ApplicationCommandOptionType.String,
        description: "The name of the item",
        required: true,
        autocomplete: true,
      },
      {
        name: "note",
        type: ApplicationCommandOptionType.String,
        description: "Trait? Stats? Anything you want to add",
        required: true,
      },
    ],
    commandExecution: api.createAuction,
    handleAutocomplete: api.handleAuctionAutocomplete,
    handleSubmitModal: api.handleSubmitModalCreateAuction,
    permissions: [PermissionFlagsBits.Administrator, PermissionFlagsBits.CreateEvents],
    commandCategory: "Auction System",
    new: true
  },
  {
    name: "bid",
    description:
      "Bid on an auction",
    options: [
      {
        name: "dkp",
        type: ApplicationCommandOptionType.Number,
        description: "The amount of DKP",
        required: true,
      }
    ],
    permissions: [PermissionFlagsBits.UseApplicationCommands],
    commandCategory: "Auction System",
    new: true,
    noExecution: true
  },
  {
    name: "check-permissions",
    description: "Check if the bot has all required permissions",
    commandExecution: api.checkBotPermissions,
    permissions: [PermissionFlagsBits.Administrator],
    commandCategory: "General",
    new: true
  },
  {
    name: "admin-search-guilds",
    description: "Search for guilds by name (Admin only)",
    options: [
      {
        name: "search_term",
        description: "The name or part of the name to search for",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "limit",
        description: "Maximum number of results to return (default: 10)",
        type: ApplicationCommandOptionType.Integer,
        required: false,
        min_value: 1,
        max_value: 50,
      }
    ],
    commandExecution: api.searchGuilds,
    permissions: [PermissionFlagsBits.Administrator],
    commandCategory: "Admin",
    new: true,
    isHidden: true
  },
  {
    name: "admin-set-premium",
    description: "Set premium status for a guild (Admin only)",
    options: [
      {
        name: "guild_id",
        description: "The ID of the guild to update",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "is_premium",
        description: "Whether to enable premium access",
        type: ApplicationCommandOptionType.Boolean,
        required: true,
      },
      {
        name: "expires_at",
        description: "When the subscription expires (YYYY-MM-DD format, leave empty for lifetime)",
        type: ApplicationCommandOptionType.String,
        required: false,
      },
      {
        name: "plan_type",
        description: "The type of plan",
        type: ApplicationCommandOptionType.String,
        required: false,
        choices: [
          {
            name: "Free",
            value: "free",
          },
          {
            name: "Trial (7 days)",
            value: "trial",
          },
          {
            name: "Premium (Monthly)",
            value: "premium",
          },
          {
            name: "Lifetime",
            value: "lifetime",
          },
        ],
      }
    ],
    commandExecution: api.setGuildPremium,
    permissions: [PermissionFlagsBits.Administrator],
    commandCategory: "Admin",
    new: true,
    isHidden: true
  },
  {
    name: "admin-check-premium",
    description: "Check premium status of a guild (Admin only)",
    options: [
      {
        name: "guild_id",
        description: "The ID of the guild to check",
        type: ApplicationCommandOptionType.String,
        required: true,
      }
    ],
    commandExecution: api.checkGuildPremium,
    permissions: [PermissionFlagsBits.Administrator],
    commandCategory: "Admin",
    new: true,
    isHidden: true
  },
  {
    name: "premium-status",
    description: "Check your server's premium subscription status",
    commandExecution: api.checkServerPremiumStatus,
    permissions: [PermissionFlagsBits.UseApplicationCommands],
    commandCategory: "General",
    new: true
  }

  /*{
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
  },*/,
  {
    name: "time-ban",
    description: "Time-ban a user from claiming DKP points",
    options: [
      {
        name: "user",
        description: "The user to time-ban from claiming DKP",
        type: ApplicationCommandOptionType.User,
        required: true,
      },
      {
        name: "duration",
        description: "Duration of the ban in minutes",
        type: ApplicationCommandOptionType.Integer,
        required: true,
        min_value: 1,
        max_value: 10080, // 1 week max
      },
      {
        name: "expose",
        description: "Whether to expose the ban publicly (default: false)",
        type: ApplicationCommandOptionType.Boolean,
        required: false,
      },
      {
        name: "reason",
        description: "Reason for the time-ban",
        type: ApplicationCommandOptionType.String,
        required: false,
      },
    ],
    commandExecution: api.handleTimeBan,
    permissions: [PermissionFlagsBits.Administrator, PermissionFlagsBits.CreateEvents],
    commandCategory: "General",
    new: true
  },
  {
    name: "time-unban",
    description: "Remove time-ban from a user, allowing them to claim DKP again",
    options: [
      {
        name: "user",
        description: "The user to unban from claiming DKP",
        type: ApplicationCommandOptionType.User,
        required: true,
      },
    ],
    commandExecution: api.handleTimeUnban,
    permissions: [PermissionFlagsBits.Administrator, PermissionFlagsBits.CreateEvents],
    commandCategory: "General",
    new: true
  },
  {
    name: "challenge",
    description: "Challenge another player to a DKP gamble",
    options: [
      {
        name: "user",
        description: "The player you want to challenge",
        type: ApplicationCommandOptionType.User,
        required: true,
      },
      {
        name: "amount",
        description: "The amount of DKP to bet (minimum 5)",
        type: ApplicationCommandOptionType.Integer,
        required: true,
        min_value: 5,
      },
    ],
    commandExecution: api.handleChallenge,
    permissions: [PermissionFlagsBits.UseApplicationCommands],
    commandCategory: "Gambling System",
    new: true
  },
  {
    name: "accept",
    description: "Accept a pending challenge",
    commandExecution: api.handleAcceptChallenge,
    permissions: [PermissionFlagsBits.UseApplicationCommands],
    commandCategory: "Gambling System",
    new: true
  },
];

/**
 * Get permission in a verbose way
 * @param { PermissionFlagsBits } permission The permission
 * @returns Verbose way
 */
export const getPermissionVerbose = (permission) => {
  switch (permission) {
    case PermissionFlagsBits.Administrator:
      return "Administrator";
    case PermissionFlagsBits.UseApplicationCommands:
      return "Use Application Commands";
    case PermissionFlagsBits.CreateEvents:
      return "Create Events";  
    default:
      return "Unknown";
  }
}

/**
 * Answer correct based on the kind of the interaction
 * 
 * @param {any} interaction The interaction
 * @param {any} answer The answer
 */
const anwerInteraction = async (interaction, answer) => {
  if (interaction.isCommand() || interaction.type === InteractionType.ModalSubmit) {
    return await interaction.reply(answer);
  } else {
    return await interaction.respond(answer);
  } 
}

/**
 * Handles the commands
 *
 * @param { string } commandName The command name
 */
export async function handleCommands(interaction, commandName) {
  const userId = interaction.user.id;

  const commandToFind = commands?.find(
    (c) => c.name?.toLowerCase() === commandName
  );

  if (interaction.isCommand() && isRateLimited(userId, process.env.MAX_COMMANDS_PER_MINUTE) && !commandToFind?.noExecution) {
    try {
      await anwerInteraction(interaction, {
        content: "You have exceeded the maximum number of commands per minute. Please try again later.",
        ephemeral: true,
      });
    } catch (error) {
      console.log(error)
      new Logger(interaction).logLocal(
        `${PREFIX}`,
        `Error sending message to user about rate limit`,
        error
      );
    }
    return;
  }

  if (!commandToFind) {
    new Logger(interaction).log(
      `${PREFIX}/SlashCommand`,
      `Command not found: ${commandName}`
    );
    return;
  }

  // Check if user can use this command
  if (!isInteractionPermitted(interaction, commandToFind.permissions)) {
    const missingPermissions = commandToFind.permissions?.map((permission) => getPermissionVerbose(permission)).join(", ");
    try {
      await anwerInteraction(interaction, {
        content: `You don't have permission to use this command.\nYou're missing the permissions: **${missingPermissions}**`,
        ephemeral: true,
      });
    } catch (error) {
      new Logger(interaction).logLocal(
        `${PREFIX}`,
        `Error sending message to user about missing permissions`,
        error
      );
    }
  } else {
    try {
        if (!commandToFind?.noExecution) {
          return commandToFind.commandExecution(interaction);
        }
    } catch (e) {
      new Logger(interaction).error(
        `${PREFIX}`,
        `Error executing command: ${commandName}`,
        e
      );
      let toRespond = anwerInteraction(interaction, {
        content: "An error occurred while executing the command.",
        ephemeral: true,
      });
      return await toRespond;
    }
  }
}

/**
 * Handles the submit of a modal
 * @param {any} interaction  The interaction
 * @param {*} commandName The commandName we're ggint the interaction from
 */
export const handleAutoComplete = async (interaction, commandName) => {
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

  try {
    return commandToFind.handleAutocomplete(interaction);
  } catch (e) {
    new Logger(interaction).error(
      `${PREFIX}`,
      `Error parsing autocompletion for command: ${commandName}`,
      e
    );
    let toRespond = anwerInteraction(interaction, {
      content: "An error occurred while executing the command.",
      ephemeral: true,
    });
    return await toRespond;
  }
}

/**
 * Handles the submit of a modal
 * @param {any} interaction  The interaction
 */
export const handleSubmitModal = async (interaction) => {
  const [command,] = interaction.customId.split("#");
  
  const commandToFind = commands?.find(
    (c) => c.name?.toLowerCase() === command
  );

  if (!commandToFind) {
    new Logger(interaction).log(
      `${PREFIX}/SlashCommand`,
      `Command not found: ${command}`
    );
    return;
  }

  try {
    return commandToFind.handleSubmitModal(interaction);
  } catch (e) {
    new Logger(interaction).error(
      `${PREFIX}`,
      `Error sumitting modal for command: ${command}`,
      e
    );
    let toRespond = anwerInteraction(interaction, {
      content: "An error occurred while executing the command.",
      ephemeral: true,
    });
    return await toRespond;
  }
}

/**
 * Handles button interactions
 * @param {any} interaction The interaction
 */
export const handleButtonInteraction = async (interaction) => {
  const customId = interaction.customId;
  
  try {
    // Handle challenge accept button
    if (customId.startsWith('challenge_accept_')) {
      const challengeId = customId.replace('challenge_accept_', '');
      return await api.handleAcceptChallengeButton(interaction, challengeId);
    }
    
    // Handle challenge decline button
    if (customId.startsWith('challenge_decline_')) {
      const challengeId = customId.replace('challenge_decline_', '');
      return await api.handleDeclineChallengeButton(interaction, challengeId);
    }
    
    // This function should only be called for challenge buttons now
    // All other buttons are handled by their respective collectors
    return false;
  } catch (e) {
    new Logger(interaction).error(
      `${PREFIX}`,
      `Error handling button interaction: ${customId}`,
      e
    );
    return await interaction.reply({
      content: "An error occurred while processing the button interaction.",
      ephemeral: true,
    });
  }
}