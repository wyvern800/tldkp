import { Client, GatewayIntentBits, PermissionFlagsBits } from "discord.js";
import { handleCommands } from "../../utils/commands.js";
import { loadCommands } from "../../utils/commands.js";
import * as api from "../../database/repository.js";
import { Logger } from "../../utils/logger.js";
import { logError } from "../../database/repository.js";

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
    const response = await api.getGuildConfig(guild.id);

    if (response) {
      new Logger().log(PREFIX, `Guild data already exists!`);
      return;
    }

    await api
      .guildCreate(guild)
      .catch(async (error) => {
        await api.logError(guild, `Failed to create guild.`, error);
      });
  });

  // When interactions happen
  client.on("interactionCreate", async (interaction) => {
    if (interaction.isCommand()) {
      const { commandName } = interaction;

      await handleCommands(interaction, commandName?.toLowerCase());
    }
  });

  // Handle global issues
  client.on('unhandledRejection', async (reason, _) => {
    try {
      new Logger().error(`Unhandled Promise Rejection: ${reason}`);	
      await logError(PREFIX, `Unhandled Promise Rejection: ${reason}`, reason);
    } catch (error) {}
  });

  process.on('uncaughtException', async (error) => {
    try {
      new Logger().error(`Uncaugth exception: ${error}`);	
      await logError(PREFIX, `Uncaugth exception: ${error}`, error);
    } catch (err) {}
  });

  return client;
};
