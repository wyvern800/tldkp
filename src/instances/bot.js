import { Client, GatewayIntentBits, PermissionFlagsBits } from "discord.js";
import { handleCommands } from "../../utils/commands.js";
import { loadCommands, isInteractionPermitted } from "../../utils/commands.js";
import * as api from "../../database/repository.js";
import { Logger } from "../../utils/logger.js";

const PREFIX = "Discord.js";

/**
 * Creates the bot client
 *
 * @returns { void }
 */
export const createBotClient = () => {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
  });

  // When bot is started
  client.once("ready", async () => {
    await loadCommands(client)
      .then(() => new Logger().log(PREFIX, `Logged in as ${client.user.tag}!`))
      .catch(() => new Logger().error(PREFIX, `Failed to load commands`))
      .finally(() =>
        new Logger().log(
          PREFIX,
          `Bot is in ${client.guilds.cache.size} guild(s).`
        )
      );
  });

  // When the bot joins a new guild
  client.on("guildCreate", async (guild) => {
    await api
      .guildCreate(guild.id)
      .catch(() => new Logger().error(PREFIX, `Failed to create guild`));
  });

  // When interactions happen
  client.on("interactionCreate", async (interaction) => {
    if (interaction.isCommand()) {
      const { commandName } = interaction;

      // Check if user can use this command
      if (!isInteractionPermitted([PermissionFlagsBits.SendMessages])) {
        return interaction.reply({
          content: "You don't have permission to use these commands.",
          ephemeral: true,
        });
      }

      await handleCommands(interaction, commandName?.toLowerCase());
    }
  });

  return client;
};
