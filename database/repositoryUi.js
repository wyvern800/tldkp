import { db } from "./firebase.js"; // Import Firestore
import admin from "firebase-admin";
import { Logger } from "../utils/logger.js";
import { config } from "dotenv";
import cache from "../utils/cache.js";

const PREFIX = "Firebase";

config();

/**
 * Create a new HUD
 * @param { any } uiData Data of the HUD
 */
export async function createHUD(uiData) {
  const defaultConfig = {
    userId: uiData?.userId,
    title: uiData?.title,
    description: uiData?.description,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    screenshots: uiData?.screenshots,
    interfaceFile: uiData?.interfaceFile,
    stars: 0,
    downloads: 0,
    allowed: false
  };

  const res = await db.collection("huds").doc().set(defaultConfig);
  new Logger().log(PREFIX, `HUD successfully uploaded: ${uiData.title}`);
  return res;
}

/**
 * Gets all huds
 * @param { number } limit Limit
 * @param {*} startAfter Start cursor
 * @returns 
 */
export async function getAllHUDS(limit = 10, startAfter = null) {
  let query = db.collection("huds").orderBy("createdAt", "asc").limit(limit);

  if (startAfter) {
    query = query.startAfter(startAfter);
  }

  const snapshot = await query.where("allowed", "==", true).get();

  if (snapshot.empty) {
    new Logger().log(PREFIX, `No huds found`);
    return [];
  }

  const huds = [];
  snapshot.forEach((doc) => {
    huds.push({ id: doc.id, ...doc.data() });
  });

  return huds;
}
