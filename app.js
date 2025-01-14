// app.js
const express = require("express");
const path = require("path");
const TwitterTrendsScraper = require("./scraper");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/scrape", async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const scraper = new TwitterTrendsScraper();
    // Override config credentials with those from the request
    scraper.credentials = { username, password };
    const result = await scraper.getTrends();
    await scraper.disconnect();
    res.json(result);
  } catch (error) {
    console.error("Error handling scrape request:", error);
    res.status(500).json({ error: error.message });
  }
});

process.on("SIGINT", async () => {
  process.exit();
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
