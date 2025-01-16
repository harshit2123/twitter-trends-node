const TwitterTrendsScraper = require("../../scraper");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  try {
    const scraper = new TwitterTrendsScraper();
    const trends = await scraper.getTrends(username, password);
    return res.status(200).json(trends);
  } catch (error) {
    console.error("Error in API handler:", error);
    return res.status(500).json({ error: error.message });
  }
}
