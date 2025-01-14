const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const { MongoClient } = require("mongodb");
const { v4: uuidv4 } = require("uuid");
const config = require("./config");

class TwitterTrendsScraper {
  constructor() {
    this.mongoClient = null;
    this.collection = null;
    this.credentials = null;
  }

  setCredentials(username, password) {
    this.credentials = { username, password };
  }

  async connect() {
    this.mongoClient = new MongoClient(config.mongodb.uri);
    await this.mongoClient.connect();
    const db = this.mongoClient.db(config.mongodb.dbName);
    this.collection = db.collection(config.mongodb.collection);
  }

  async disconnect() {
    if (this.mongoClient) {
      await this.mongoClient.close();
    }
  }

  async setupDriver() {
    const options = new chrome.Options();
    options.addArguments("--start-maximized");
    options.addArguments("--disable-gpu");
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");
    options.addArguments("--disable-blink-features=AutomationControlled");
    options.addArguments("--disable-extensions");
    options.addArguments("--disable-notifications");
    options.addArguments(
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    return new Builder().forBrowser("chrome").setChromeOptions(options).build();
  }

  async loginX(driver) {
    if (!this.credentials) {
      throw new Error(
        "No credentials provided. Please set credentials before logging in."
      );
    }

    try {
      console.log("Navigating to login page...");
      await driver.get("https://twitter.com/login");
      await driver.sleep(3000);

      console.log("Entering username...");
      const usernameInput = await driver.wait(
        until.elementLocated(By.css('input[autocomplete="username"]')),
        10000
      );
      await usernameInput.clear();
      await usernameInput.sendKeys(this.credentials.username);

      const nextButton = await driver.wait(
        until.elementLocated(By.xpath('//span[text()="Next"]')),
        10000
      );
      await nextButton.click();
      await driver.sleep(2000);

      console.log("Entering password...");
      const passwordInput = await driver.wait(
        until.elementLocated(By.css('input[type="password"]')),
        10000
      );
      await passwordInput.clear();
      await passwordInput.sendKeys(this.credentials.password);

      const loginButton = await driver.wait(
        until.elementLocated(By.xpath('//span[text()="Log in"]')),
        10000
      );
      await loginButton.click();
      await driver.sleep(5000);

      try {
        await driver.wait(
          until.elementLocated(By.css('[data-testid="primaryColumn"]')),
          10000
        );
        console.log("Login successful!");
      } catch (error) {
        console.error("Login failed:", error);
        throw new Error("Failed to login to Twitter");
      }
    } catch (error) {
      console.error("Error during login:", error);
      throw error;
    }
  }

//   async navigateToExplore(driver) {
//     try {
//       console.log("Navigating to Explore section...");
//       const exploreLink = await driver.wait(
//         until.elementLocated(By.css('a[href="/explore"]')),
//         10000
//       );
//       await exploreLink.click();
//       await driver.sleep(3000);
//       console.log("Navigated to Explore section successfully");
//     } catch (error) {
//       console.error("Error navigating to Explore section:", error);
//       throw error;
//     }
//   }

//   async navigateToTrending(driver) {
//     try {
//       console.log("Navigating to Trending section...");
//       const trendingTab = await driver.wait(
//         until.elementLocated(
//           By.xpath('//a[contains(@href, "/explore/tabs/trending")]')
//         ),
//         10000
//       );
//       await trendingTab.click();
//       await driver.sleep(3000);
//       console.log("Navigated to Trending section successfully");
//     } catch (error) {
//       console.error("Error navigating to Trending section:", error);
//       throw error;
//     }
//   }

//   async clickShowMore(driver) {
//     try {
//       console.log("Looking for Show more button...");
//       const showMoreButton = await driver.wait(
//         until.elementLocated(By.xpath('//span[text()="Show more"]')),
//         10000
//       );
//       console.log("Found Show more button, clicking...");
//       await showMoreButton.click();
//       await driver.sleep(2000); // Wait for new trends to load
//       console.log("Show more clicked successfully");
//     } catch (error) {
//       console.error("Error clicking Show more:", error);
//       throw error;
//     }
//   }

  async getTrends() {
    let driver;
    try {
      if (!this.credentials) {
        throw new Error(
          "No credentials provided. Please set credentials before getting trends."
        );
      }

      if (!this.mongoClient) {
        await this.connect();
      }

      driver = await this.setupDriver();
      await this.loginX(driver);

      // Wait for the "What's happening" section to load
      console.log("Waiting for trends to load...");
      await driver.sleep(3000);

      // Get trends from "What's happening" section
      const trendCells = await driver.wait(
        until.elementsLocated(By.css('[data-testid="trend"]')),
        10000
      );

      const trendTexts = [];
      let trendsProcessed = 0;

      // Process each trend cell to get the actual trending topic
      for (const cell of trendCells) {
        if (trendsProcessed >= 4) break; // Stop after getting 4 trends

        const cellText = await cell.getText();
        console.log("Raw trend cell text:", cellText);

        // Split the text into lines and process
        const lines = cellText.split("\n");

        // Find the actual trend name (text between ** markers)
        let trendTopic = null;

        for (const line of lines) {
          if (line.startsWith("**") && line.endsWith("**")) {
            trendTopic = line.replace(/\*\*/g, "").trim();
            break;
          }
        }

        // If no ** markers found, use the first non-metadata line
        if (!trendTopic) {
          for (const line of lines) {
            if (
              !line.match(/^\d+$/) && // not a number
              line !== "·" &&
              !line.includes("posts") &&
              !line.includes("Trending") &&
              !line.includes("Entertainment") &&
              !line.includes("Politics") &&
              !line.includes("Sports") &&
              line.trim() !== ""
            ) {
              trendTopic = line.trim();
              break;
            }
          }
        }

        if (trendTopic && !trendTexts.includes(trendTopic)) {
          console.log("Found trend:", trendTopic);
          trendTexts.push(trendTopic);
          trendsProcessed++;
        }
      }

      console.log("All extracted trends:", trendTexts);

      // Store in MongoDB
      const record = {
        _id: uuidv4(),
        nameoftrend1: trendTexts[0] || "No trend available",
        nameoftrend2: trendTexts[1] || "No trend available",
        nameoftrend3: trendTexts[2] || "No trend available",
        nameoftrend4: trendTexts[3] || "No trend available",
        timestamp: new Date(),
        ip_address: "127.0.0.1",
      };

      console.log("Final record:", record);
      await this.collection.insertOne(record);
      return record;
    } catch (error) {
      console.error("Error scraping trends:", error);
      throw error;
    } finally {
      if (driver) {
        await driver.quit();
      }
    }
  }
}

module.exports = TwitterTrendsScraper;
