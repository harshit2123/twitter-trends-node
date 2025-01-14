const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const { MongoClient } = require("mongodb");
const { v4: uuidv4 } = require("uuid");
const config = require("./config");

class TwitterTrendsScraper {
  constructor() {
    this.mongoClient = null;
    this.collection = null;
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
      await usernameInput.sendKeys(config.twitter.username);

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
      await passwordInput.sendKeys(config.twitter.password);

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

  async getTrends() {
    let driver;
    try {
      if (!this.mongoClient) {
        await this.connect();
      }
      driver = await this.setupDriver();
      await this.loginX(driver);
      console.log("Navigating to Explore page...");

    
      await driver.sleep(3000);

    
      const exploreLink = await driver.wait(
        until.elementLocated(By.css('a[href="/explore"]')),
        10000
      );
      await exploreLink.click();
      await driver.sleep(3000);
      try {
        const trendingTab = await driver.wait(
          until.elementLocated(By.xpath('//span[text()="Trending"]')),
          10000
        );
        await trendingTab.click();
        await driver.sleep(2000);
      } catch (error) {
        console.log("Already in Trending section or tab not found");
      }

      console.log("Getting trends from Explore page...");

      // Get all trend cells
      const trendCells = await driver.wait(
        until.elementsLocated(By.css('[data-testid="trend"]')),
        10000
      );

      const trendTexts = [];


      for (const cell of trendCells.slice(0, 5)) {
        const cellText = await cell.getText();
        const lines = cellText.split("\n");

       
        let trendTopic = "";
        for (let i = 0; i < lines.length; i++) {
          if (
            !lines[i].match(/^\d+$/) &&
            !lines[i].includes("Trending") &&
            !lines[i].includes("Events") &&
            !lines[i].includes("posts") &&
            !lines[i].includes("·") &&
            lines[i].trim() !== ""
          ) {
            trendTopic = lines[i].trim();
            break;
          }
        }

        if (trendTopic) {
          trendTexts.push(trendTopic);
        }
      }

      // Ensure we have exactly 5 trends
      while (trendTexts.length < 5) {
        trendTexts.push("No trend available");
      }

      // Store in MongoDB
      const record = {
        _id: uuidv4(),
        nameoftrend1: trendTexts[0] || "No trend available",
        nameoftrend2: trendTexts[1] || "No trend available",
        nameoftrend3: trendTexts[2] || "No trend available",
        nameoftrend4: trendTexts[3] || "No trend available",
        nameoftrend5: trendTexts[4] || "No trend available",
        timestamp: new Date(),
        ip_address: "127.0.0.1",
      };

      console.log("Extracted trends:", trendTexts);
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
