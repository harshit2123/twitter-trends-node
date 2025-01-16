const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const { MongoClient } = require("mongodb");
require("dotenv").config();

class TwitterTrendsScraper {
  constructor() {
    this.mongoUri = process.env.MONGODB_URI;
    this.dbName = process.env.MONGODB_DATABASE;
    if (!this.mongoUri) {
      throw new Error("MONGODB_URI environment variable is not set");
    }
    if (!this.dbName) {
      throw new Error("MONGODB_DATABASE environment variable is not set");
    }
  }

  setCredentials(username, password) {
    this.username = username;
    this.password = password;
  }

  async connect() {
    try {
      this.client = new MongoClient(this.mongoUri);
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      console.log("Successfully connected to MongoDB");
    } catch (error) {
      console.error("MongoDB connection error:", error);
      throw new Error("Failed to connect to database");
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
    }
  }

  async setupDriver() {
    const options = new chrome.Options();
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");
    options.addArguments("--headless"); // Run in headless mode for Vercel
    options.addArguments("--disable-gpu");
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
    if (!this.username || !this.password) {
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
      await usernameInput.sendKeys(this.username);
      await driver.findElement(By.css('div[role="button"]')).click();
      await driver.sleep(2000);

      console.log("Entering password...");
      const passwordInput = await driver.wait(
        until.elementLocated(By.css('input[name="password"]')),
        10000
      );
      await passwordInput.clear();
      await passwordInput.sendKeys(this.password);
      await driver
        .findElement(By.css('div[data-testid="LoginForm_Login_Button"]'))
        .click();
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
      if (!this.username || !this.password) {
        throw new Error(
          "No credentials provided. Please set credentials before getting trends."
        );
      }

      await this.connect();

      driver = await this.setupDriver();
      await this.loginX(driver);

      // Navigate to Explore/Trends page
      console.log("Navigating to Explore/Trends page...");
      await driver.get("https://twitter.com/explore");
      await driver.sleep(5000);

      // Wait for trends to load
      const trends = await driver.wait(
        until.elementsLocated(By.css('[data-testid="trend"]')),
        15000 // Increased timeout to 15 seconds
      );

      // Extract trend information
      const trendData = [];
      for (let i = 0; i < Math.min(4, trends.length); i++) {
        const trendText = await trends[i].getText();
        trendData.push(trendText);
      }

      // Prepare result object
      const result = {
        timestamp: new Date(),
        ip_address: "127.0.0.1", // Local testing IP
      };

      // Add trends to result
      trendData.forEach((trend, index) => {
        result[`nameoftrend${index + 1}`] = trend;
      });

      // Save to MongoDB
      await this.db.collection("trends").insertOne(result);

      return result;
    } catch (error) {
      console.error("Error scraping trends:", error);
      throw error;
    } finally {
      if (driver) {
        await driver.quit();
      }
      await this.disconnect();
    }
  }
}

module.exports = TwitterTrendsScraper;
