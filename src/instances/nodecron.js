import cron from "node-cron";
import * as api from "../../database/repository.js";
import { add, isEqual, isAfter } from "date-fns";
import admin from "firebase-admin";
import { Logger } from "../../utils/logger.js";
import { config } from "dotenv";
import { main as itemGrabber } from "../../database/itemsGrabber.js";
import { client as discordBot } from "../../src/index.js";
import { db } from "../../database/firebase.js";
import {
  createOrModifyAuctionEmbed,
  convertDateObjectToDateString,
} from "../../utils/index.js";

config();

const PREFIX = "Cron";

const auctionsMap = api.auctionsMap;
const threadListeners = api.threadListeners;

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
    process.env.ENV === "dev" ? "*/10 * * * * *" : "0 1 * * *",
    async () => {
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
        // Loop the auctions
        for (const auction of auctions) {
          // Try to grab the channel by channel Id
          try {
            let channel = await discordBot.channels.fetch(
              auction.data.channelId
            );
            let message = await channel.messages.fetch(auction.data.messageId);

            if (channel && message) {
              await api.updateAuction({ _message: message, auction });

              // Auction thread
              if (auction.data?.threadId) {
                await discordBot.channels
                  .fetch(auction.data?.threadId)
                  .then(async (thread) => {
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
                    // set the listener for the thread only if there is an started auction
                    const auction = auctionsMap.get(interaction.channel.id);
                    
                    if (
                      auction?.auctionStatus === "scheduled" ||
                      auction?.auctionStatus === "started"
                    ) {
                      threadListeners.set(thread.id, listener);
                      thread.client.on("interactionCreate", listener);
                    } else {
                      const listener = threadListeners.get(thread.id);
                      if (listener) {
                        discordBot.removeListener(
                          "interactionCreate",
                          listener
                        );
                        threadListeners.delete(thread.id);
                        console.log('tacaindo aq?')
                        new Logger().logLocal(
                          PREFIX,
                          `Listener removed for thread ${thread.name}`
                        );
                      }
                      await thread.setLocked(true);
                      new Logger().logLocal(
                        "Auctions",
                        `This auction for ${auction?.itemName} is not running anymore, so no listener is needed`
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
                      /*try {
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
                  } catch (err) {
                    console.log(err);
                    new Logger().logLocal(
                      PREFIX,
                      "An error occurred while setting the thread permissions."
                    );
                    await i.reply({
                      content:
                        "An error occurred while setting the thread permissions.",
                      ephemeral: true,
                    });
                  }*/

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
  ];
  tasks.forEach((task) => task.start());
  new Logger().log(
    PREFIX,
    `Instance started at ${new Date()} at America/Sao_Paulo timezone`
  );
}
