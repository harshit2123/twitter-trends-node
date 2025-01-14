// config.js
require("dotenv").config();

module.exports = {
  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017",
    dbName: process.env.DB_NAME || "twitter_trends",
    collection: process.env.COLLECTION_NAME || "trends",
  },
  proxy: {
    host: process.env.PROXYMESH_HOST,
    port: process.env.PROXYMESH_PORT,
    username: process.env.PROXYMESH_USERNAME,
    password: process.env.PROXYMESH_PASSWORD,
  },
  twitter: {
    username: process.env.TWITTER_LOGIN,
    password: process.env.TWITTER_PASSWORD,
  },
};
