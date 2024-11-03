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
      GatewayIntentBits.GuildMembers
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

  // When a new member joins the guild
  client.on('guildMemberAdd', async (member) => {
    const guildId = member.guild.id;
    const userId = member.id;

    // Fetch the guild configuration
    const guildConfig = await api.getGuildConfig(guildId);

    // Ensure the guild's DKP array is initialized
    if (!guildConfig.memberDkps) {
      guildConfig.memberDkps = [];
    }

    // Check if the member is already in the DKP array
    const memberExists = guildConfig.memberDkps.some((dkp) => dkp.userId === userId);

    // If the member is not in the DKP array, add them
    if (!memberExists) {
      try {
        
        const dkpToGive = guildConfig?.togglables?.dkpSystem?.onJoinDKPAmount ?? 0;
        if (guildConfig?.togglables?.dkpSystem?.roleToAssign) {
          try {
            const role = member.guild.roles.cache.find((role) => role.id === guildConfig?.togglables?.dkpSystem?.roleToAssign);
            if (role) {
              member.roles.add(role);
            } else {
              new Logger().error(PREFIX, `Failed to find role to assign to new member ${userId}.`);
            }
          } catch (e) {
            new Logger().error(PREFIX, `Failed to assign role to new member ${userId}.`);
          }
        }

        guildConfig.memberDkps.push({ userId, dkp: dkpToGive });

        await api.updateGuildConfig(guildId, guildConfig);
      } catch (e) {
        new Logger().error(PREFIX, `Failed to add new member ${userId} to DKP array.`);
      }
      if (process.env.ENV === 'dev') {
        new Logger().log(PREFIX, `Added new member ${userId} to DKP array.`);
      }
    }
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
