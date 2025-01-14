// app.js
const express = require("express");
const path = require("path");
const TwitterTrendsScraper = require("./scraper");

const app = express();
const port = process.env.PORT || 3000;
const scraper = new TwitterTrendsScraper();

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/scrape", async (req, res) => {
  try {
    const result = await scraper.getTrends();
    res.json(result);
  } catch (error) {
    console.error("Error handling scrape request:", error);
    res.status(500).json({ error: error.message });
  }
});

process.on("SIGINT", async () => {
  await scraper.disconnect();
  process.exit();
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
