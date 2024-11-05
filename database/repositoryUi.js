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
    screenshots: [],
    interfaceFile: null,
    stars: 0,
    downloads: 0
  };

  const res = await db.collection("huds").doc().set(defaultConfig);
  new Logger().log(PREFIX, `Ui added ${uiData.title}`);
  return res;
}


export async function getAllHUDS() {
  const cacheKey = `huds-all`;
  let hudsData = cache.get(cacheKey);

  if (!hudsData) {
    const snapshot = await db.collection("huds").get();

    if (snapshot.empty) {
      new Logger().log(PREFIX, `No huds found`);
      return [];
    }

    const huds = [];
    snapshot.forEach((doc) => {
      huds.push({ id: doc.id, ...doc.data() });
    });

    hudsData = huds;
    cache.set(cacheKey, hudsData);
  }

  return hudsData;
}