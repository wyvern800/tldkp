import { db } from "./firebase.js"; // Import Firestore
import admin from "firebase-admin";
import { Logger } from "../utils/logger.js";
import {
  updateDkp,
  decreaseDkp,
  setDkp,
  isPositiveNumber,
  convertDateStringToDateObject,
  convertDateObjectToDateString,
} from "../utils/index.js";
import { LANGUAGE_EN, LANGUAGE_PT_BR } from "../utils/constants.js";
import { config } from "dotenv";
import { isAfter, add, formatDistance, isBefore, isEqual } from "date-fns";
import { canManageThreads, getPermissionUpdateInstructions } from "../utils/permissionChecker.js";
import {
  generateClaimCode,
  createOrModifyAuctionEmbed,
  convertFirestoreTimestamp,
} from "../utils/index.js";
import {
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { items } from "../database/allItems.js";
import { client } from "../src/index.js";
import { searchItem } from "../database/itemsGrabber.js";

const PREFIX = "Firebase";

config();

let auctionLocks = new Map();
export const auctionsMap = new Map();
export const threadListeners = new Map();
const functionExecutionCount = {};

function trackFunctionExecution(functionName, calledBy) {
  if (!functionExecutionCount[functionName]) {
    functionExecutionCount[functionName] = 0;
  }
  functionExecutionCount[functionName]++;
  new Logger().log('repository.js', `Function ${functionName} executed ${functionExecutionCount[functionName]} times ${calledBy ? `(Called last time by ${calledBy})` : ''}`);
}

/**
 * Gets the guild config
 *
 * @param { string } guildId The guild id
 * @param { string } calledBy Which function is calling this
 * @returns { any } Data
 */
export async function getGuildConfig(guildId, calledBy) {
  trackFunctionExecution('getGuildConfig', calledBy);

  const guildSnapshot = await db.collection("guilds").doc(guildId).get();

  if (!guildSnapshot.exists) {
    new Logger().log(PREFIX, `No config found for guild ${guildId}`);
    return null;
  }

  return guildSnapshot.data();
}

/**
 * Gets the guild config
 *
 * @param { string } guildId The guild id
 * @returns { any } Data
 */
export async function getAuctionData(auctionId) {
  const cacheKey = `auction-${auctionId}`;
  let auctionData = cache.get(cacheKey);

  if (!auctionData) {
    const auctionSnapshot = await db
      .collection("auctions")
      .doc(auctionId)
      .get();

    if (!auctionSnapshot.exists) {
      new Logger().log(PREFIX, `No auction found with id ${auctionId}`);
      return null;
    }

    auctionData = auctionSnapshot.data();
    cache.set(cacheKey, auctionData);
  }

  return auctionData;
}

export async function getAuctionDataByThreadId(threadId) {
  const auctionSnapshot = db.collection("auctions");

  const auctionQuery = auctionSnapshot.where("data.threadId", "==", threadId);

  const querySnapshot = await auctionQuery.get();

  if (querySnapshot.empty) {
    new Logger().log(PREFIX, `No auction found with threadId ${threadId}`);
    return null;
  }

  let auctionData = null;
  querySnapshot.forEach((doc) => {
    auctionData = doc.data();
  });

  return auctionData;
}

/**
 * Processes the bid
 *
 * @param {any} interaction  The interaction
 * @param {any} auction The auction
 * @returns Processes the bid
 */
export async function processBid(interaction, auction) {
  if (!interaction.isCommand()) {
    return;
  }

  const { commandName } = interaction;

  if (commandName === "bid") {
    // Check if guild has premium access for auctions
    const hasPremiumAccess = await checkAuctionPremiumAccess(interaction.guild.id);
    if (!hasPremiumAccess) {
      const subscription = await getGuildSubscription(interaction.guild.id);
      const embed = {
        title: "🔒 Premium Feature Required",
        description: "The auction system is only available to premium servers. Upgrade your server to access this feature and many more!",
        color: 0xff6b6b,
        fields: [
          {
            name: "Current Status",
            value: subscription.isPremium ? 
              (subscription.expiresAt ? `Premium (expires ${subscription.expiresAt.toLocaleDateString()})` : 'Premium (expired)') : 
              'Free',
            inline: true
          },
          {
            name: "Available Plans",
            value: "• **Premium Monthly** - Full access to all features\n• **Lifetime** - One-time payment, permanent access",
            inline: false
          }
        ],
        footer: {
          text: "Contact an administrator to upgrade your server's subscription"
        }
      };

      return await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }

    const threadId = interaction.channel.id;

    if (threadId !== auction?.data?.threadId) {
      return await interaction.reply({
        content:
          "**This command only works on an auction thread**\n\nFor example: Click on '**View topic**' on threads with the prefix **Auction**: <item name>'s bids\n\nThere you should be able to bid if the auction is running!",
        ephemeral: true,
      });
    }

    const bidAmount = interaction.options.getNumber("dkp");

    if (isNaN(bidAmount)) {
      if (!interaction.replied) {
        return await interaction.reply({
          content: "Please provide a valid bid amount.",
          ephemeral: true,
        });
      }
      return;
    }

    // Acquire the lock for the specific auction
    while (auctionLocks.get(threadId)) {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for 100ms before checking again
    }
    auctionLocks.set(threadId, true);

    try {
      const allDkps = await getGuildConfig(interaction.guild.id);
      const updatedAuction = await getAuctionDataByThreadId(threadId);
      const userDkp = allDkps?.memberDkps.find(
        (memberDkp) => memberDkp.userId === interaction.user.id
      );
      const bids = updatedAuction?.bids ?? [];

      // Calculate the total DKP the user has bid across all auctions
      const allAuctions = await db.collection("auctions").get();
      let totalBidDkp = 0;

      allAuctions.forEach((doc) => {
        const auctionData = doc.data();
        const userBid = auctionData.bids?.find(
          (bid) => bid.userId === interaction.user.id
        );
        if (userBid) {
          totalBidDkp += userBid.bid;
        }
      });

      // Calculate the remaining DKP the user can use for bidding
      const remainingDkp = userDkp?.dkp - totalBidDkp;

      // Check if the user has enough remaining DKP to place the bid
      if (remainingDkp < bidAmount) {
        if (!interaction.replied) {
          await interaction.reply({
            content: `You don't have enough remaining DKP to bid ${bidAmount}! Your remaining DKP (open to bid) is ${remainingDkp}.`,
            ephemeral: true,
          });
        }
        return;
      }

      // Check if the auction has ended
      const auctionEndTime =
        updatedAuction?.auctionMaxTime instanceof admin.firestore.Timestamp
          ? updatedAuction.auctionMaxTime.toDate()
          : updatedAuction?.auctionMaxTime;
      if (auctionEndTime && isAfter(new Date(), auctionEndTime)) {
        if (!interaction.replied) {
          await interaction.reply({
            content: `The auction has ended.`,
            ephemeral: true,
          });
        }
        return;
      }

      // Check if the user has DKP
      if (userDkp?.dkp < bidAmount) {
        if (!interaction.replied) {
          await interaction.reply({
            content: `You don't have enough DKP to bid ${bidAmount}!`,
            ephemeral: true,
          });
        }
        return;
      }

      const highestBid = Math.max(...(bids?.map((bid) => bid.bid) || []), 0);

      // Check if the bid is higher than the starting price
      if (bidAmount < updatedAuction?.startingPrice) {
        if (!interaction.replied) {
          await interaction.reply({
            content: `Your bid must be at least ${updatedAuction?.startingPrice} DKP.`,
            ephemeral: true,
          });
        }
        return;
      }

      // Check if the bid is higher than the highest bid
      if (bidAmount <= highestBid) {
        if (!interaction.replied) {
          await interaction.reply({
            content: `Your bid must be higher than the current highest bid of ${highestBid} DKP.`,
            ephemeral: true,
          });
        }
        return;
      }

      // Check if the bid is higher than the gap between bids
      bids.sort((a, b) => {
        const aParsed = a instanceof admin.firestore.Timestamp ? a.toDate() : a;
        const bParsed = b instanceof admin.firestore.Timestamp ? b.toDate() : b;
        return aParsed.createdAt - bParsed.createdAt;
      });
      const lastBid = bids.length > 0 ? bids[bids.length - 1].bid : 0;
      if (bidAmount < lastBid + updatedAuction.gapBetweenBids) {
        if (!interaction.replied) {
          await interaction.reply({
            content: `Your bid must be at least ${updatedAuction.gapBetweenBids} DKP higher than the last bid of ${lastBid} DKP.`,
            ephemeral: true,
          });
        }
        return;
      }

      const copyBids = [
        ...bids,
        { userId: interaction.user.id, bid: bidAmount, createdAt: new Date() },
      ];

      const auctionDTO = {
        ...auction,
        bids: copyBids,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      try {
        await updateAuctionConfig(auction.data.messageId, auctionDTO);

        // Process the bid
        if (!interaction.replied) {
          await interaction.reply({
            content: `<@${interaction.user.id}> ${
              userDkp?.ign ? `(${userDkp?.ign})` : ""
            } has just bidded ${bidAmount}!`,
          });
        }

        // Update the auction embed
        try {
          const updatedStartTime =
            updatedAuction?.startingAt instanceof admin.firestore.Timestamp
              ? updatedAuction.startingAt.toDate()
              : updatedAuction?.startingAt;

          const auctionEndTime =
            updatedAuction?.auctionMaxTime instanceof admin.firestore.Timestamp
              ? updatedAuction.auctionMaxTime.toDate()
              : updatedAuction?.auctionMaxTime;

          const formattedStartingNew =
            convertDateObjectToDateString(updatedStartTime);
          const formattedMaxTime =
            convertDateObjectToDateString(auctionEndTime);

          // Calculate dynamic status instead of using stored status
          const now = new Date();
          const bidAuctionEndTime = updatedAuction?.auctionMaxTime instanceof admin.firestore.Timestamp
            ? updatedAuction.auctionMaxTime.toDate()
            : updatedAuction?.auctionMaxTime;
          const bidAuctionStartTime = updatedAuction?.startingAt instanceof admin.firestore.Timestamp
            ? updatedAuction.startingAt.toDate()
            : updatedAuction?.startingAt;

          let dynamicStatus;
          if (updatedAuction?.finalized) {
            dynamicStatus = "finalized";
          } else if (updatedAuction?.cancelled) {
            dynamicStatus = "cancelled";
          } else if (bidAuctionStartTime && isBefore(now, bidAuctionStartTime)) {
            dynamicStatus = "scheduled";
          } else if (bidAuctionEndTime && isAfter(now, bidAuctionEndTime)) {
            dynamicStatus = "finalized";
          } else if (bidAuctionStartTime && isAfter(now, bidAuctionStartTime)) {
            dynamicStatus = "started";
          } else {
            dynamicStatus = "cancelled";
          }

          const { prefix, status, modal } = statusParser(dynamicStatus);

          new Logger().logLocal(
            PREFIX,
            `Bid processing for ${updatedAuction.itemName}: storedStatus=${updatedAuction.auctionStatus}, dynamicStatus=${dynamicStatus}, finalized=${updatedAuction.finalized}, cancelled=${updatedAuction.cancelled}`
          );

          console.log(interaction?.member);

          let embed, components;
          ({ embed, components } = createOrModifyAuctionEmbed({
            itemName: updatedAuction.itemName,
            startingPrice: `${updatedAuction.startingPrice}`,
            itemNote: `${updatedAuction.itemNote}`,
            gapBetweenBids: `${updatedAuction.gapBetweenBids}`,
            startingAt: `${formattedStartingNew}`,
            auctionMaxTime: `${formattedMaxTime}`,
            auctionPrefix: prefix,
            auctionStatus: status,
            modalColor: modal,
            highestBidder: {
              bid: bidAmount,
              name: `${
                interaction?.member?.nickname &&
                interaction?.member?.nickname !== ""
                  ? interaction.member.nickname
                  : interaction.user.globalName
              }!`,
            },
          }));

          let channel = await client.channels.fetch(
            updatedAuction.data.channelId
          );
          let message = await channel.messages.fetch(
            updatedAuction.data.messageId
          );

          if (!updatedAuction?.finalized && !updatedAuction?.cancelled) {
            await message.edit({
              embeds: [embed],
              components: components ? components : [],
            });
          }
        } catch (error) {
          console.error("Error in createOrModifyAuctionEmbed:", error);
          await i.reply({
            content: "An error occurred while modifying the auction embed.",
            ephemeral: true,
          });
          return;
        }
      } catch (err) {
        console.log(err);
        new Logger().logLocal(PREFIX, `Error updating auction`, err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: `Failed to process bid of ${bidAmount} DKP.`,
            ephemeral: true,
          });
        }
      }
    } finally {
      auctionLocks.set(threadId, false);
    }
  }
}

/**
 *
 * @param {any} discordBot The discord bot
 * @returns {Promise<void>}
 */
export async function loadAllAuctions(discordBot) {
  const auctionsSnapshot = await db.collection("auctions").get();

  if (auctionsSnapshot.empty) {
    new Logger().log(PREFIX, `No auctions found`);
    return;
  }

  const auctions = [];
  auctionsSnapshot.forEach((doc) => {
    auctions.push({ id: doc.id, ...doc.data() });
  });

  try {
    for (const auction of auctions) {
      try {
        let channel = await discordBot.channels.fetch(auction.data.channelId);
        let message = await channel.messages.fetch(auction.data.messageId);

        if (channel && message) {
          updateAuction({ _message: message, auction });

          // Auction thread
          if (auction.data?.threadId) {
            const thread = await discordBot.channels.fetch(
              auction.data?.threadId
            );
            auctionsMap.set(auction.data?.threadId, auction);

            const listener = async (interaction) => {
              const { commandName } = interaction;

              // Avoid this command to be used in threads
              if (commandName === "bid" && interaction?.channel?.type === 0) {
                try {
                  await interaction.reply({
                    content:
                      "**This command only works on an auction thread**\n\nFor example: Click on '**View topic**' on threads with the prefix **Auction**: <item name>'s bids\n\nThere you should be able to bid if the auction is running!",
                    ephemeral: true,
                  });
                } catch (e) {
                  new Logger().logLocal(
                    PREFIX,
                    `Error replying to interaction: bid`,
                    e
                  );
                }
                return;
              }

              const auction = auctionsMap.get(interaction.channel.id);
              if (auction) {
                await processBid(interaction, auction);
              }
            };

            // set the listener for the thread only if there is an started auction
            if (auction?.auctionStatus === "started") {
              threadListeners.set(thread.id, listener);
              thread.client.on("interactionCreate", listener);
            } else {
              const listener = threadListeners.get(thread.id);
              if (listener) {
                  discordBot.removeListener('interactionCreate', listener);
                  threadListeners.delete(thread.id);
                  new Logger().logLocal(PREFIX, `Listener removed for thread ${thread.name}`);
              }
              await thread.setLocked(true);
              new Logger().logLocal(
                "Auctions",
                `This auction for ${auction?.itemName} is not running, so no listener is needed`
              );
            }
          }
        }
      } catch (e) {
        /*new Logger().logLocal(
          PREFIX,
          `Error loading auction ${auction.id} (deleted?)`,
          e
        );*/
      }
    }
  } catch (err) {
    new Logger().logLocal(PREFIX, `Error loading auctions`, e);
  }
  return auctionsMap?.size ?? "no";
}

/**
 * Gets the guild config
 *
 * @param { string } guildId The guild id
 * @returns { any } Data
 */
export async function getAllGuilds() {
  trackFunctionExecution('getAllGuilds');
  const snapshot = await db.collection("guilds").get();

  if (snapshot.empty) {
    new Logger().log(PREFIX, `No guilds found`);
    return [];
  }

  const guilds = [];
  snapshot.forEach((doc) => {
    guilds.push({ id: doc.id, ...doc.data() });
  });

  return guilds;
}

export async function getGuildsByOwnerOrUser(userOrOwnerId, discordBot) {
  trackFunctionExecution('getGuildsByOwnerOrUser');
  try {
    const guildsRef = db.collection("guilds");
    const allGuildsSnapshot = await guildsRef.get();

    const ownerGuilds = [];
    const memberGuilds = [];

    allGuildsSnapshot.forEach((doc) => {
      const data = doc.data();
      const members = data?.memberDkps || [];

      if (data.guildData.ownerId === userOrOwnerId) {
        ownerGuilds.push({ ...data });
      }

      const filteredMembers = members.filter(
        (member) => member?.userId === userOrOwnerId
      );

      if (filteredMembers.length > 0) {
        memberGuilds.push({
          ...data,
          memberDkps: members,
        });
      }
    });

    const parseMembers = async (_guilds) => {
      return Promise.all(
        _guilds.map(async (guild) => {
          const { id, ownerId } = guild?.guildData;
          const guildData = discordBot?.guilds?.cache.get(id);
          let owner = {};
          let avatarURL = "";

          try {
            owner = await guildData?.members?.fetch(ownerId);
            avatarURL = owner?.user.displayAvatarURL({
              dynamic: true,
              size: 32,
            });
          } catch (error) {
            new Logger().logLocal(PREFIX, `Owner not found for guild ${id}`);
          }

           const memberDkps = await Promise.all(
             guild?.memberDkps.map(async (memberDkp) => {
               let memberData = {};
               let avatarURL = "";

               try {
                 memberData = await guildData?.members?.fetch(memberDkp.userId);
                 avatarURL = memberData?.user?.displayAvatarURL({
                   dynamic: true,
                   size: 32,
                 });
               } catch (error) {
                 new Logger().logLocal(PREFIX, `Member not found for guild ${id} - user likely left the server`);
                 return null; // Return null for members who can't be fetched
               }

               return {
                 ...memberDkp,
                 discordData: {
                   displayName: memberData?.user?.globalName ?? "User not available (Banned or left the server)",
                   preferredColor: memberData?.user?.accentColor ?? "",
                   avatarURL,
                 },
               };
             })
           );

           // Filter out null values (members who left the server)
           const validMemberDkps = memberDkps.filter(member => member !== null);
           
           // Log how many members were filtered out
           const filteredCount = memberDkps.length - validMemberDkps.length;
           if (filteredCount > 0) {
             new Logger().logLocal(
               PREFIX,
               `Filtered out ${filteredCount} members who left the server in guild ${id}`
             );
             
             // Optional: Clean up the database by removing ghost members
             // Uncomment the following lines if you want to automatically clean up the database
             /*
             try {
               await db.collection("guilds").doc(id).update({
                 memberDkps: validMemberDkps
               });
               new Logger().logLocal(
                 PREFIX,
                 `Cleaned up ${filteredCount} ghost members from database for guild ${id}`
               );
             } catch (cleanupError) {
               new Logger().logLocal(
                 PREFIX,
                 `Failed to clean up ghost members for guild ${id}: ${cleanupError.message}`
               );
             }
             */
           }

           return {
             ...guild,
             guildData: {
               ...guild?.guildData,
               ownerDiscordData: {
                 displayName: owner?.user?.globalName ?? "Unknown",
                 preferredColor: owner?.user?.accentColor ?? "",
                 avatarURL,
               },
             },
             memberDkps: validMemberDkps,
           };
        })
      );
    };

    const [owner, member] = await Promise.all([
      parseMembers(ownerGuilds),
      parseMembers(memberGuilds),
    ]);

    const result = {
      ownerGuilds: owner,
      memberGuilds: member,
    };

    return result;
  } catch (error) {
    console.log(error);
    new Logger().log(PREFIX, `Some error happened`);
  }
}

/**
 * Gets data
 *
 * @param { string } guildId The guild id
 * @param { any } collection The collection
 * @returns { any[] } The data
 */
export async function getData(guildId, collection) {
  trackFunctionExecution('getGuildsByOwnerOrUser');
  const doc = await db.collection(collection).doc(guildId).get();

  if (!doc.exists) {
    new Logger().log(PREFIX, `No config found for guild ${guildId}`);
    return null;
  }

  const data = doc.data();

  return data;
}

async function getDkpByUserId(interaction, guildId, userId) {
  trackFunctionExecution('getDkpByUserId');
  const doc = await db.collection("guilds").doc(guildId).get();

  // If the document doesn't exist, log an error and return null
  if (!doc.exists) {
    new Logger(interaction).log(PREFIX, `Guild not found`);
    return "guild-not-found";
  }

  const guildData = doc.data();

  // Check if the memberDkps array exists
  const memberDkps = guildData.memberDkps || [];

  // Find the user with the specified userId in the memberDkps array
  const userDkpData = memberDkps.find(
    (memberDkp) => memberDkp.userId === userId
  );

  // If user not found, log an error and return null
  if (!userDkpData) {
    new Logger(interaction).log(PREFIX, `No DKP found for user ${userId}`);
    return "dkp-not-found";
  }

  // Return the DKP of the user
  return userDkpData;
}

/**
 * Create the guild config
 *
 * @param { string } guildId The guild id
 * @returns { any } Response
 */
export async function guildCreate(guild) {
  trackFunctionExecution('guildCreate');
  const defaultConfig = {
    guildData: {
      id: guild.id,
      icon: guild.iconURL(),
      name: guild.name,
      ownerId: guild.ownerId,
      alias: null,
      lastUpdatedGuild: null,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    language: LANGUAGE_EN,
    memberDkps: [],
    togglables: {
      dkpSystem: {
        dmNotifications: true,
      },
    },
    subscription: {
      isPremium: false,
      expiresAt: null,
      planType: 'free',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  };

  const res = await db.collection("guilds").doc(guild.id).set(defaultConfig);
  new Logger().log(PREFIX, `Config created for guild ${guild.id}`);
  return res;
}

/**
 * Create the auction
 *
 * @param { string } guildId The guild id
 * @returns { any } Response
 */
async function auctionCreate(auctionData) {
  const res = await db.collection("auctions").add(auctionData);
  if (res) {
    return auctionData;
  } else {
    return false;
  }
}

export async function updateAuctionConfig(messageId, auction) {
  const querySnapshot = await db
    .collection("auctions")
    .where("data.messageId", "==", messageId)
    .get();

  querySnapshot.forEach((doc) => {
    const existingData = doc.data();
    const updatedData = {};

    // Compare existing data with new data and update only changed fields
    for (const key in auction) {
      if (auction[key] !== existingData[key]) {
        updatedData[key] = auction[key];
      }
    }

    if (Object.keys(updatedData).length > 0) {
      doc.ref.update(updatedData);
    }
  });

  return querySnapshot;
}

/**
 * Handles dkp management
 *
 * @param { any } interaction The interaction
 * @param { SET | ADD | SUBTRACT } type Type
 * @returns
 */
export async function handleUpdateDkp(interaction) {
  trackFunctionExecution('handleUpdateDkp');
  const choices = interaction.options.getString("operation");
  const user = interaction.options.getUser("user");
  const amount = interaction.options.getInteger("amount");

  const guildDataResponse = await getGuildConfig(interaction.guild.id, 'handleUpdateDkp');
  const { memberDkps } = guildDataResponse;

  const { id } = interaction.user;

  let newGuildData = guildDataResponse;

  if (!user && !choices && !amount && !id) {
    const msg = `Something unexpected happened`;
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }

  switch (choices?.toLowerCase()) {
    case "set":
      // Initialize newDkp as a copy of the existing memberDkps array or an empty array if it doesn't exist
      let newDkp = memberDkps ? [...memberDkps] : [];

      // Validate the amount for positive number
      if (!isPositiveNumber(amount)) {
        const errorMsg = "The DKP amount must be a positive number.";
        return await interaction.reply({ content: errorMsg, ephemeral: true });
      }

      setDkp(
        newDkp,
        user.id,
        amount,
        user,
        guildDataResponse?.guildData?.name,
        guildDataResponse
      );

      // Update the guild data with the new memberDkps array and the current timestamp
      newGuildData = {
        ...guildDataResponse,
        memberDkps: newDkp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      break;

    case "add":
    case "remove":
      // Initialize increasedDkp as a copy of the existing memberDkps array or an empty array if it doesn't exist
      let increasedDkp = memberDkps ? [...memberDkps] : [];

      // Validate the amount for positive number
      if (!isPositiveNumber(amount)) {
        const errorMsg = "The DKP amount must be a positive number.";
        return await interaction.reply({ content: errorMsg, ephemeral: true });
      }

      if (choices === "add") {
        updateDkp(
          increasedDkp,
          user.id,
          amount,
          user,
          guildDataResponse?.guildData?.name,
          guildDataResponse
        );
      } else {
        decreaseDkp(
          increasedDkp,
          user.id,
          amount,
          user,
          guildDataResponse?.guildData?.name,
          guildDataResponse
        );
      }

      // Update the guild data with the new memberDkps array and the current timestamp
      newGuildData = {
        ...guildDataResponse,
        memberDkps: increasedDkp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      break;

    default:
      const msg = `Operation not recognized.`;
      new Logger(interaction).log(PREFIX, msg);
      return await interaction.reply({ content: msg, ephemeral: true });
  }

  await db.collection("guilds").doc(interaction.guild.id).update(newGuildData);

  const answer = {
    add: "increased to",
    remove: "subtracted to",
    set: "set to",
  };

  const value = newGuildData?.memberDkps?.find(
    (member) => member.userId === user.id
  );
  const msg = `<@${user.id}>'s DKP was ${
    answer[choices?.toLowerCase() ?? "updated to"]
  } ${value?.dkp}!`;
  new Logger(interaction).log(PREFIX, msg);
  return await interaction.reply({ content: msg, ephemeral: true });
}

export const updateNickname = async (interaction) => {
  trackFunctionExecution('updateNickname');
  const user = interaction.user;
  const nickname = interaction.options.getString("nickname");

  try {
    const guildData = await getGuildConfig(interaction.guild.id, 'updateNickname');
    let copyGuildData = { ...guildData };
    const { memberDkps } = guildData;

    let memberIndex = memberDkps.findIndex(
      (member) => member.userId === user.id
    );

    if (memberIndex !== -1) {
      const { updatedAt } = memberDkps[memberIndex]; // Assuming this is a Firestore Timestamp
      const notSetYet = !updatedAt; // Check if updatedAt is set

      // Ensure updatedAt is a valid Timestamp
      const updatedAtDate =
        updatedAt instanceof admin.firestore.Timestamp
          ? updatedAt.toDate() // Convert Timestamp to Date
          : new Date();

      // Check if the date is valid
      if (isNaN(updatedAtDate.getTime())) {
        throw new Error("Invalid updatedAt date.");
      }

      const future = add(updatedAtDate, { hours: 1 });

      // You can only change the nickname if it is not set yet or if 1 hour have passed since updatedAt
      if (notSetYet || isAfter(new Date(), future)) {
        // Update the nickname
        copyGuildData.memberDkps[memberIndex].ign = nickname;
        copyGuildData.memberDkps[memberIndex].updatedAt = new Date();

        try {
          const nickname = interaction.options.getString("nickname");

          try {
            await db
              .collection("guilds")
              .doc(interaction.guild.id)
              .update(copyGuildData);
            const msg = `Your in-game nickname was changed to: ${nickname}!`;
            new Logger(interaction).log(PREFIX, msg);
            interaction.reply({ content: msg, ephemeral: true });
          } catch (err) {
            console.log(err);
            const msg = `Failed to update your in-game nickname.`;
            new Logger(interaction).error(PREFIX, msg, err);
            interaction.reply({ content: msg, ephemeral: true });
          }
        } catch (err) {
          const msg = "Error setting in-game nickname";
          new Logger(interaction).log(PREFIX, msg);
          return await interaction.reply({
            content: msg,
            ephemeral: true,
          });
        }
      } else {
        // Send a message if nickname change is not allowed
        const allowedDateFormatted = formatDistance(future, new Date(), {
          addSuffix: true,
        });
        const msg = `You can only change your nickname once in 1 hour, you will be able ${allowedDateFormatted}.`;
        new Logger(interaction).log(PREFIX, msg);
        return await interaction.reply({
          content: msg,
          ephemeral: true,
        });
      }
    } else {
      // Send a message if the user is not found in the memberDkps array
      const msg =
        "You don't have DKP yet, you must have before setting a nickname.";
      new Logger(interaction).log(PREFIX, msg);
    }
  } catch (error) {
    console.log(error);
    const msg = "Error updating in-game nickname";
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({
      content: msg,
      ephemeral: true,
    });
  }
};

/**
 * Handles the language change
 *
 * @param { any } interaction The interaction
 * @returns { any } Response
 */
export async function changeLanguage(interaction) {
  trackFunctionExecution('changeLanguage');
  const language = interaction.options.getString("language");

  const guildDataResponse = await getGuildConfig(interaction.guild.id, 'changeLanguage');

  const newGuildData = { ...guildDataResponse, language };

  const langs = {
    [LANGUAGE_EN]: "English (en-US)",
    [LANGUAGE_PT_BR]: "Brazilian Portuguese (pt-BR)",
  };
  const newLang = langs[language] ?? LANGUAGE_EN;

  try {
    await db
      .collection("guilds")
      .doc(interaction.guild.id)
      .update(newGuildData);
    const msg = `The bot responses language was set to: ${newLang}!`;
    new Logger(interaction).log(PREFIX, msg);
    interaction.reply({ content: msg, ephemeral: true });
  } catch (err) {
    const msg = `Failed to update the language.`;
    new Logger(interaction).error(PREFIX, msg, err);
    interaction.reply({ content: msg, ephemeral: true });
  }
}

/**
 * Comando de limpar
 *
 * @param { any } interaction Interação
 * @returns { void }
 */
export const handleClear = async (interaction) => {
  trackFunctionExecution('handleClear');
  const { options } = interaction;

  const amount = options.getInteger("amount") || 100;
  if (amount < 1 || amount > 100) {
    interaction.reply({
      content: "You have to type a number between 1 and 100.",
      ephemeral: true,
    });
    return;
  }

  try {
    const fetched = await interaction?.channel?.messages?.fetch({
      limit: amount,
    });

    if (fetched?.size > 0) {
      await interaction.channel.bulkDelete(fetched);
      const deleteMsg = `Deleting ${fetched.size} messages...`;
      interaction
        .reply({
          content: deleteMsg,
          ephemeral: true,
        })
        .then((msg) => {
          setTimeout(() => msg.delete(), 5000);
        });
      new Logger(interaction).log(PREFIX, deleteMsg);
    } else {
      new Logger(interaction).log(
        PREFIX,
        `There are no messages to be deleted.`
      );
      interaction.reply({
        content: `There are no messages to be deleted.`,
        ephemeral: true,
      });
    }
  } catch (error) {
    new Logger(interaction).log(
      PREFIX,
      `Error cleaning messages: ${error?.message}`
    );
    interaction.reply({
      content: "There was an error when deleting.",
      ephemeral: true,
    });
  }
};

/**
 * Check DKP
 *
 * @param { any } interaction Interação
 * @returns { void }
 */
export const handleCheck = async (interaction) => {
  trackFunctionExecution('handleCheck');
  const user = interaction.user;

  try {
    const response = await getDkpByUserId(
      interaction,
      interaction.guild.id,
      user.id
    );
    if (response === "dkp-not-found") {
      return await interaction.reply({
        content: `You don't have DKP yet.`,
        ephemeral: true,
      });
    } else if (response === "guild-not-found") {
      return await interaction.reply({
        content: `Guild not found.`,
        ephemeral: true,
      });
    } else {
      const { ign, dkp } = response;

      return await interaction.reply({
        content: `Your current DKP is **${dkp}**!\n${
          ign ? `In-game Nickname: **${ign}**` : ""
        }`,
        ephemeral: true,
      });
    }
  } catch (error) {
    const msg = "Error checking DKP";
    new Logger(interaction).error(PREFIX, msg);
    return await interaction.reply({
      content: msg,
      ephemeral: true,
    });
  }
};

/**
 * Check other player's DKP
 *
 * @param { any } interaction Interação
 * @returns { void }
 */
export const checkOther = async (interaction) => {
  trackFunctionExecution('checkOther');
  const { options } = interaction;
  const user = options.getUser("user");
  try {
    const response = await getDkpByUserId(
      interaction,
      interaction.guild.id,
      user.id
    );
    if (response === "dkp-not-found") {
      return await interaction.reply({
        content: `${user.globalName} doesn't have DKP yet.`,
        ephemeral: true,
      });
    } else if (response === "guild-not-found") {
      return await interaction.reply({
        content: `Guild not found.`,
        ephemeral: true,
      });
    } else {
      const { ign, dkp } = response;

      return await interaction.reply({
        content: `${user.globalName}'s current DKP is **${dkp}**!
        ${ign ? `IGN: **${ign}**` : ""}`,
        ephemeral: true,
      });
    }
  } catch (error) {
    const msg = "Error checking DKP";
    new Logger(interaction).error(PREFIX, msg);
    return await interaction.reply({
      content: msg,
      ephemeral: true,
    });
  }
};

/**
 * Sets the in-game nickname (alias) for a guild.
 *
 * This function retrieves the alias from the interaction options and updates the corresponding guild document in Firestore.
 * If the guild document does not exist, it throws an error.
 * If an error occurs during the update process, it logs the error and sends an ephemeral reply to the user.
 *
 * @param {any} interaction - The interaction object from Discord.
 * @param {any} interaction.options - The options object from the interaction.
 * @param {Function} interaction.options.getString - Function to get a string option from the interaction.
 * @param {string} interaction.options.getString.alias - The alias to set for the guild.
 * @param {any} interaction.guild - The guild object from Discord.
 * @param {string} interaction.guild.id - The ID of the guild.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
export const setGuildNickname = async (interaction) => {
  trackFunctionExecution('setGuildNickname');
  const nickname = interaction.options.getString("alias");

  try {
    const guildId = interaction.guild.id;

    // Direct query to Firestore for the specific guild document
    const guildRef = admin.firestore().collection("guilds").doc(guildId);

    // Fetch the document snapshot
    const guildSnapshot = await guildRef.get();

    // Ensure the document exists
    if (!guildSnapshot.exists) {
      throw new Error("Guild document not found");
    }

    // Get the data from the document snapshot
    const guildData = guildSnapshot.data();

    // Destructure the lastUpdatedGuildAlias field
    const { lastUpdatedGuildAlias } = guildData?.guildData;
    const notSetYet = !lastUpdatedGuildAlias;

    // Handle date parsing
    const updatedAtDate = lastUpdatedGuildAlias?.toDate
      ? lastUpdatedGuildAlias.toDate()
      : new Date();
    if (isNaN(updatedAtDate.getTime())) {
      new Logger(interaction).log(PREFIX, "Invalid lastUpdatedGuildAlias date");
      return;
    }

    const future = add(updatedAtDate, { days: 10 });

    // Check if 10 days have passed or if lastUpdatedGuildAlias was never set
    if (notSetYet || isAfter(new Date(), future)) {
      // Perform the update in Firestore
      const guildRef = admin.firestore().collection("guilds").doc(guildId);
      await guildRef.update({
        "guildData.alias": nickname,
        "guildData.lastUpdatedGuildAlias":
          admin.firestore.FieldValue.serverTimestamp(),
      });

      const msg = "Guild alias updated successfully!";
      return await interaction.reply({ content: msg, ephemeral: true });
    } else {
      // Calculate the time left until the next allowed update
      const allowedDateFormatted = formatDistance(future, new Date(), {
        addSuffix: true,
      });
      const msg = `You can only change your guild alias once every 10 days, you will be able to change it ${allowedDateFormatted}.`;

      new Logger(interaction).log(PREFIX, msg);
      return await interaction.reply({ content: msg, ephemeral: true });
    }
  } catch (error) {
    console.log(error);
    const msg = "Error updating guild's name (alias)";
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }
};

/**
 * Sets up the auto decay system for a guild.
 *
 * This function retrieves the decay percentage and interval from the interaction options and updates the corresponding guild document in Firestore.
 * If an error occurs during the update process, it logs the error and sends an ephemeral reply to the user.
 *
 * @param {any} interaction - The interaction object from Discord.
 * @param {any} interaction.options - The options object from the interaction.
 * @param {Function} interaction.options.getNumber - Function to get a number option from the interaction.
 * @param {number} interaction.options.getNumber.percentage - The decay percentage to set for the guild.
 * @param {Function} interaction.options.getInteger - Function to get an integer option from the interaction.
 * @param {number} interaction.options.getInteger.interval - The decay interval to set for the guild.
 * @param {any} interaction.guild - The guild object from Discord.
 * @param {string} interaction.guild.id - The ID of the guild.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
export const setupAutoDecay = async (interaction) => {
  trackFunctionExecution('setupAutoDecay');
  const percentage = interaction.options.getNumber("percentage");
  const interval = interaction.options.getInteger("interval");

  try {
    const guildId = interaction.guild.id;

    // Direct query to Firestore for the specific guild document
    const guildRef = admin.firestore().collection("guilds").doc(guildId);

    // Fetch the document snapshot
    const guildSnapshot = await guildRef.get();

    // Ensure the document exists
    if (!guildSnapshot.exists) {
      new Logger(interaction).log(PREFIX, "Guild document not found");
      return;
    }

    const togglablesPrefix = "togglables.decaySystem";

    await admin
      .firestore()
      .collection("guilds")
      .doc(guildId)
      .update({
        [`${togglablesPrefix}.percentage`]: percentage,
        [`${togglablesPrefix}.interval`]: interval,
        [`${togglablesPrefix}.enabled`]: false,
        [`${togglablesPrefix}.minimumCap`]: 100,
      });

    const msg = `The auto decaying system was set, now you must execute **/decay-toggle** once to enable the scheduler, please have in mind
      that if you don't enable the system, the decay will not be executed, also the default minimum cap is 100, which means a person will only
      lose their DKPs only if their cap is above 100, if it reaches 100, it will stop being removed, you can change that with **/decay-change-minimum-cap** command.
    `;
    return await interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    console.log(error)
    const msg = "Error while setting up the auto-decaying system";
    new Logger(interaction).error(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }
};

/**
 * Toggles DKP notifications for a guild.
 *
 * This function fetches the guild document from Firestore using the guild ID from the interaction.
 * If the guild document exists, it toggles the DKP notifications setting.
 * If the guild document does not exist, it logs an error message.
 *
 * @param {any} interaction - The interaction object from Discord.
 * @param {any} interaction.guild - The guild object from Discord.
 * @param {string} interaction.guild.id - The ID of the guild.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
export const toggleDkpNotifications = async (interaction) => {
  trackFunctionExecution('toggleDkpNotifications');
  try {
    const guildId = interaction.guild.id;

    // Direct query to Firestore for the specific guild document
    const guildRef = admin.firestore().collection("guilds").doc(guildId);

    // Fetch the document snapshot
    const guildSnapshot = await guildRef.get();

    // Ensure the document exists
    if (!guildSnapshot.exists) {
      new Logger(interaction).log(PREFIX, "Guild document not found");
      return await interaction.reply({
        content: "Guild document not found",
        ephemeral: true,
      });
    }

    // Get the data from the document snapshot
    const guildData = guildSnapshot.data();

    const togglablesPrefix = "togglables.dkpSystem";
    const enabled = guildData?.togglables?.dkpSystem?.dmNotifications;
    const newValue = !enabled;

    await admin
      .firestore()
      .collection("guilds")
      .doc(guildId)
      .update({
        [`${togglablesPrefix}.dmNotifications`]: newValue,
      });

    const msg = `Togglable: direct messages updated to: ${newValue}!`;
    return await interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    const msg = "Error updating DKP notifications";
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }
};

/**
 * Toggles the decay system for a guild.
 *
 * This function retrieves the guild document from Firestore using the guild ID from the interaction.
 * If the guild document exists, it toggles the decay system settings.
 * If the guild document does not exist, it logs an error message.
 * If an error occurs during the update process, it logs the error and sends an ephemeral reply to the user.
 *
 * @param {any} interaction - The interaction object from Discord.
 * @param {any} interaction.guild - The guild object from Discord.
 * @param {string} interaction.guild.id - The ID of the guild.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
export const toggleDecay = async (interaction) => {
  trackFunctionExecution('toggleDecay');
  try {
    const guildId = interaction.guild.id;

    // Direct query to Firestore for the specific guild document
    const guildRef = admin.firestore().collection("guilds").doc(guildId);

    // Fetch the document snapshot
    const guildSnapshot = await guildRef.get();

    // Ensure the document exists
    if (!guildSnapshot.exists) {
      new Logger(interaction).log(PREFIX, "Guild document not found");
      return await interaction.reply({
        content: "Guild document not found",
        ephemeral: true,
      });
    }

    // Get the data from the document snapshot
    const guildData = guildSnapshot.data();

    const togglablesPrefix = "togglables.decaySystem";

    const enabled = guildData?.togglables?.decaySystem?.enabled;
    const { percentage, interval, minimumCap } =
      guildData?.togglables?.decaySystem ?? {};

    if (!percentage || !interval || !minimumCap) {
      const msg =
        "You must set the decay system first, use **/decay-set-auto** to set the values";
      return await interaction.reply({ content: msg, ephemeral: true });
    }

    await admin
      .firestore()
      .collection("guilds")
      .doc(guildId)
      .update({
        [`${togglablesPrefix}.enabled`]: !enabled,
        [`${togglablesPrefix}.lastUpdated`]: !enabled
          ? admin.firestore.FieldValue.serverTimestamp()
          : null,
      });

    const msg = `Togglable: decaying system is now ${
      !enabled ? "enabled" : "disabled"
    }!`;
    return await interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    console.log(error);
    const msg = "Error toggling decay";
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }
};

/**
 * Sets the minimum cap for a guild.
 *
 * This function retrieves the minimum cap value from the interaction options and updates the corresponding guild document in Firestore.
 * If the minimum cap value is less than zero, it sends an ephemeral reply to the user indicating that the value must be above zero.
 * If the guild document does not exist, it throws an error.
 * If an error occurs during the update process, it logs the error and sends an ephemeral reply to the user.
 *
 * @param {any} interaction - The interaction object from Discord.
 * @param {any} interaction.options - The options object from the interaction.
 * @param {Function} interaction.options.getInteger - Function to get an integer option from the interaction.
 * @param {number} interaction.options.getInteger.minimum_cap - The minimum cap value to set for the guild.
 * @param {any} interaction.guild - The guild object from Discord.
 * @param {string} interaction.guild.id - The ID of the guild.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
export const setMinimumCap = async (interaction) => {
  trackFunctionExecution('setMinimumCap');
  const minimumCap = interaction.options.getInteger("minimum_cap");

  if (minimumCap < 0) {
    interaction.reply({ content: "Value must be above zero", ephemeral: true });
    return;
  }

  try {
    const guildId = interaction.guild.id;

    // Direct query to Firestore for the specific guild document
    const guildRef = admin.firestore().collection("guilds").doc(guildId);

    // Fetch the document snapshot
    const guildSnapshot = await guildRef.get();

    // Ensure the document exists
    if (!guildSnapshot.exists) {
      new Logger(interaction).log(PREFIX, "Guild document not found");
      return await interaction.reply({
        content: "Guild document not found",
        ephemeral: true,
      });
    }

    const togglablesPrefix = "togglables.decaySystem";

    await admin
      .firestore()
      .collection("guilds")
      .doc(guildId)
      .update({
        [`${togglablesPrefix}.minimumCap`]: minimumCap,
      });

    const msg = `Togglable: decay minimum cap updated successfully to **${minimumCap}**!`;
    return await interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    const msg = "Error updating decay";
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }
};

/**
 * Claim DKP code
 *
 * @param { any } interaction The interaction
 * @returns
 */
export async function claimDkpCode(interaction) {
  trackFunctionExecution('claimDkpCode');
  const amount = interaction.options.getInteger("amount");
  const expiration = interaction.options.getNumber("expiration-in-minutes");

  const guildDataResponse = await getGuildConfig(interaction.guild.id);
  const { memberDkps } = guildDataResponse;

  const { id } = interaction.user;

  let newGuildData = guildDataResponse;

  if (!expiration && !amount && !id) {
    const msg = `Something unexpected happened`;
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }

  // Initialize increasedDkp as a copy of the existing memberDkps array or an empty array if it doesn't exist
  let increasedDkp = memberDkps ? [...memberDkps] : [];

  // Validate the amount for positive number
  if (!isPositiveNumber(amount)) {
    const errorMsg = "The DKP amount must be a positive number.";
    return await interaction.reply({ content: errorMsg, ephemeral: true });
  }

  updateDkp(
    increasedDkp,
    user.id,
    amount,
    user,
    guildDataResponse?.guildData?.name,
    guildDataResponse
  );

  // Update the guild data with the new memberDkps array and the current timestamp
  newGuildData = {
    ...guildDataResponse,
    memberDkps: increasedDkp,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("guilds").doc(interaction.guild.id).update(newGuildData);

  const value = newGuildData?.memberDkps?.find(
    (member) => member.userId === user.id
  );
  const msg = `<@${user.id}>'s DKP was increased to **${value?.dkp}**!`;
  new Logger(interaction).log(PREFIX, msg);
  return await interaction.reply({ content: msg, ephemeral: true });
}

/**
 * Generates and saves a DKP code
 *
 * @param { any } interaction The interaction
 * @returns { any } Response
 */
export async function generateDkpCode(interaction) {
  trackFunctionExecution('generateDkpCode');
  const amount = interaction.options.getInteger("amount");
  const expiration = interaction.options.getNumber("expiration-in-minutes");
  const note = interaction.options.getString("note");

  if (!amount || !expiration) {
    const msg = `Amount and expiration are required.`;
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }

  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  // Validate the amount for positive number
  if (!isPositiveNumber(amount)) {
    const errorMsg = "The DKP amount must be a positive number.";
    return await interaction.reply({ content: errorMsg, ephemeral: true });
  }

  // Generate a unique code
  const code = generateClaimCode();

  let expirationDate = null;
  const errorToReturn = "Something unexpected happened, please generate again";

  // Calculate expiration date
  try {
    expirationDate = add(new Date(), { minutes: expiration });
  } catch (e) {
    return await interaction.reply({ content: errorToReturn, ephemeral: true });
  }

  if (!expirationDate) {
    return await interaction.reply({ content: errorToReturn, ephemeral: true });
  }

  // Create the code document
  const codeData = {
    guildId,
    userId,
    code,
    amount,
    expirationDate: admin.firestore.Timestamp.fromDate(expirationDate),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    note,
    redeemers: [],
  };

  try {
    // Save the code document to Firestore
    await db.collection("codes").add(codeData);

    const msg = `Code generated successfully: **${code}**\n- NOTE: It will expire in ${expiration} minutes.`;
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    const msg = "Error generating code";
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }
}

/**
 * Redeems a DKP code
 *
 * @param { any } interaction The interaction
 * @returns { any } Response
 */
export async function redeemDkpCode(interaction) {
  trackFunctionExecution('redeemDkpCode');
  const code = interaction.options.getString("code");

  if (!code) {
    const msg = `Code is required.`;
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }

  try {
    // Query the code document from Firestore
    const codeSnapshot = await db
      .collection("codes")
      .where("code", "==", code)
      .get();

    if (codeSnapshot.empty) {
      const msg = `Invalid code.`;
      new Logger(interaction).log(PREFIX, msg);
      return await interaction.reply({ content: msg, ephemeral: true });
    }

    const codeDoc = codeSnapshot.docs[0];
    const codeData = codeDoc.data();

    // Check if the user has already redeemed the code
    if (
      codeData?.redeemers?.some(
        (redeemer) => redeemer.userId === interaction.user.id
      )
    ) {
      const msg = `You have already redeemed this code.`;
      new Logger(interaction).log(PREFIX, msg);
      return await interaction.reply({ content: msg, ephemeral: true });
    }

    // Check if the code is expired
    if (isAfter(new Date(), codeData?.expirationDate.toDate())) {
      const msg = `Sorry, but this code has already expired.`;
      new Logger(interaction).log(PREFIX, msg);
      return await interaction.reply({ content: msg, ephemeral: true });
    }

    // Get the guild and user data
    const guildId = codeData.guildId;
    const userId = interaction.user.id;

    // Get the guild config
    const guildDataResponse = await getGuildConfig(guildId, 'redeemDkpCode');
    let newGuildData = guildDataResponse;

    // Initialize increasedDkp as a copy of the existing memberDkps array or an empty array if it doesn't exist
    let increasedDkp = guildDataResponse.memberDkps
      ? [...guildDataResponse.memberDkps]
      : [];

    // Update the DKP for the user
    updateDkp(
      increasedDkp,
      userId,
      codeData.amount,
      interaction.user,
      guildDataResponse?.guildData?.name,
      guildDataResponse
    );

    // Update the guild data with the new memberDkps array and the current timestamp
    newGuildData = {
      ...guildDataResponse,
      memberDkps: increasedDkp,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Save the updated guild data to Firestore
    await db.collection("guilds").doc(guildId).update(newGuildData);

    // Mark the code as redeemed
    let copyRedeemers = [...codeData?.redeemers];
    copyRedeemers.push({ userId, redeemedAt: new Date() });
    await db.collection("codes").doc(codeDoc.id).update({
      redeemers: copyRedeemers,
    });

    const msg = `Code of **+${codeData.amount}** was redeemed successfully! Your DKP has been updated.`;
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    const msg = "Error redeeming code";
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }
}

/**
 * Gets all DKP codes
 *
 * @returns { any[] } List of codes
 */
export async function getAllCodes() {
  trackFunctionExecution('getAllCodes');
  const snapshot = await db.collection("codes").get();

  if (snapshot.empty) {
    new Logger().log(PREFIX, `No codes found`);
    return [];
  }

  const codes = [];
  snapshot.forEach((doc) => {
    codes.push({ id: doc.id, ...doc.data() });
  });

  const codesData = codes;

  return codesData;
}

/**
 * Upadtes a guild config file
 *
 * @param {string} guildId The guildId
 * @param {any} guildConfig The document we're updating
 * @returns
 */
export async function updateGuildConfig(guildId, guildConfig) {
  trackFunctionExecution('updateGuildConfig');
  const response = await db
    .collection("guilds") 
    .doc(guildId)
    .update(guildConfig);
  return response;
}

/**
 * Search for guilds by name (case-insensitive)
 *
 * @param {string} searchTerm The search term to look for in guild names
 * @param {number} limit Maximum number of results to return (default: 10)
 * @returns {Array} Array of matching guilds
 */
export async function searchGuildsByName(searchTerm, limit = 10) {
  trackFunctionExecution('searchGuildsByName');
  
  if (!searchTerm || searchTerm.trim().length < 2) {
    return [];
  }

  const snapshot = await db.collection("guilds").get();
  
  if (snapshot.empty) {
    new Logger().log(PREFIX, `No guilds found for search term: ${searchTerm}`);
    return [];
  }

  const searchLower = searchTerm.toLowerCase().trim();
  const matchingGuilds = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    const guildName = data?.guildData?.name?.toLowerCase() || '';
    
    if (guildName.includes(searchLower)) {
      matchingGuilds.push({
        id: doc.id,
        name: data.guildData.name,
        ownerId: data.guildData.ownerId,
        subscription: data.subscription || {
          isPremium: false,
          expiresAt: null,
          planType: 'free'
        }
      });
    }
  });

  // Sort by name and limit results
  return matchingGuilds
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}

/**
 * Update guild subscription status
 *
 * @param {string} guildId The guild ID
 * @param {boolean} isPremium Whether the guild has premium access
 * @param {Date|null} expiresAt When the subscription expires (null for lifetime)
 * @param {string} planType The type of plan (free, premium, lifetime)
 * @returns {Promise} Update response
 */
export async function updateGuildSubscription(guildId, isPremium, expiresAt = null, planType = 'free') {
  trackFunctionExecution('updateGuildSubscription');
  
  const subscriptionData = {
    subscription: {
      isPremium,
      expiresAt: expiresAt ? admin.firestore.Timestamp.fromDate(expiresAt) : null,
      planType,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const response = await db
    .collection("guilds")
    .doc(guildId)
    .update(subscriptionData);

  new Logger().log(PREFIX, `Updated subscription for guild ${guildId}: Premium=${isPremium}, Expires=${expiresAt}, Plan=${planType}`);
  return response;
}

/**
 * Check if a guild has active premium subscription
 *
 * @param {string} guildId The guild ID
 * @returns {Promise<boolean>} Whether the guild has active premium access
 */
export async function isGuildPremium(guildId) {
  trackFunctionExecution('isGuildPremium');
  
  const guildConfig = await getGuildConfig(guildId, 'isGuildPremium');
  
  if (!guildConfig || !guildConfig.subscription) {
    return false;
  }

  const { isPremium, expiresAt, planType } = guildConfig.subscription;

  // If not premium, return false
  if (!isPremium) {
    return false;
  }

  // If it's a lifetime plan, return true
  if (planType === 'lifetime') {
    return true;
  }

  // If no expiration date, return false (shouldn't happen for premium plans)
  if (!expiresAt) {
    return false;
  }

  // Check if subscription is still valid
  const now = new Date();
  const expirationDate = expiresAt.toDate();
  
  return expirationDate > now;
}

/**
 * Get guild subscription info
 *
 * @param {string} guildId The guild ID
 * @returns {Promise<Object|null>} Subscription information
 */
export async function getGuildSubscription(guildId) {
  trackFunctionExecution('getGuildSubscription');
  
  const guildConfig = await getGuildConfig(guildId, 'getGuildSubscription');
  
  if (!guildConfig || !guildConfig.subscription) {
    return {
      isPremium: false,
      expiresAt: null,
      planType: 'free',
      isActive: false
    };
  }

  const { isPremium, expiresAt, planType } = guildConfig.subscription;
  const isActive = await isGuildPremium(guildId);

  return {
    isPremium,
    expiresAt: expiresAt ? expiresAt.toDate() : null,
    planType,
    isActive
  };
}

/**
 * Search for guilds by name (Admin command handler)
 *
 * @param {any} interaction The Discord interaction
 * @returns {Promise} Response
 */
export const searchGuilds = async (interaction) => {
  // Check if user is admin
  if (!isUserAdmin(interaction.user.id)) {
    return await interaction.reply({
      content: "❌ You don't have permission to use this command. This command is restricted to administrators only.",
      ephemeral: true,
    });
  }

  const searchTerm = interaction.options.getString("search_term");
  const limit = interaction.options.getInteger("limit") || 10;

  try {
    const guilds = await searchGuildsByName(searchTerm, limit);

    if (guilds.length === 0) {
      return await interaction.reply({
        content: `No guilds found matching "${searchTerm}"`,
        ephemeral: true,
      });
    }

    const guildList = guilds.map(guild => {
      const premiumStatus = guild.subscription?.isPremium ? 
        (guild.subscription?.planType === 'lifetime' ? '🟢 Lifetime' : 
         guild.subscription?.expiresAt ? `🟡 Premium (expires ${guild.subscription.expiresAt.toDate().toLocaleDateString()})` : 
         '🟡 Premium') : 
        '🔴 Free';
      
      return `**${guild.name}** (ID: \`${guild.id}\`)\nOwner: <@${guild.ownerId}>\nStatus: ${premiumStatus}`;
    }).join('\n\n');

    const embed = {
      title: `Guild Search Results for "${searchTerm}"`,
      description: guildList,
      color: 0x00ff00,
      footer: {
        text: `Found ${guilds.length} guild(s)`
      }
    };

    return await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    new Logger(interaction).error(PREFIX, "Error searching guilds", error);
    return await interaction.reply({
      content: "An error occurred while searching for guilds.",
      ephemeral: true,
    });
  }
};

/**
 * Set premium status for a guild (Admin command handler)
 *
 * @param {any} interaction The Discord interaction
 * @returns {Promise} Response
 */
export const setGuildPremium = async (interaction) => {
  // Check if user is admin
  if (!isUserAdmin(interaction.user.id)) {
    return await interaction.reply({
      content: "❌ You don't have permission to use this command. This command is restricted to administrators only.",
      ephemeral: true,
    });
  }

  const guildId = interaction.options.getString("guild_id");
  const isPremium = interaction.options.getBoolean("is_premium");
  const expiresAtString = interaction.options.getString("expires_at");
  const planType = interaction.options.getString("plan_type") || (isPremium ? "premium" : "free");

  try {
    // Validate guild ID format (Discord guild IDs are 17-19 digits)
    if (!/^\d{17,19}$/.test(guildId)) {
      return await interaction.reply({
        content: "Invalid guild ID format. Guild IDs should be 17-19 digits.",
        ephemeral: true,
      });
    }

    // Parse expiration date if provided
    let expiresAt = null;
    if (expiresAtString) {
      const parsedDate = new Date(expiresAtString);
      if (isNaN(parsedDate.getTime())) {
        return await interaction.reply({
          content: "Invalid date format. Please use YYYY-MM-DD format.",
          ephemeral: true,
        });
      }
      expiresAt = parsedDate;
    }

    // For lifetime plans, set expiresAt to null
    if (planType === 'lifetime') {
      expiresAt = null;
    }

    // For premium plans without expiration, set to 1 month from now
    if (isPremium && planType === 'premium' && !expiresAt) {
      expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    // Check if guild exists
    const guildConfig = await getGuildConfig(guildId, 'setGuildPremium');
    if (!guildConfig) {
      return await interaction.reply({
        content: `Guild with ID ${guildId} not found in the database.`,
        ephemeral: true,
      });
    }

    // Update subscription
    await updateGuildSubscription(guildId, isPremium, expiresAt, planType);

    const statusMessage = isPremium ? 
      (planType === 'lifetime' ? 'Lifetime Premium' : 
       `Premium (expires ${expiresAt ? expiresAt.toLocaleDateString() : 'Never'})`) : 
      'Free';

    return await interaction.reply({
      content: `✅ Successfully updated subscription for guild **${guildConfig.guildData.name}** (${guildId})\n\n**New Status:** ${statusMessage}`,
      ephemeral: true,
    });
  } catch (error) {
    new Logger(interaction).error(PREFIX, "Error setting guild premium status", error);
    return await interaction.reply({
      content: "An error occurred while updating the guild subscription.",
      ephemeral: true,
    });
  }
};

/**
 * Check premium status of a guild (Admin command handler)
 *
 * @param {any} interaction The Discord interaction
 * @returns {Promise} Response
 */
export const checkGuildPremium = async (interaction) => {
  // Check if user is admin
  if (!isUserAdmin(interaction.user.id)) {
    return await interaction.reply({
      content: "❌ You don't have permission to use this command. This command is restricted to administrators only.",
      ephemeral: true,
    });
  }

  const guildId = interaction.options.getString("guild_id");

  try {
    // Validate guild ID format
    if (!/^\d{17,19}$/.test(guildId)) {
      return await interaction.reply({
        content: "Invalid guild ID format. Guild IDs should be 17-19 digits.",
        ephemeral: true,
      });
    }

    // Get guild config
    const guildConfig = await getGuildConfig(guildId, 'checkGuildPremium');
    if (!guildConfig) {
      return await interaction.reply({
        content: `Guild with ID ${guildId} not found in the database.`,
        ephemeral: true,
      });
    }

    // Get subscription info
    const subscription = await getGuildSubscription(guildId);

    const statusEmoji = subscription.isActive ? '🟢' : '🔴';
    const statusText = subscription.isActive ? 'Active' : 'Inactive';
    
    const embed = {
      title: `Premium Status for ${guildConfig.guildData.name}`,
      color: subscription.isActive ? 0x00ff00 : 0xff0000,
      fields: [
        {
          name: "Guild ID",
          value: guildId,
          inline: true
        },
        {
          name: "Guild Name",
          value: guildConfig.guildData.name,
          inline: true
        },
        {
          name: "Owner",
          value: `<@${guildConfig.guildData.ownerId}>`,
          inline: true
        },
        {
          name: "Premium Status",
          value: `${statusEmoji} ${statusText}`,
          inline: true
        },
        {
          name: "Plan Type",
          value: subscription.planType.charAt(0).toUpperCase() + subscription.planType.slice(1),
          inline: true
        },
        {
          name: "Expires At",
          value: subscription.expiresAt ? subscription.expiresAt.toLocaleDateString() : 'Never',
          inline: true
        }
      ],
      timestamp: new Date().toISOString()
    };

    return await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    new Logger(interaction).error(PREFIX, "Error checking guild premium status", error);
    return await interaction.reply({
      content: "An error occurred while checking the guild premium status.",
      ephemeral: true,
    });
  }
};

/**
 * Check server premium status (User command handler)
 *
 * @param {any} interaction The Discord interaction
 * @returns {Promise} Response
 */
export const checkServerPremiumStatus = async (interaction) => {
  try {
    const guildId = interaction.guild.id;
    const subscription = await getGuildSubscription(guildId);

    const statusEmoji = subscription.isActive ? '🟢' : '🔴';
    const statusText = subscription.isActive ? 'Active' : 'Inactive';
    const planType = subscription.planType.charAt(0).toUpperCase() + subscription.planType.slice(1);
    
    const embed = {
      title: `Premium Status for ${interaction.guild.name}`,
      color: subscription.isActive ? 0x00ff00 : 0xff6b6b,
      fields: [
        {
          name: "Premium Status",
          value: `${statusEmoji} ${statusText}`,
          inline: true
        },
        {
          name: "Plan Type",
          value: planType,
          inline: true
        },
        {
          name: "Expires At",
          value: subscription.expiresAt ? subscription.expiresAt.toLocaleDateString() : 'Never',
          inline: true
        }
      ],
      timestamp: new Date().toISOString()
    };

    // Add premium features info if not premium
    if (!subscription.isActive) {
      embed.fields.push({
        name: "Premium Features",
        value: "• **Auction System** - Create and manage item auctions\n• **Advanced Analytics** - Detailed DKP reports\n• **Priority Support** - Faster response times\n• **Custom Commands** - Create server-specific commands",
        inline: false
      });
      
      embed.fields.push({
        name: "Upgrade Your Server",
        value: "Contact a server administrator to upgrade your subscription and unlock all premium features!",
        inline: false
      });
    } else {
      embed.fields.push({
        name: "Premium Features",
        value: "✅ **Auction System** - Full access\n✅ **Advanced Analytics** - Available\n✅ **Priority Support** - Active\n✅ **Custom Commands** - Coming soon",
        inline: false
      });
    }

    return await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    new Logger(interaction).error(PREFIX, "Error checking server premium status", error);
    return await interaction.reply({
      content: "An error occurred while checking the server premium status.",
      ephemeral: true,
    });
  }
};

/**
 * Deletes a guild and its data from Firebase
 * 
 * @param {string} guildId The ID of the guild to delete
 * @returns {Promise<void>} A promise that resolves when the guild is deleted
 */
export const deleteGuild = async (guildId) => {
  trackFunctionExecution('deleteGuild');
  
  try {
    await db.collection("guilds").doc(guildId).delete();
    new Logger().log(PREFIX, `Guild ${guildId} was deleted successfully`);
  } catch (error) {
    new Logger().error(PREFIX, `Error deleting guild ${guildId}`, error);
    throw error;
  }
};

export const checkBotPermissions = async (interaction) => {
  trackFunctionExecution('checkBotPermissions');
  
  try {
    const { canManageThreads, canManageChannels, getPermissionUpdateInstructions } = await import('../utils/permissionChecker.js');
    const { PermissionFlagsBits } = await import('discord.js');
    
    // Check all required permissions
    const threadCheck = canManageThreads(interaction.guild);
    const channelCheck = canManageChannels(interaction.guild);
    
    const allRequiredPermissions = [
      PermissionFlagsBits.ManageThreads,
      PermissionFlagsBits.ManageChannels, 
      PermissionFlagsBits.SendMessagesInThreads,
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.UseApplicationCommands
    ];
    
    const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
    const missingPermissions = allRequiredPermissions.filter(permission => 
      !botMember?.permissions.has(permission)
    );
    
    if (missingPermissions.length === 0) {
      await interaction.reply({
        content: '✅ **Bot has all required permissions!**\n\nThe bot is fully functional and can perform all operations.',
        ephemeral: true
      });
    } else {
      const instructions = getPermissionUpdateInstructions(missingPermissions);
      
      await interaction.reply({
        content: `❌ **Missing Permissions Detected**\n\n${instructions}`,
        ephemeral: true
      });
    }
  } catch (error) {
    new Logger().logLocal(PREFIX, `Error checking permissions: ${error.message}`);
    await interaction.reply({
      content: '❌ Error checking bot permissions. Please contact the bot administrator.',
      ephemeral: true
    });
  }
};

export const setRoleOnJoin = async (interaction) => {
  trackFunctionExecution('setRoleOnJoin');
  const role = interaction.options.getRole("role");
  const amount = interaction.options.getInteger("amount");

  if (amount < 0) {
    interaction.reply({ content: "Value must be above zero", ephemeral: true });
    return;
  }

  if (!role && !amount) {
    interaction.reply({
      content: "You must specify at least a role or an amount",
      ephemeral: true,
    });
    return;
  }

  try {
    const guildId = interaction.guild.id;

    // Direct query to Firestore for the specific guild document
    const guildRef = admin.firestore().collection("guilds").doc(guildId);

    // Fetch the document snapshot
    const guildSnapshot = await guildRef.get();

    // Ensure the document exists
    if (!guildSnapshot.exists) {
      new Logger(interaction).log(PREFIX, "Guild document not found");
      return await interaction.reply({
        content: "Guild document not found",
        ephemeral: true,
      });
    }

    const prefix = "togglables.dkpSystem";

    await admin
      .firestore()
      .collection("guilds")
      .doc(guildId)
      .update({
        ...(amount
          ? { [`${prefix}.onJoinDKPAmount`]: amount ? amount : 0 }
          : undefined),
        ...(role ? { [`${prefix}.roleToAssign`]: role.id } : undefined),
      });

    let msg = `Now when a member joins, they will:`;
    if (role) {
      msg = msg.concat(`\n- Be assigned to: <@&${role.id}>`);
    }
    if (amount) {
      msg = msg.concat(`\n- Receive: **${amount ? amount : 0}** DKP`);
    }
    return await interaction.reply({ content: msg, ephemeral: true });
  } catch (error) {
    console.log(error);
    const msg = "Error updating decay";
    new Logger(interaction).log(PREFIX, msg);
    return await interaction.reply({ content: msg, ephemeral: true });
  }
};

/**
 * Handle the autocompletion of the item name for the auction
 *
 * @param {any} interaction The interaction
 */
export const handleAuctionAutocomplete = async (interaction) => {
  const focusedValue = interaction.options.getFocused();

  await searchItem(focusedValue).then(async (res) => {
    const items = res ?? [];
    const choices = items?.map((item) => item.name?.trim());

    const filtered = choices.filter((choice) =>
      choice.toLowerCase().trim().includes(focusedValue.toLowerCase().trim())
    );

    await interaction.respond(
      filtered.slice(0, 25).map((choice) => ({ name: choice, value: choice }))
    );
  });
};

/**
 * Parses the status of the auction
 *
 * @param { string } auctionStatus
 * @returns Parse the status
 */
export const statusParser = (_auctionStatus) => {
  let auctionPrefix = "";
  let auctionStatus = "";
  let modalColor = 0x000000;

  switch (_auctionStatus) {
    case "started":
      auctionPrefix = "has been";
      auctionStatus = "started";
      modalColor = 0x5865f2;
      break;
    case "cancelled":
      auctionPrefix = "has been";
      auctionStatus = "cancelled";
      modalColor = 0xff0000;
      break;
    case "scheduled":
      auctionPrefix = "has been";
      auctionStatus = "scheduled";
      modalColor = 0xffff00;
      break;
    default:
      auctionPrefix = "has been";
      auctionStatus = "finalized";
      modalColor = 0x00ff00;
      break;
  }

  return {
    prefix: auctionPrefix,
    status: auctionStatus,
    modal: modalColor,
  };
};

export const updateAuction = async ({ _message = null, auction }) => {
  const message = _message;

  const firestoreAuctionMaxTime =
    auction?.auctionMaxTime instanceof admin.firestore.Timestamp
      ? convertFirestoreTimestamp(auction?.auctionMaxTime)
      : auction?.auctionMaxTime;
  const firestoreStarting =
    auction?.startingAt instanceof admin.firestore.Timestamp
      ? convertFirestoreTimestamp(auction?.startingAt)
      : auction?.startingAt;

  const formattedStarting = firestoreStarting
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    .replace(",", "")
    .replace(" ", "-");

  const formattedMaxTime = firestoreAuctionMaxTime
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    .replace(",", "")
    .replace(" ", "-");

  const dynamicAuctionStatus = () => {
    const now = new Date();

    // If auction is explicitly finalized or cancelled, return that status immediately
    if (auction?.finalized) {
      return "finalized";
    }
    if (auction?.cancelled) {
      return "cancelled";
    }

    const isScheduled = isBefore(now, firestoreStarting);
    const isFinalized =
      (isEqual(firestoreStarting, firestoreAuctionMaxTime) ||
        isEqual(now, firestoreAuctionMaxTime) ||
        isAfter(now, firestoreAuctionMaxTime));
    const isStarted =
      isAfter(now, firestoreStarting);

    if (isFinalized) {
      return "finalized";
    } else if (isScheduled) {
      return "scheduled";
    } else if (isStarted) {
      return "started";
    } else {
      return "cancelled";
    }
  };

  let theEmbed;
  let theComponents;

  const { prefix, status, modal } = statusParser(dynamicAuctionStatus());

  const highestBid = Math.max(
    ...(auction.bids?.map((bid) => bid.bid) || {}),
    0
  );
  const highestBidder = auction.bids?.find((bid) => bid.bid === highestBid);
  const highestBidderMember = await message.guild.members.fetch(
    highestBidder?.userId
  );
  const highestBidderNickname =
    highestBidderMember?.nickname &&
    highestBidderMember?.nickname !== "" &&
    highestBidderMember?.nickname !== "null" &&
    highestBidderMember?.nickname !== null
      ? highestBidderMember.nickname
      : highestBidderMember?.user?.globalName;

  const { embed, components } = createOrModifyAuctionEmbed({
    itemName: auction.itemName,
    itemNote: auction.itemNote,
    startingPrice: `${auction.startingPrice}`,
    maxPrice: `${auction.maxPrice}`,
    gapBetweenBids: `${auction.gapBetweenBids}`,
    startingAt: `${formattedStarting}`,
    auctionMaxTime: `${formattedMaxTime}`,
    auctionPrefix: prefix,
    auctionStatus: status,
    modalColor: modal,
    highestBidder: {
      bid: highestBid,
      name: highestBidderNickname,
    },
  });
  theEmbed = embed;
  theComponents = components;

  const auctionDTO = {
    ...auction,
    auctionStatus: status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(status === "finalized" && { finalized: true }),
  };

  // Trigger the status on database
  (async () => {
    try {
      await updateAuctionConfig(auction?.data?.messageId, auctionDTO);
    } catch (error) {
      console.log(error);
      new Logger().error(
        PREFIX,
        "An error occurred while updating the auction."
      );
      await i.reply({
        content: "An error occurred while updating the auction.",
        ephemeral: true,
      });
      return;
    }
  })();

  (async () => {
    try {
      await message.edit({
        embeds: [theEmbed],
        components: theComponents ? theComponents : [],
      });
    } catch (error) {
      console.error("Error editing message:", error);
      await i.reply({
        content: "An error occurred while editing the message.",
        ephemeral: true,
      });
    }
  })();

  // Create an interaction collector
  const filter = (i) =>
    ["bid", "start_auction", "stop_auction"].includes(i.customId);
  const collector = message.createMessageComponentCollector({
    filter,
    time: firestoreAuctionMaxTime?.getTime() - Date.now(),
  });

  collector.on("collect", async (i) => {
    if (i.customId === "start_auction") {
      const userId = i?.user?.id;

      const isUserOwner = auction.ownerDiscordId === userId;

      if (!isUserOwner) {
        await i.reply({
          content: "You are not the owner of this auction, and can't do that.",
          ephemeral: true,
        });
        return;
      }

      // create the thread only if it doesn't exist
      let thread;
      try {
        thread = await message.startThread({
          name: `Auction: ${auction?.itemName}'s bids`,
          reason: "All bids are going to be here!",
        });
        
        // Verify thread was created successfully
        if (!thread) {
          throw new Error("Thread creation returned null/undefined");
        }
        
        // Wait a moment for the thread to be fully initialized
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify permissionOverwrites exists
        if (!thread.permissionOverwrites) {
          new Logger().logLocal(
            PREFIX,
            "Thread created but permissionOverwrites is not available. Skipping permission setup."
          );
        } else {
          // set the thread permissions
          try {
            await thread.permissionOverwrites.edit(thread.guild.roles.everyone, {
              SendMessages: false,
              AttachFiles: false,
            });
            await thread.permissionOverwrites.edit(thread.client.user, {
              SendMessages: true,
            });
            new Logger().logLocal(
              PREFIX,
              "Thread permissions set successfully"
            );
          } catch (permErr) {
            console.log("Permission error:", permErr);
            new Logger().logLocal(
              PREFIX,
              `Failed to set thread permissions: ${permErr.message}`
            );
            // Don't fail the auction creation if permissions fail
          }
        }
      } catch (err) {
        console.log("Thread creation error:", err);
        new Logger().logLocal(
          PREFIX,
          `Failed to create thread: ${err.message}`
        );
        await i.reply({
          content: "An error occurred while creating the auction thread.",
          ephemeral: true,
        });
        return; // Exit early if thread creation fails
      }

      // send the message to the thread
      try {
        thread.send(
          `Auction started for **${auction?.itemName}**!\n\n- Starting price: **${auction?.startingPrice} DKP**\n\n@everyone can start bidding by typing: **/bid ${auction?.startingPrice}**, goodluck!`
        );
      } catch (error) {
        new Logger().logLocal(
          PREFIX,
          "An error occurred while sending a message to the thread."
        );
        await i.reply({
          content: "An error occurred while sending a message to the thread.",
          ephemeral: true,
        });
      }

      // set the auction thread id on the map
      auctionsMap.set(thread.id, {
        ...auction,
        data: {
          ...auction.data,
          threadId: thread.id,
          messageId: _message?.id,
        },
      });

      // set the listener for the thread
      const listerner = async (interaction) => {
        const { commandName } = interaction;

        if (commandName === "bid" && interaction?.channel?.type === 0) {
          try {
            await interaction.reply({
              content:
                "**This command only works on an auction thread**\n\nFor example: Click on '**View topic**' on threads with the prefix **Auction**: <item name>'s bids\n\nThere you should be able to bid if the auction is running!",
              ephemeral: true,
            });
          } catch (e) {
            console.log(e);
          }
          return;
        }

        const theAuction = auctionsMap.get(interaction.channel.id);
        if (theAuction) {
          await processBid(interaction, theAuction);
        }
      };

      threadListeners.set(thread.id, listerner);
      thread.client.on("interactionCreate", listerner);

      let embed, components;
      try {
        const { prefix, status, modal } = statusParser("started");

        const formattedStartingNew = convertDateObjectToDateString(new Date());

        ({ embed, components } = createOrModifyAuctionEmbed({
          itemName: auction.itemName,
          startingPrice: `${auction.startingPrice}`,
          itemNote: `${auction.itemNote}`,
          gapBetweenBids: `${auction.gapBetweenBids}`,
          startingAt: `${formattedStartingNew}`,
          auctionMaxTime: `${formattedMaxTime}`,
          auctionPrefix: prefix,
          auctionStatus: status,
          modalColor: modal,
        }));

        const auctionDTO = {
          ...auction,
          startingAt: new Date(),
          auctionStatus: status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          data: {
            ...auction.data,
            threadId: thread.id,
          },
        };

        try {
          await updateAuctionConfig(auction?.data?.messageId, auctionDTO);
        } catch (error) {
          console.log(error);
          new Logger().error(
            PREFIX,
            "An error occurred while updating the auction."
          );
          await i.reply({
            content: "An error occurred while updating the auction.",
            ephemeral: true,
          });
          return;
        }
      } catch (error) {
        console.error("Error in createOrModifyAuctionEmbed:", error);
        await i.reply({
          content: "An error occurred while modifying the auction embed.",
          ephemeral: true,
        });
        return;
      }

      try {
          await message.edit({
            embeds: [embed],
            components: components ? components : [],
          });
      } catch (error) {
        new Logger().error(
          PREFIX,
          `An error occurred while editing the message: ${error}`
        );
        await i.reply({
          content: "An error occurred while editing the message.",
          ephemeral: true,
        });
      }
    } else if (i.customId === "stop_auction") {
      // STOP_AUCTION
      const userId = i?.user?.id;

      const isUserOwner = auction.ownerDiscordId === userId;

      if (!isUserOwner) {
        await i.reply({
          content: "You are not the owner of this auction, and can't do that.",
          ephemeral: true,
        });
        return;
      }

      let embed, components;
      try {
        const { prefix, status, modal } = statusParser("cancelled");

        const formattedStartingNew = convertDateObjectToDateString(new Date());

        const formattedMaxBid = convertDateObjectToDateString(new Date());

        ({ embed, components } = createOrModifyAuctionEmbed({
          itemName: auction.itemName,
          startingPrice: `${auction.startingPrice}`,
          itemNote: `${auction.itemNote}`,
          gapBetweenBids: `${auction.gapBetweenBids}`,
          startingAt: `${formattedStartingNew}`,
          auctionMaxTime: `${formattedMaxBid}`,
          auctionPrefix: prefix,
          auctionStatus: status,
          modalColor: modal,
        }));

        const auctionDTO = {
          ...auction,
          startingAt: new Date(),
          auctionMaxTime: new Date(),
          auctionStatus: status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          bids: [],
          cancelled: true,
        };

        try {
          if (auction?.finalized && !auction.finalized === true) {
            await updateAuctionConfig(auction.data.messageId, auctionDTO);
          }
        } catch (error) {
          new Logger().error(
            PREFIX,
            "An error occurred while updating the auction."
          );
          await i.reply({
            content: "An error occurred while updating the auction.",
            ephemeral: true,
          });
          return;
        }
      } catch (error) {
        new Logger().error(
          PREFIX,
          "An error occurred while modifying the auction embed. error:" + error
        );
        await i.reply({
          content: "An error occurred while modifying the auction embed.",
          ephemeral: true,
        });
        return;
      }

      try {
          Logger().logLocal(
            "Auction",
            "Auction is already finalized, skipped discord."
          );
          await message.edit({
            embeds: [embed],
            components: components ? components : [],
          });
          
          // Lock the thread when auction is cancelled
          if (auction.data?.threadId) {
            try {
              const thread = await message.guild.channels.fetch(auction.data.threadId);
              if (thread) {
                await thread.setLocked(true);
                new Logger().logLocal(
                  PREFIX,
                  `Thread locked for cancelled auction: ${auction.itemName}`
                );
              }
            } catch (threadError) {
              new Logger().logLocal(
                PREFIX,
                `Failed to lock thread for cancelled auction: ${threadError.message}`
              );
            }
          }
      } catch (error) {
        console.error("Error editing message:", error);
        await i.reply({
          content: "An error occurred while editing the message.",
          ephemeral: true,
        });
      }
    }
  });

  if (process.env.NODE_ENV === "development") {
    collector.on("end", (collected) => {
      console.log(`Collected ${collected.size} interactions.`);
    });
  }
};

/**
 * Handle the modal submission for creating an auction
 *
 * @param {any} interaction Handle the modal submission for creating an auction
 */
export const handleSubmitModalCreateAuction = async (interaction) => {
  const [, itemName, note] = interaction.customId.split("#").slice(1);
  try {
    // Defer the interaction response immediately
    await interaction.deferReply({ ephemeral: true });

    const [command] = interaction.customId.split("#");
    const startingPrice = interaction.fields.getTextInputValue(
      `${command}#startingPrice`
    );
    /*const maxPrice = interaction.fields.getTextInputValue(
      `${command}#maxPrice`
    );*/
    const startingAt = interaction.fields.getTextInputValue(
      `${command}#startingAt`
    );
    const auctionMaxTime = interaction.fields.getTextInputValue(
      `${command}#auctionMaxTime`
    );
    const gapBetweenBids = interaction.fields.getTextInputValue(
      `${command}#gapBetweenBids`
    );

    let errors = [];

    // Validate if it's a number
    const parsedStartingPrice = parseFloat(startingPrice);
    if (isNaN(startingPrice) && parsedStartingPrice <= 0) {
      errors.push("Starting price must be a number and greater than 0.");
    }

    if (note && note.length > 50) {
      errors.push("The item note must not exceed 50 characters.");
    }

    if (!note || note === "") {
      errors.push("The item note must not be empty.");
    }

    if (gapBetweenBids && isNaN(gapBetweenBids)) {
      errors.push("Gap between bids must be a number and greater 0'.");
    }

    // Validate startingAt format
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}-\d{2}:\d{2}:\d{2}$/;
    if (!dateRegex.test(startingAt)) {
      errors.push(
        "Starting time must be in the format: **dd/mm/yyyy-hh:mm:ss**."
      );
    }

    const dateRegexAuctionMaxTime = /^\d{2}\/\d{2}\/\d{4}-\d{2}:\d{2}:\d{2}$/;
    if (!dateRegexAuctionMaxTime.test(auctionMaxTime)) {
      errors.push(
        "Auction max time must be in the format: **dd/mm/yyyy-hh:mm:ss**."
      );
    }

    // Validate startingAt is a future date
    const parsedStartingAt = convertDateStringToDateObject(startingAt);
    const parsedAuctionMaxTime = convertDateStringToDateObject(auctionMaxTime);

    if (
      isNaN(parsedStartingAt.getTime()) ||
      isNaN(parsedAuctionMaxTime.getTime())
    ) {
      errors.push("Invalid date format for startingAt or auctionMaxTime.");
    } else if (parsedStartingAt <= new Date()) {
      errors.push("Starting time must be a future date.");
    } else if (parsedStartingAt >= parsedAuctionMaxTime) {
      errors.push("Starting time must be before the auction max time.");
    }

    if (errors.length > 0) {
      return await interaction.editReply({
        content: "- " + errors.join("\n -"),
      });
    } else {
      await interaction.editReply({
        content: `All done, everything is set up! Now its time to see them battling =)`,
        ephemeral: true,
      });
    }

    const { modal, prefix, status } = statusParser("scheduled");
    const auctionDTO = {
      itemName,
      itemNote: note,
      auctionMaxTime: parsedAuctionMaxTime,
      gapBetweenBids: parseFloat(gapBetweenBids),
      startingAt: parsedStartingAt,
      startingPrice: parseFloat(startingPrice),
      auctionStatus: status,
      ownerDiscordId: interaction.user.id,
      data: {
        guildId: interaction.guild.id,
      },
      bids: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
      let { embed, components } = createOrModifyAuctionEmbed({
        itemName,
        itemNote: note,
        startingPrice,
        gapBetweenBids,
        startingAt,
        auctionMaxTime,
        auctionPrefix: prefix,
        auctionStatus: status,
        modalColor: modal,
      });

      try {
        // Send the embed with buttons
        const followUpMessage = await interaction.followUp({
          embeds: [embed],
          components: components ? components : undefined,
        });

        const parsedAuctionDTO = {
          ...auctionDTO,
          data: {
            ...auctionDTO.data,
            channelId: followUpMessage.channel.id,
            messageId: followUpMessage.id,
          },
        };

        await auctionCreate(parsedAuctionDTO).then(async (auction) => {
          try {
            updateAuction({ _message: followUpMessage, auction });
          } catch (err) {
            new Logger().log(PREFIX, `Error creating auction: ${err}`);
            await interaction.followUp({
              content: "An unexpected error occurred.",
              ephemeral: true,
            });
          }
        });
      } catch (err) {
        new Logger().log(PREFIX, `Error creating auction: ${err}`);
        await interaction.followUp({
          content: "An unexpected error occurred.",
          ephemeral: true,
        });
      }
    } catch (err) {
      new Logger().log(PREFIX, `Error creating auction: ${err}`);
      await interaction.followUp({
        content: "An unexpected error occurred.",
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error("Error handling modal submission:", error);
    if (!interaction.replied) {
      await interaction.reply({
        content: "An unexpected error occurred.",
        ephemeral: true,
      });
    }
  }
};

/**
 * Check if guild has premium access for auction features
 *
 * @param {string} guildId The guild ID
 * @returns {Promise<boolean>} Whether the guild has premium access
 */
export const checkAuctionPremiumAccess = async (guildId) => {
  return await isGuildPremium(guildId);
};

/**
 * Check if a user is an admin based on Discord ID
 *
 * @param {string} userId The Discord user ID
 * @returns {boolean} Whether the user is an admin
 */
export const isUserAdmin = (userId) => {
  const adminDiscordIds = process.env.ADMINS?.split(",") || [];
  return adminDiscordIds.includes(userId);
};

/**
 * Create the auction
 *
 * @param {any} interaction The interaction
 */
export const createAuction = async (interaction) => {
  const itemName = interaction.options.getString("item");
  const itemNote = interaction.options.getString("note");

  // Check if guild has premium access for auctions
  const hasPremiumAccess = await checkAuctionPremiumAccess(interaction.guild.id);
  if (!hasPremiumAccess) {
    const subscription = await getGuildSubscription(interaction.guild.id);
    const embed = {
      title: "🔒 Premium Feature Required",
      description: "The auction system is only available to premium servers. Upgrade your server to access this feature and many more!",
      color: 0xff6b6b,
      fields: [
        {
          name: "Current Status",
          value: subscription.isPremium ? 
            (subscription.expiresAt ? `Premium (expires ${subscription.expiresAt.toLocaleDateString()})` : 'Premium (expired)') : 
            'Free',
          inline: true
        },
        {
          name: "Available Plans",
          value: "• **Premium Monthly** - Full access to all features\n• **Lifetime** - One-time payment, permanent access",
          inline: false
        }
      ],
      footer: {
        text: "Contact an administrator to upgrade your server's subscription"
      }
    };

    return await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }

  const theItem = await searchItem(itemName?.toLowerCase()?.trim());

  // Avoid this command to be used in threads
  if (interaction?.channel?.type && interaction?.channel?.type !== 0) {
    await interaction.reply({
      content: "This command can only be used in normal text channels.",
      ephemeral: true,
    });
    return;
  }

  // Check if the item is valid
  if (
    !theItem?.length &&
    theItem[0]?.name !== itemName?.toLowerCase()?.trim()
  ) {
    await interaction.reply({
      content: "Invalid item selected",
      ephemeral: true,
    });
    return;
  }

  if (!itemName) {
    await interaction.reply({
      content: "You must select an item to create an auction!",
      ephemeral: true,
    });
    return;
  }

  const yes = new ButtonBuilder()
    .setCustomId("confirm")
    .setLabel("Confirm")
    .setStyle(ButtonStyle.Success);

  const no = new ButtonBuilder()
    .setCustomId("cancel")
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents([yes, no]);

  await interaction.reply({
    content: `Are you sure you want to select: **${itemName.trim()}**?`,
    ephemeral: true,
    components: [row],
  });

  const collectorFilter = (i) => i.user.id === interaction.user.id;

  try {
    const confirmation = await interaction.channel.awaitMessageComponent({
      filter: collectorFilter,
      time: 60_000,
    });

    if (confirmation.customId === "confirm") {
      const modal = new ModalBuilder()
        .setCustomId(`auction-create#modal#${itemName}#${itemNote}`)
        .setTitle("Enter Auction Details");

      const startingPrice = new TextInputBuilder()
        .setCustomId("auction-create#startingPrice")
        .setLabel("Bid starting price:")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Enter a number here")
        .setRequired(true);

      /*const maxPrice = new TextInputBuilder()
        .setCustomId("auction-create#maxPrice")
        .setLabel("Bid max price:")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Enter a number here")
        .setRequired(false);*/

      const startingAt = new TextInputBuilder()
        .setCustomId("auction-create#startingAt")
        .setLabel("When will the auction start:")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(19)
        .setMinLength(19)
        .setPlaceholder("Expected format: (dd/mm/yyyy-hh:mm:ss)")
        .setValue(
          convertDateObjectToDateString(add(new Date(), { seconds: 20 }))
        )
        .setRequired(true);

      const auctionMaxTime = new TextInputBuilder()
        .setCustomId("auction-create#auctionMaxTime")
        .setLabel("Auction max time:")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(19)
        .setMinLength(19)
        .setPlaceholder("Expected format: (dd/mm/yyyy-hh:mm:ss)")
        .setValue(convertDateObjectToDateString(add(new Date(), { seconds: 40 })))
        .setRequired(true);

      const gapBetweenBids = new TextInputBuilder()
        .setCustomId("auction-create#gapBetweenBids")
        .setLabel("Gap between bids:")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Bids with difference of X or more will be allowed")
        .setRequired(true);

      const actionRows = [
        new ActionRowBuilder().addComponents(startingPrice),
        new ActionRowBuilder().addComponents(gapBetweenBids),
        //new ActionRowBuilder().addComponents(maxPrice),
        new ActionRowBuilder().addComponents(startingAt),
        new ActionRowBuilder().addComponents(auctionMaxTime),
      ];

      modal.addComponents(actionRows);

      await interaction.editReply({
        content: `Item selection confirmed: **${itemName}**`,
        ephemeral: true,
        components: [],
      });

      // Show the modal via the confirmation interaction
      await confirmation.showModal(modal);
    } else if (confirmation.customId === "cancel") {
      await confirmation.update({
        content: "Action cancelled",
        ephemeral: true,
        components: [],
      });
    }
  } catch (e) {
    console.log(e);
    await interaction.editReply({
      content: "Confirmation not received within 1 minute, cancelling",
      ephemeral: true,
      components: [],
    });
  }
};
