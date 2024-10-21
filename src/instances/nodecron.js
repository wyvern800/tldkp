import cron from "node-cron";
import * as api from "../../database/repository.js";
import { add, isEqual, isAfter } from "date-fns";
import admin from "firebase-admin";
import { Logger } from "../../utils/logger.js";
import { config } from "dotenv";

config();

const PREFIX = "Cron";

/**
 * Schedules a cron job to run once per day at midnight.
 * The job retrieves all guilds, processes each guild's DKP decay system,
 * and updates the guild's data in the Firestore database.
 * 
 * The DKP decay system reduces each member's DKP by a specified percentage,
 * ensuring that the DKP does not fall below a minimum cap.
 * 
 * Logs the execution of the decay system for monitoring purposes.
 */
const decay = async () => {
  const decayTask = cron.schedule(
    process.env.ENV === "dev" ? "*/15 * * * * *": "0 0 * * *",
    async () => {
      const guilds = await api.getAllGuilds(); // Await the promise

      const guildNames = guilds.map(async (guild) => {
        const { enabled, lastUpdated, interval, percentage, minimumCap } =
          guild?.togglables?.decaySystem ?? {};
        const { memberDkps } = guild ?? {};

        if (Object.keys(guild).length > 0) {
          const lastUpdatedDate =
            lastUpdated instanceof admin.firestore.Timestamp
              ? lastUpdated.toDate() // Convert Timestamp to Date
              : new Date();

          const futureDate = add(lastUpdatedDate, { days: interval });

          if (
            lastUpdated &&
            enabled &&
            (isEqual(new Date(), futureDate) || isAfter(new Date(), futureDate))
          ) {
            const togglables = "togglables.decaySystem";

            let newMemberDkps = [...memberDkps];
            newMemberDkps.forEach(async (member) => {
              const currentDkp = member?.dkp ?? 0;

              if (currentDkp > 0) {
                const decayedDkp = parseFloat(
                  (currentDkp - currentDkp * (percentage / 100)).toFixed(2)
                );
                member.dkp = decayedDkp < minimumCap ? minimumCap : decayedDkp;

                // Ensure guildRef is defined and points to the correct Firestore reference
                const guildRef = admin
                  .firestore()
                  .collection("guilds")
                  .doc(guild.id);

                await guildRef.update({
                  [`${togglables}.lastUpdated`]: futureDate,
                  memberDkps: newMemberDkps,
                });
              }
              return member;
            });
          }
        }
        return guild; // Return the guild name
      });

      new Logger().log(
        PREFIX,
        `Decay system executed on ${
          (await Promise.all(guildNames)).length // Await all promises
        } guilds at ${new Date()} at America/Sao_Paulo timezone`
      );
    },
    {
      scheduled: true,
      timezone: "America/Sao_Paulo",
    }
  );

  return decayTask;
};

/**
 * Schedules a cron job to run once per day at midnight.
 * The job retrieves all guilds, processes each guild's DKP decay system,
 * and updates the guild's data in the Firestore database.
 * 
 * The DKP decay system reduces each member's DKP by a specified percentage,
 * ensuring that the DKP does not fall below a minimum cap.
 * 
 * Logs the execution of the decay system for monitoring purposes.
 */
export async function start() {
  const tasks = [await decay()];
  tasks.forEach((task) => task.start());
  new Logger().log(
    PREFIX,
    `Instance started at ${new Date()} at America/Sao_Paulo timezone`
  );
}
