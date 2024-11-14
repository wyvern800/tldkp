import { db } from "./firebase.js"; // Import Firestore
import admin from "firebase-admin";
import { Logger } from "../utils/logger.js";
import { config } from "dotenv";
import cache from "../utils/cache.js";

const PREFIX = "Firebase";

config();

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
  };

  const res = await db.collection("huds").doc().set(defaultConfig);
  new Logger().log(PREFIX, `Ui added ${uiData.title}`);
  return res;
}

export async function getAllHUDS(limit = 10, startAfter = null) {
  let query = db.collection("huds").orderBy("createdAt", "asc").limit(limit);

  if (startAfter) {
    query = query.startAfter(startAfter);
  }

  const snapshot = await query.get();

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
