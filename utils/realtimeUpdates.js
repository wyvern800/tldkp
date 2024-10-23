import admin from "firebase-admin";
import cache from "./cache.js";
import { config } from "dotenv";

config();

const db = admin.firestore();

export function setupRealtimeUpdates() {
  const usersRef = db.collection("guilds");

  usersRef.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (
        change.type === "added" ||
        change.type === "modified" ||
        change.type === "removed"
      ) {
        const docId = change.doc.id;

        if (process.env.ENV === "development") {
          console.log(`${change.type} ${docId}`);
        }

        // List of cache keys to invalidate
        const cacheKeys = [
          `guild-${docId}`,
          `guilds-all`,
          `guilds-${docData.guildData?.ownerId}`,
          `dkp-${docId}`,
        ];

        // Invalidate all relevant cache keys
        cacheKeys.forEach((key) => cache.del(key));
      }
    });
  });
}
