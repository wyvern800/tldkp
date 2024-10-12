import { REST, Routes } from "discord.js";
import { config } from "dotenv";
import { Logger } from "../utils/logger.js";
import { STRING, INTEGER } from "../utils/constants.js";
import * as api from "../database/repository.js";

config();

const PREFIX = "Discord.js/SlashCommands";

/**
 * Check if user is permitted to execute interaction
 *
 * @param { any } interaction Interaction
 * @param { PermissionFlagsBits[] } permissions Permissions
 * @returns { boolean } Wheter if its allowed or not
 */
export async function isInteractionPermitted(interaction, permissions) {
  return permissions
    ?.map()
    ?.every((permission) => interaction?.member?.permissions.has(permission));
}

/**
 * Loads commands to discord cache
 */
export async function loadCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    if (process.env.ENV === "dev") {
      await rest.put(
        Routes.applicationGuildCommands(
          process.env.CLIENT_ID,
          process.env.GUILD_ID
        ),
        { body: commands }
      );
    } else {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
        body: commands?.map(command => { return { ...command, commandExecution: undefined }}),
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
 * Handle the prefix
 *
 * @param { any } interaction The interaction
 * @returns { void } What happened
 */
async function handlePrefix(interaction) {
  await api.handlePrefixCall(interaction);
}

// ---------------------------------------------------------------

const commands = [
  {
    name: "clear",
    description: "Cleans messages from discord",
    options: [
      {
        name: "amount",
        description: "Amount of messages to exclude",
        type: INTEGER,
        required: true,
      },
    ],
    commandExecution: handleClear,
  },
  {
    name: "prefix",
    description: "test prefix",
    options: [
      {
        name: "prefix",
        description: "prefix",
        type: STRING,
        required: true,
      },
    ],
    commandExecution: handlePrefix,
  },
];

/**
 * Handles the commands
 *
 * @param { string } commandName The command name
 */
export async function handleCommands(interaction, commandName) {
  const commandToFind = commands?.find(c => c.name?.toLowerCase() === commandName);

  if (!commandToFind) {
    new Logger(interaction).log(
      `${PREFIX}/SlashCommand`,
      `Command not found: ${commandName}`
    );
    return;
  }

  return commandToFind.commandExecution(interaction);
}
