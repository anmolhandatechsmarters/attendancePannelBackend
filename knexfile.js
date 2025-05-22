require("dotenv").config();

module.exports = {
  development: {
    client: "mysql2",
    connection: {
      host:
        process.env.DB_HOST ||
        "bzmgwmkemfb8fxh7d35k-mysql.services.clever-cloud.com",
      user: process.env.DB_USER || "ukdmygt7iiy1tayu",
      password: process.env.DB_PASS || "SDTGZm5W2XlHGgMNQ9JE",
      database: process.env.DB_NAME || "bzmgwmkemfb8fxh7d35k",
    },

    migrations: {
      directory: "./migrations",
    },
    seeds: {
      directory: "./seeds",
    },
  },
  production: {
    client: "mysql2",
    connection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    },
    migrations: {
      directory: "./migrations",
    },
    seeds: {
      directory: "./seeds",
    },
  },
};
