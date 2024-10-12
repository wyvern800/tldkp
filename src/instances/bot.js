import { Client, GatewayIntentBits, PermissionFlagsBits } from "discord.js";
import { handleClear } from "../../utils/commands/index.js";
import { loadCommands } from "../../utils/index.js";

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
    loadCommands(client);
    console.log(`[DiscordJS] Logged in as ${client.user.tag}!`);
  });

  // When interactions happen
  client.on("interactionCreate", async (interaction) => {
    if (interaction.isCommand()) {
      const { commandName } = interaction;

      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({
          content: "You don't have permission to use these commands.",
          ephemeral: true,
        });
      }

      switch (commandName.toLowerCase()) {
        case "clear":
          return await handleClear(interaction);
        default:
          console.log(`Command not found: ${commandName}`);
          break;
      }
    }
  });

  return client;
};