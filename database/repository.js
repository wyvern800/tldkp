import { db } from "./firebase.js"; // Import Firestore
import admin from "firebase-admin";
import { Logger } from "../utils/logger.js";

const defaultConfig = {
  createdAt: admin.firestore.FieldValue | null,
  updatedAt: admin.firestore.FieldValue | null,
  dkps: [],
};

export async function getGuildConfig(guildId) {
  const doc = await db.collection("guilds").doc(guildId).get();

  if (!doc.exists) {
    new Logger().log('Firebase', `No config found for guild ${guildId}`);
    return null;
  }

  return doc.data();
};

/**
 * Create the guild config
 * 
 * @param { string } guildId The guild id
 * @returns { any } Response
 */
export async function guildCreate(guildId)  {
  const res = await db.collection("guilds").doc(guildId).set(defaultConfig);
  new Logger().log('Firebase', `Config added for guild ${guildId}`);
  return res;
};

export async function handlePrefixCall(interaction) {
  // Example command to get/set prefix
  const newPrefix = interaction.options.getString("prefix");
  if (newPrefix) {
    await db
      .collection("guilds")
      .doc(interaction.guild.id)
      .update({ prefix: newPrefix });
    return interaction.reply(`Prefix updated to ${newPrefix}`);
  } else {
    const msg = "Something unexpected happened";
    new Logger(interaction).error(msg);
    return interaction.reply(msg);
  }
};