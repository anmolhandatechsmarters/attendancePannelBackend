require("dotenv").config();

module.exports = {
  development: {
    username: process.env.DATABASE_USER || "root",
    password: process.env.DATABASE_PASS || "",
    database: process.env.DATABASE || "testdb",
    host: process.env.DATABASE_HOST || "127.0.0.1",
    dialect: "mysql",
    port: 3306,
  },
};
