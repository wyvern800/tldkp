import { Client, GatewayIntentBits, InteractionType } from "discord.js";
import { handleCommands, handleAutoComplete, handleSubmitModal } from "../../utils/commands.js";
import { loadCommands } from "../../utils/commands.js";
import * as api from "../../database/repository.js";
import { Logger } from "../../utils/logger.js";
import { threadListeners } from "../../database/repository.js";
import { analytics,  trackBotStatus, trackError } from "../../utils/analytics.js";

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
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessageReactions
    ],
  });

  // When bot is started
  client.once("ready", async () => {
    await Promise.all([
      loadCommands(client)
      .then(() => new Logger().log(PREFIX, `Logged in as ${client.user.tag}!`))
      .catch(() => new Logger().error(PREFIX, `Failed to load commands`)),
        api.loadAllAuctions(client)
      .then((auctions) => new Logger().log(PREFIX, `Loaded ${auctions} auctions.`))
      .catch((e) => {
         console.log(e);
         new Logger().error(PREFIX, `Failed to load auctions`) 
        })
    ]).finally(async () => {
      new Logger().log(
        PREFIX,
        `Bot is in ${client.guilds.cache.size} guild(s).`
      );
      
      // Track bot startup in Google Analytics
      await trackBotStatus({
        status: 'started',
        guildCount: client.guilds.cache.size,
        uptime: process.uptime(),
        version: '1.0.2'
      });
    });
  });

  // When the bot joins a new guild
  client.on("guildCreate", async (guild) => {
    const response = await api.getGuildConfig(guild.id, 'guildCreateEvent from bot.js');

    if (response) {
      new Logger().log(PREFIX, `Guild data already exists!`);
      return;
    }

    await api
      .guildCreate(guild)
      .catch(async (error) => {
        new Logger.error(PREFIX, `Failed to create guild.`, error);
      });
  });

  // When a new member joins the guild
  client.on('guildMemberAdd', async (member) => {
    const guildId = member.guild.id;
    const userId = member.id;

    // Fetch the guild configuration
    const guildConfig = await api.getGuildConfig(guildId, 'guildMemberAddEvent from bot.js');

    // Check if guild config exists
    if (!guildConfig) {
      new Logger().log(PREFIX, `Guild config not found for ${guildId}, skipping member add`);
      return;
    }

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
    const { commandName } = interaction;
    if (interaction.isCommand()) {
      // Track command execution in Google Analytics
      const startTime = Date.now();
      let success = false;
      let error = null;
      
      try {
        await handleCommands(interaction, commandName?.toLowerCase());
        success = true;
      } catch (err) {
        error = err.message || 'Unknown error';
        throw err;
      } finally {
        const executionTime = Date.now() - startTime;
        
        // Track the command execution in Google Analytics
        await analytics.trackCommand(
          interaction.commandName,
          interaction.guildId,
          interaction.user?.id,
          {
            channelId: interaction.channelId,
            options: interaction.options?.data || {},
            success,
            error,
            executionTime
          }
        );
      }
    } else if (interaction.type === InteractionType.ModalSubmit){
      const [command,] = interaction.customId.split("#");
      await handleSubmitModal(interaction, command?.toLowerCase());
    } else if (interaction.isAutocomplete()) {
      await handleAutoComplete(interaction, commandName?.toLowerCase());
    }
  });

  // When a thread is deleted
  client.on('threadDelete', (thread) => {
    new Logger().logLocal(PREFIX, `Thread deleted: ${thread.name} (${thread.id})`);

    // Remove the listener for this thread
    const listener = threadListeners.get(thread.id);
    if (listener) {
        client.removeListener('interactionCreate', listener);
        threadListeners.delete(thread.id);
        new Logger().logLocal(PREFIX, `Listener removed for thread ${thread.name}`);
    }
  });

  // Handle global issues
  client.on('unhandledRejection', async (reason, _) => {
    try {
      new Logger().error(`Unhandled Promise Rejection: ${reason} - ${_}`);
      
      // Track error in Google Analytics
      await trackError({
        errorType: 'unhandled_rejection',
        errorMessage: reason?.toString() || 'Unknown rejection',
        errorStack: reason?.stack || null
      });
    } catch (error) {}
  });

  process.on('uncaughtException', async (error) => {
    try {
      new Logger().criticalError(`Uncaugth exception: ${error}`);
      
      // Track error in Google Analytics
      await trackError({
        errorType: 'uncaught_exception',
        errorMessage: error.message,
        errorStack: error.stack
      });
    } catch (err) {}
  });

  return client;
};
