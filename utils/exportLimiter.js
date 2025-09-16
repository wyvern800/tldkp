import { db } from "../database/firebase.js";
import { Logger } from "./logger.js";

const PREFIX = "ExportLimiter";

/**
 * Check if user can export data based on their subscription status and rate limits
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Guild ID
 * @param {boolean} isPremium - Whether the guild has premium subscription
 * @returns {Promise<{canExport: boolean, nextExportDate?: Date, reason?: string}>}
 */
export async function checkExportPermission(userId, guildId, isPremium) {
  try {
    // Premium users can always export
    if (isPremium) {
      return { canExport: true };
    }

    // Check free user's export history
    const exportLogsRef = db.collection("exportLogs");
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentExports = await exportLogsRef
      .where("userId", "==", userId)
      .where("guildId", "==", guildId)
      .where("timestamp", ">=", oneWeekAgo)
      .get();

    if (recentExports.empty) {
      return { canExport: true };
    }

    // Free user has already exported this week
    const lastExport = recentExports.docs[0].data();
    const nextExportDate = new Date(lastExport.timestamp.toDate());
    nextExportDate.setDate(nextExportDate.getDate() + 7);

    return {
      canExport: false,
      nextExportDate,
      reason: "Free users can only export once per week. Upgrade to premium for unlimited exports."
    };
  } catch (error) {
    new Logger().error(PREFIX, `Error checking export permission: ${error.message}`);
    return { canExport: false, reason: "Error checking export permissions" };
  }
}

/**
 * Log an export event for rate limiting
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Guild ID
 * @param {string} exportType - Type of export (csv, json, etc.)
 * @returns {Promise<void>}
 */
export async function logExportEvent(userId, guildId, exportType = "csv") {
  try {
    await db.collection("exportLogs").add({
      userId,
      guildId,
      exportType,
      timestamp: new Date(),
      createdAt: new Date()
    });
    
    new Logger().log(PREFIX, `Export logged for user ${userId} in guild ${guildId}`);
  } catch (error) {
    new Logger().error(PREFIX, `Error logging export event: ${error.message}`);
  }
}

/**
 * Get user's export history
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Guild ID
 * @returns {Promise<Array>} Export history
 */
export async function getExportHistory(userId, guildId) {
  try {
    const exportLogsRef = db.collection("exportLogs");
    const exports = await exportLogsRef
      .where("userId", "==", userId)
      .where("guildId", "==", guildId)
      .orderBy("timestamp", "desc")
      .limit(10)
      .get();

    return exports.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp.toDate()
    }));
  } catch (error) {
    new Logger().error(PREFIX, `Error getting export history: ${error.message}`);
    return [];
  }
}
