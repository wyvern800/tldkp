import express from "express";
import path from "path";

export const createServer = () => {
  const app = express();
  const port = process.env.PORT || 3000;

  // Serve static files from the React app build
  const __dirname = path.resolve();
  app.use(express.static(path.join(__dirname, "frontend", "build")));

  // Basic HTTP server
  app.get("/health", (req, res) => {
    res.send("Bot is running!");
  });

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'build', 'index.html'));
  });

  app.listen(port, () => {
    console.log(`[Express] HTTP Server running on port ${port}`);
  });
};
