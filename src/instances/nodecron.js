import cron from "node-cron";
import * as api from "../../database/repository.js";
import { processAuctionWinner, archiveAuction, cleanupExpiredChallenges } from "../../database/repository.js";
import { add, isEqual, isAfter } from "date-fns";
import admin from "firebase-admin";
import { Logger } from "../../utils/logger.js";
import { config } from "dotenv";
import { main as itemGrabber } from "../../database/itemsGrabber.js";
import { client as discordBot } from "../../src/index.js";
import { db } from "../../database/firebase.js";
import { canManageThreads, getPermissionUpdateInstructions } from "../../utils/permissionChecker.js";
import {
  createOrModifyAuctionEmbed,
  convertDateObjectToDateString,
} from "../../utils/index.js";

config();

const PREFIX = "Cron";

const auctionsMap = api.auctionsMap;
const threadListeners = api.threadListeners;

// Map to store last known auction status to avoid unnecessary API calls
const lastKnownStatus = new Map();

// Map to track recently processed auctions to prevent duplicate processing
const recentlyProcessed = new Map();

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
    process.env.ENV === "dev" ? "*/15 * * * * *" : "0 0 * * *",
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
            enabled === true &&
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
        } guilds at ${new Date()}`
      );
    },
    {
      scheduled: true,
      timezone: "America/Sao_Paulo",
    }
  );

  return decayTask;
};

const deleteExpiredCodes = async () => {
  const deleteTask = cron.schedule(
    process.env.ENV === "dev" ? "*/30 * * * * *" : "0 1 * * *",
    async () => {
      const codes = await api.getAllCodes();

      const expiredCodes = codes.filter((code) => {
        const expirationDate =
          code.expirationDate instanceof admin.firestore.Timestamp
            ? code.expirationDate.toDate()
            : new Date(code.expirationDate);
        const currentDate = new Date();
        const daysDifference =
          (currentDate - expirationDate) / (1000 * 60 * 60 * 24);
        return daysDifference > 60;
      });

      for (const code of expiredCodes) {
        const codeRef = admin.firestore().collection("codes").doc(code.id);
        await codeRef.delete();
      }

      new Logger().log(
        PREFIX,
        `Deleted ${expiredCodes.length} expired codes at ${new Date()}`
      );
    },
    {
      scheduled: true,
      timezone: "America/Sao_Paulo",
    }
  );

  return deleteTask;
};

export const itemsGrabber = async () => {
  const itemsTask = cron.schedule(
    process.env.ENV === "dev" ? "*/30 * * * * *" : "0 1 * * *",
    async () => {
      await itemGrabber();

      new Logger().log(
        PREFIX,
        `Grabbed ${expiredCodes.length} expired codes at ${new Date()}`
      );
    },
    {
      scheduled: true,
      timezone: "America/Sao_Paulo",
    }
  );
  return itemsTask;
};

export const updateAuctions = async () => {
  const auctionsTask = cron.schedule(
    process.env.ENV === "dev" ? "*/10 * * * * *" : "0 2 * * *",
    async () => {
      // First, do a simple count check to avoid heavy processing if no auctions exist
      const auctionsCountSnapshot = await db.collection("auctions").count().get();
      const totalAuctions = auctionsCountSnapshot.data().count;
      
      if (totalAuctions === 0) {
        new Logger().log(PREFIX, `No auctions found (count check)`);
        return;
      }

      // Add a small delay to prevent rapid processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Clean up old entries from recentlyProcessed map (older than 5 minutes)
      const now = Date.now();
      for (const [auctionId, timestamp] of recentlyProcessed.entries()) {
        if (now - timestamp > 300000) { // 5 minutes
          recentlyProcessed.delete(auctionId);
        }
      }

      // Now fetch the actual auctions for processing
      const auctionsSnapshot = await db.collection("auctions").get();

      if (auctionsSnapshot.empty) {
        new Logger().log(PREFIX, `No auctions found (after count check)`);
        return;
      }

      // First, clean up any finalized auctions that might still be in the active collection
      const finalizedAuctions = [];
      auctionsSnapshot.forEach((doc) => {
        const auction = { id: doc.id, ...doc.data() };
        if (auction.finalized || auction.auctionStatus === "finalized") {
          finalizedAuctions.push(auction);
        }
      });

      // Only process if we have finalized auctions
      if (finalizedAuctions.length > 0) {
        new Logger().logLocal(PREFIX, `Found ${finalizedAuctions.length} finalized auctions still in active collection, cleaning them up`);
        
        for (const auction of finalizedAuctions) {
          // Skip if this auction was recently processed (within last 30 seconds)
          const now = Date.now();
          const lastProcessed = recentlyProcessed.get(auction.id);
          if (lastProcessed && (now - lastProcessed) < 30000) {
            new Logger().logLocal(PREFIX, `Skipping recently processed auction: ${auction.itemName}`);
            continue;
          }
          
          try {
            // Mark as being processed
            recentlyProcessed.set(auction.id, now);
            
            // Check if auction has bids to determine archive reason
            if (auction.bids && auction.bids.length > 0) {
              const highestBid = Math.max(...auction.bids.map(bid => bid.bid));
              const winnerBid = auction.bids.find(bid => bid.bid === highestBid);
              
              const winnerInfo = winnerBid ? {
                userId: winnerBid.userId,
                bidAmount: winnerBid.bid,
                winnerName: `User ${winnerBid.userId}`
              } : null;
              
              await archiveAuction(auction, 'finalized_cleanup', winnerInfo);
            } else {
              await archiveAuction(auction, 'finalized_no_bids_cleanup');
            }
            
            // Double-check deletion using the correct document ID
            await db.collection("auctions").doc(auction.id).delete();
            new Logger().logLocal(PREFIX, `Cleaned up finalized auction: ${auction.itemName} (docId: ${auction.id})`);
          } catch (error) {
            new Logger().logLocal(PREFIX, `Error cleaning up finalized auction ${auction.itemName}: ${error.message}`);
          }
        }
      }

      // Now process only the active auctions (non-finalized ones)
      const auctions = [];
      auctionsSnapshot.forEach((doc) => {
        const auction = { id: doc.id, ...doc.data() };
        // Only include non-finalized auctions in the processing loop
        if (!auction.finalized && auction.auctionStatus !== "finalized") {
          auctions.push(auction);
        }
      });

      try {
        // Loop the auctions
        for (const auction of auctions) {
          // Check if auction has expired and needs to be finalized
          const now = new Date();
          const auctionEndTime = auction.auctionMaxTime instanceof admin.firestore.Timestamp
            ? auction.auctionMaxTime.toDate()
            : auction.auctionMaxTime;
          
          const auctionStartTime = auction.startingAt instanceof admin.firestore.Timestamp
            ? auction.startingAt.toDate()
            : auction.startingAt;
          

          // Debug logging for auction expiration check
          new Logger().logLocal(
            PREFIX,
            `Checking auction ${auction.itemName}: endTime=${auctionEndTime}, now=${now}, isAfter=${auctionEndTime ? isAfter(now, auctionEndTime) : 'N/A'}, finalized=${auction.finalized}, cancelled=${auction.cancelled}, status=${auction.auctionStatus}, hasBids=${auction.bidCount > 0}, data=${JSON.stringify(auction.data)}`
          );

          // Cleanup: If auction is already finalized but still in active collection, archive it
          if (auction.finalized || auction.auctionStatus === "finalized") {
            new Logger().logLocal(
              PREFIX,
              `Found finalized auction ${auction.itemName} still in active collection, archiving it`
            );
            
            try {
              // Check if auction has bids to determine archive reason
              if (auction.bids && auction.bids.length > 0) {
                // Find the highest bidder for archive data
                const highestBid = Math.max(...auction.bids.map(bid => bid.bid));
                const winnerBid = auction.bids.find(bid => bid.bid === highestBid);
                
                const winnerInfo = winnerBid ? {
                  userId: winnerBid.userId,
                  bidAmount: winnerBid.bid,
                  winnerName: `User ${winnerBid.userId}` // We don't have access to member info here
                } : null;
                
                await archiveAuction(auction, 'finalized_cleanup', winnerInfo);
              } else {
                await archiveAuction(auction, 'finalized_no_bids_cleanup');
              }
              
              // Double-check: Delete from auctions collection if it still exists
              try {
                await db.collection("auctions").doc(auction.id).delete();
                new Logger().logLocal(PREFIX, `Deleted auction ${auction.itemName} from active collection`);
              } catch (deleteError) {
                new Logger().logLocal(PREFIX, `Error deleting auction ${auction.itemName} from active collection: ${deleteError.message}`);
              }
              
              new Logger().logLocal(
                PREFIX,
                `Successfully archived finalized auction ${auction.itemName}`
              );
              
              // Skip processing this auction further
              continue;
            } catch (error) {
              new Logger().logLocal(
                PREFIX,
                `Error archiving finalized auction ${auction.itemName}: ${error.message}`
              );
            }
          }

          // If auction has expired and is not already finalized/cancelled, update it
          if (auctionEndTime && isAfter(now, auctionEndTime) && 
              !auction.finalized && !auction.cancelled && 
              auction.auctionStatus !== "finalized") {
            
            new Logger().logLocal(
              PREFIX,
              `Auction ${auction.itemName} has expired, updating status to finalized`
            );
            
            // Update auction status to finalized
            const auctionDTO = {
              ...auction,
              auctionStatus: "finalized",
              finalized: true,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            
            try {
              await api.updateAuctionConfig(auction.data.messageId, auctionDTO);
              // Update the auction object with the new status
              auction.auctionStatus = "finalized";
              auction.finalized = true;
              // Add a flag to indicate this was programmatically finalized
              auction._programmaticallyFinalized = true;
              
              // Update the status tracking to reflect the change
              const auctionKey = `${auction.data.channelId}-${auction.data.messageId}`;
              lastKnownStatus.set(auctionKey, {
                auctionStatus: auction.auctionStatus,
                finalized: auction.finalized,
                cancelled: auction.cancelled,
                _programmaticallyFinalized: auction._programmaticallyFinalized,
                // Track bidder information
                bidCount: auction.bidCount || 0,
                highestBidder: auction.highestBidder || null,
                highestBid: auction.highestBid || 0,
                currentBid: auction.currentBid || 0,
                startingBid: auction.startingBid || 0
              });
              
              new Logger().logLocal(
                PREFIX,
                `Auction ${auction.itemName} status updated to finalized`
              );

              // Immediately update the Discord embed to reflect the finalized status
              try {
                const channel = discordBot.channels.cache.get(auction.data.channelId);
                if (channel) {
                  const message = await channel.messages.fetch(auction.data.messageId);
                  if (message) {
                    // Use the existing updateAuction function to update the embed
                    // Pass the complete auction object with updated status
                    const updatedAuction = { ...auction, ...auctionDTO };
                    await api.updateAuction({ _message: message, auction: updatedAuction });
                    new Logger().logLocal(
                      PREFIX,
                      `Auction ${auction.itemName} embed updated to finalized status`
                    );
                  }
                }
              } catch (embedError) {
                new Logger().logLocal(
                  PREFIX,
                  `Failed to update embed for auction ${auction.itemName}: ${embedError.message}`
                );
              }

              // Process auction winner - send messages and deduct DKP
              try {
                const channel = discordBot.channels.cache.get(auction.data.channelId);
                if (channel) {
                  const message = await channel.messages.fetch(auction.data.messageId);
                  if (message) {
                    // Check if auction has any bids
                    if (auction.bids && auction.bids.length > 0) {
                      await processAuctionWinner(auction, message, discordBot);
                      new Logger().logLocal(
                        PREFIX,
                        `Processed winner for auction ${auction.itemName}`
                      );
                    } else {
                      // No bids - archive as expired with no winner
                      await archiveAuction(auction, 'expired_no_winner');
                      new Logger().logLocal(
                        PREFIX,
                        `Archived auction ${auction.itemName} with no winner`
                      );
                    }
                  }
                }
              } catch (winnerError) {
                new Logger().logLocal(
                  PREFIX,
                  `Failed to process winner for auction ${auction.itemName}: ${winnerError.message}`
                );
              }
            } catch (updateError) {
              new Logger().logLocal(
                PREFIX,
                `Failed to update auction ${auction.itemName} status: ${updateError.message}`
              );
            }
          }
          
          // Try to grab the channel by channel Id
          try {
            let channel = await discordBot.channels.fetch(
              auction.data.channelId
            );
            let message = await channel.messages.fetch(auction.data.messageId);

            if (channel && message) {
              // Check if auction status has changed to avoid unnecessary API calls
              const auctionKey = `${auction.data.channelId}-${auction.data.messageId}`;
              const lastStatus = lastKnownStatus.get(auctionKey);
              const currentStatus = {
                auctionStatus: auction.auctionStatus,
                finalized: auction.finalized,
                cancelled: auction.cancelled,
                _programmaticallyFinalized: auction._programmaticallyFinalized,
                // Track bidder information
                bidCount: auction.bidCount || 0,
                highestBidder: auction.highestBidder || null,
                highestBid: auction.highestBid || 0,
                // Track other relevant data that affects the embed
                currentBid: auction.currentBid || 0,
                startingBid: auction.startingBid || 0
              };
              
              // Only update embed if status has changed
              if (!lastStatus || 
                  lastStatus.auctionStatus !== currentStatus.auctionStatus ||
                  lastStatus.finalized !== currentStatus.finalized ||
                  lastStatus.cancelled !== currentStatus.cancelled ||
                  lastStatus._programmaticallyFinalized !== currentStatus._programmaticallyFinalized ||
                  lastStatus.bidCount !== currentStatus.bidCount ||
                  lastStatus.highestBidder !== currentStatus.highestBidder ||
                  lastStatus.highestBid !== currentStatus.highestBid ||
                  lastStatus.currentBid !== currentStatus.currentBid ||
                  lastStatus.startingBid !== currentStatus.startingBid) {
                
                // Log what changed for better debugging
                const changes = [];
                if (lastStatus) {
                  if (lastStatus.auctionStatus !== currentStatus.auctionStatus) changes.push(`status: ${lastStatus.auctionStatus} → ${currentStatus.auctionStatus}`);
                  if (lastStatus.bidCount !== currentStatus.bidCount) changes.push(`bids: ${lastStatus.bidCount} → ${currentStatus.bidCount}`);
                  if (lastStatus.highestBidder !== currentStatus.highestBidder) changes.push(`highest bidder: ${lastStatus.highestBidder} → ${currentStatus.highestBidder}`);
                  if (lastStatus.highestBid !== currentStatus.highestBid) changes.push(`highest bid: ${lastStatus.highestBid} → ${currentStatus.highestBid}`);
                  if (lastStatus.finalized !== currentStatus.finalized) changes.push(`finalized: ${lastStatus.finalized} → ${currentStatus.finalized}`);
                }
                
                new Logger().logLocal(
                  PREFIX,
                  `Updating embed for auction ${auction.itemName} - ${changes.length > 0 ? changes.join(', ') : 'initial update'}`
                );
                await api.updateAuction({ _message: message, auction });
                
                // Update the last known status
                lastKnownStatus.set(auctionKey, currentStatus);
              } else {
                /*new Logger().logLocal(
                  PREFIX,
                  `Skipping embed update for auction ${auction.itemName} - status unchanged (${auction.auctionStatus})`
                );*/
              }

              // Auction thread - handle thread locking immediately after auction update
              if (auction.data?.threadId) {
                await discordBot.channels
                  .fetch(auction.data?.threadId)
                  .then(async (thread) => {
                    // Update the auctionsMap with the current auction object
                    auctionsMap.set(auction.data?.threadId, auction);

                    const listener = async (interaction) => {
                      const { commandName } = interaction;

                      // Avoid this command to be used in threads
                      if (
                        commandName === "bid" &&
                        interaction?.channel?.type === 0
                      ) {
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
                        await api.processBid(interaction, auction);
                      }
                    };
                    
                    // Use the current auction object, not the one from auctionsMap
                    new Logger().logLocal(
                      PREFIX,
                      `Processing auction ${auction?.itemName} with status: ${auction?.auctionStatus} (finalized: ${auction?.finalized}, cancelled: ${auction?.cancelled}, programmatically finalized: ${auction?._programmaticallyFinalized})`
                    );
                    
                    if (
                      auction?.auctionStatus === "scheduled" ||
                      auction?.auctionStatus === "started"
                    ) {
                      threadListeners.set(thread.id, listener);
                      thread.client.on("interactionCreate", listener);
                      new Logger().logLocal(
                        PREFIX,
                        `Auction ${auction?.itemName} is active, listener added for thread ${thread.name}`
                      );
                    } else {
                      // Remove listener for finalized, cancelled, or other non-active auctions
                      const listener = threadListeners.get(thread.id);
                      if (listener) {
                        discordBot.removeListener(
                          "interactionCreate",
                          listener
                        );
                        threadListeners.delete(thread.id);
                        new Logger().logLocal(
                          PREFIX,
                          `Listener removed for thread ${thread.name}`
                        );
                      }
                      
                      // Lock the thread if auction is finalized or cancelled
                      const shouldLock = auction?.auctionStatus === "finalized" || auction?.finalized || auction?.cancelled;
                      new Logger().logLocal(
                        PREFIX,
                        `Thread locking check for ${auction?.itemName}: shouldLock=${shouldLock}, status=${auction?.auctionStatus}, finalized=${auction?.finalized}, cancelled=${auction?.cancelled}`
                      );
                      
                      if (shouldLock) {
                        try {
                          
                          // Check if bot has permission to manage threads
                          const permissionCheck = canManageThreads(thread.guild);
                          
                          if (!permissionCheck.hasPermissions) {
                            new Logger().logLocal(
                              PREFIX,
                              `Bot lacks thread management permissions for thread ${thread.name}: ${permissionCheck.message}`
                            );
                            
                            // Send helpful message to the channel about missing permissions
                            try {
                              await thread.send({
                                content: getPermissionUpdateInstructions(permissionCheck.missingPermissions),
                                ephemeral: false
                              });
                            } catch (sendError) {
                              new Logger().logLocal(
                                PREFIX,
                                `Failed to send permission update message: ${sendError.message}`
                              );
                            }
                            return;
                          }
                          
                          // If thread is archived, unarchive it first
                          if (thread.archived) {
                            await thread.setArchived(false);
                            new Logger().logLocal(
                              PREFIX,
                              `Unarchived thread ${thread.name} before locking`
                            );
                          }
                          
                          await thread.setLocked(true);
                           new Logger().logLocal(
                              PREFIX,
                              `Thread locked for ${auction?.auctionStatus} auction: ${auction?.itemName}`
                           );
                        } catch (lockError) {
                          new Logger().logLocal(
                            PREFIX,
                            `Failed to lock thread ${thread.name}: ${lockError.message}`
                          );
                        }
                      } else {
                        new Logger().logLocal(
                          PREFIX,
                          `Thread NOT locked for ${auction?.itemName} - conditions not met`
                        );
                      }
                      
                       new Logger().logLocal(
                          PREFIX,
                          `Auction ${auction?.itemName} status: ${auction?.auctionStatus} - thread management completed`
                       );
                    }
                  })
                  .catch(() => {
                    new Logger().logLocal(
                      PREFIX,
                      `Error fetching thread ${auction.data?.threadId}`
                    );
                  });
              } else {
                // Aqui é quando n criou o thread ID ainda, e vai iniciar o leilão sozinho
                const startingTimeParsed =
                  auction.startingAt instanceof admin.firestore.Timestamp
                    ? auction.startingAt.toDate() // Convert Timestamp to Date
                    : new Date();

                if (
                  (auction?.auctionStatus === "started" ||
                    auction?.auctionStatus === "scheduled") &&
                  isAfter(new Date(), startingTimeParsed) &&
                  !auction.finalized &&
                  !auction.cancelled
                ) {
                  // create the thread only if it doesn't exist
                  await message
                    .startThread({
                      name: `Auction: ${auction?.itemName}'s bids`,
                      reason: "All bids are going to be here!",
                    })
                    .then(async (thread) => {
                      // set the thread permissions
                       try {
                    await thread.permissionOverwrites.edit(
                      thread.guild.roles.everyone,
                      {
                        SendMessages: false,
                        AttachFiles: false,
                      }
                    );
                    await thread.permissionOverwrites.edit(thread.client.user, {
                      SendMessages: true,
                    });
                    new Logger().logLocal(
                      PREFIX,
                      `Thread permissions updated for auction: ${auction?.itemName}`
                    );
                  } catch (err) {
                    new Logger().logLocal(
                      PREFIX,
                      `Error setting thread permissions for auction ${auction?.itemName}: ${err.message}`
                    );
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
                      }

                      // set the auction thread id on the map
                      auctionsMap.set(thread.id, {
                        ...auction,
                        data: {
                          ...auction.data,
                          threadId: thread.id,
                          messageId: message?.id,
                        },
                      });

                      // set the listener for the thread
                      const listerner = async (interaction) => {
                        const { commandName } = interaction;

                        if (
                          commandName === "bid" &&
                          interaction?.channel?.type === 0
                        ) {
                          try {
                            await interaction.reply({
                              content:
                                "**This command only works on an auction thread**\n\nFor example: Click on '**View topic**' on threads with the prefix **Auction**: <item name>'s bids\n\nThere you should be able to bid if the auction is running!",
                              ephemeral: true,
                            });
                          } catch (e) {
                            new Logger().logLocal(
                              PREFIX + "/Auctions",
                              "Error replying to interaction: bid"
                            );
                          }
                          return;
                        }

                        const theAuction = auctionsMap.get(
                          interaction.channel.id
                        );
                        if (theAuction) {
                          await api.processBid(interaction, theAuction);
                        }
                      };

                      threadListeners.set(thread.id, listerner);
                      thread.client.on("interactionCreate", listerner);

                      let embed, components;
                      try {
                        const { prefix, status, modal } =
                          api.statusParser("started");

                        const formattedStartingNew =
                          convertDateObjectToDateString(new Date());

                        const formattedMaxTime = convertDateObjectToDateString(
                          auction.auctionMaxTime
                        );

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
                          updatedAt:
                            admin.firestore.FieldValue.serverTimestamp(),
                          data: {
                            ...auction.data,
                            threadId: thread.id,
                          },
                        };

                        try {
                          await api.updateAuctionConfig(
                            auction?.data?.messageId,
                            auctionDTO
                          );
                        } catch (error) {
                          new Logger().error(
                            PREFIX,
                            "An error occurred while updating the auction."
                          );
                          return;
                        }
                      } catch (error) {
                        console.error(
                          "Error in createOrModifyAuctionEmbed:",
                          error
                        );
                        new Logger().logLocal(
                          PREFIX + "/Auctions",
                          "Error in createOrModifyAuctionEmbed"
                        );
                        return;
                      }

                      try {
                        await message.edit({
                          embeds: [embed],
                          components: components ? components : [],
                        });
                      } catch (error) {
                        new Logger().error(
                          PREFIX + "/Auctions",
                          `An error occurred while editing the message: ${error}`
                        );
                      }
                    })
                    .catch(() => {
                      new Logger().logLocal(
                        PREFIX + "/Auctions",
                        "Error starting the thread"
                      );
                    });
                }
              }
            }
          } catch (e) {
            /*new Logger().logLocal(
              PREFIX + "/Auctions",
              `Error loading auction ${auction.id} (deleted?)`,
              e
            );*/
          }
        }
      } catch (err) {
        new Logger().logLocal(PREFIX, `Error loading auctions`, e);
      }

      new Logger().log(
        PREFIX + "/Auctions",
        `Updated ${auctionsMap.size} auctions ${new Date()}`
      );
    },
    {
      scheduled: true,
      timezone: "America/Sao_Paulo",
    }
  );
  return auctionsTask;
};

/**
 * Schedules a cron job to clean up expired challenges.
 * The job runs every 5 minutes in dev mode and every 10 minutes in production.
 * It removes challenges that have been pending for more than 5 minutes.
 */
const cleanupExpiredChallengesCron = async () => {
  const cleanupTask = cron.schedule(
    process.env.ENV === "dev" ? "*/5 * * * *" : "*/10 * * * *",
    async () => {
      try {
        const cleanedCount = await cleanupExpiredChallenges();
        if (cleanedCount > 0) {
          new Logger().log(
            PREFIX,
            `Cleaned up ${cleanedCount} expired challenges at ${new Date()}`
          );
        }
      } catch (error) {
        new Logger().error(PREFIX, `Error cleaning up expired challenges:`, error);
      }
    },
    {
      scheduled: true,
      timezone: "America/Sao_Paulo",
    }
  );

  return cleanupTask;
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
  const tasks = [
    await decay(),
    await deleteExpiredCodes(),
    await updateAuctions(),
    await cleanupExpiredChallengesCron(),
  ];
  tasks.forEach((task) => task.start());
  new Logger().log(
    PREFIX,
    `Instance started at ${new Date()} at America/Sao_Paulo timezone`
  );
}
