const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const TwitterTrendsScraper = require("./scraper");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/scrape", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  const scraper = new TwitterTrendsScraper();
  scraper.setCredentials(username, password);

  try {
    const trends = await scraper.getTrends();
    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await scraper.disconnect();
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
