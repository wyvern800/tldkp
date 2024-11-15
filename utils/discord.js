import discord, { Routes } from "discord.js";
const { REST } = discord;
import { config } from "dotenv";
import { Logger } from "../utils/logger.js";

config();

/**
 * Get the member data from discord
 *
 * @param { string } guildId Guild id
 * @param { string } memberId Member id
 * @returns
 */
export async function getMemberById(guildId, memberId) {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  try {
    return await rest.get(
      Routes.guildMember(guildId, memberId)
    );
  } catch (error) {
    new Logger().log("Discord.js", "Member couuld not be found");
  }
}
