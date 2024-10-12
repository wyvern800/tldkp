import { ShardingManager } from "discord.js";
import { config } from "dotenv";

config();

const manager = new ShardingManager("./src/index.js", {
  token:
    process.env.DISCORD_TOKEN,
  shardCount: "auto",
});

manager.on("shardCreate", (shard) => {
  // Listeing for the ready event on shard.
  shard.on("ready", () => {
    console.log(
      `[ShardManager] Shard ${shard.id} connected to Discord's Gateway.`
    );
    // Sending the data to the shard.
    shard.send({ type: "shardId", data: { shardId: shard.id } });
  });
});

manager.spawn();
