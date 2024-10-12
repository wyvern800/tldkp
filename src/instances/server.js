import express from "express";

export const createServer = () => {
  const app = express();
  const port = process.env.PORT || 3000;

  // Basic HTTP server
  app.get("/", (req, res) => {
    res.send("Bot is running!");
  });

  app.listen(port, () => {
    console.log(`[Express] HTTP Server running on port ${port}`);
  });
};
