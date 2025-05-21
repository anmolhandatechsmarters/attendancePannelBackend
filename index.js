const https = require("https");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { sequelize } = require("./Connection");
const UserRouter = require("./route/auth");
const AdminRouter = require("./route/admin");
const EmployeeRouter = require("./route/employeeroute");
const initializeDatabase = require("./initializeDatabase");
const HrRoute = require("./route/Hrroute.js");
const Hremp = require("./route/hremp.js");
const jwt = require("jsonwebtoken");
const app = express();
const PORT = process.env.PORT || 3306;
const uploadDir = path.join(__dirname, "uploads");
const MessageDir = path.join(__dirname, "messageImage");
const MessageRoute = require("./route/message.js");
const InventoryRoute = require("./route/inventory.js");
const InventoryDir = path.join(__dirname, "Images", "Inventory_Images");
const GroceryInventoryRoute = require("./route/GroceryRoute/grocery.js");
const NotificationRouter = require("./route/Notification/notification.js");
const PasskeyRouter = require("./route/Passkey/passkey.js");
const cron = require("./cron.js");
const { generateToken, verifyusertoken } = require("./middleware/token.js");
const role = require("./models/role.js");
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadDir));
app.use("/messageImage", express.static(MessageDir));
app.use("/Images/Inventory_Images", express.static(InventoryDir));
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const db = require("./Connection.js");

app.use("/user", UserRouter);
app.use("/admin", AdminRouter);
app.use("/api/employee", EmployeeRouter);
app.use("/api/hr", HrRoute);
app.use("/api/hremp", Hremp);
app.use("/api/message", MessageRoute);
app.use("/api/inventory", InventoryRoute);
app.use("/api/grocery", GroceryInventoryRoute);
app.use("/api/notification", NotificationRouter);
app.use("/api/passkey", PasskeyRouter);
let refreshTokens = [];

app.get("/api/token", async (req, res) => {
  const refreshToken = req.headers.authorization?.split(" ")[1];

  if (!refreshToken) {
    console.log("No refresh token provided");
    return res.status(401).json({ message: "No refresh token provided" });
  }

  try {
    const verifiedToken = verifyusertoken(refreshToken); // Verify the refresh token
    const userId = verifiedToken.id;

    const user = await db.users.findByPk(userId);
    if (!user) {
      console.log("User not found");
      return res.status(404).json({ message: "User not found" });
    }

    // Generate a new access token
    const newAccessToken = generateToken(user.id, user.role);

    // Optionally update the stored token
    await db.users.update({ token: newAccessToken }, { where: { id: userId } });

    // console.log("New Access Token Generated:", newAccessToken); // Log the new token for debugging

    res.status(200).json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error("Error refreshing token:", error);
    return res.status(401).json({ message: "Invalid refresh token" });
  }
});

const webpush = require("web-push");
const vapidKeys = {
  publicKey:
    "BJTPXdC8UyqAknabZbqUfe-ZemGYSOUQ4_2SSk5HAZLxnqr8udc6cvgttNwiiDZp6yoRRvR888VF-hhG7zdSxOM",
  privateKey: "4hG_PmQi07LqYAVRvwSIk83R1KS1zDxbRXVY9CRFBnQ", // Replace with your actual private key
};

webpush.setVapidDetails(
  "mailto:anmolhanda@techsmarters.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

let lastLogTimestamp = null; // This can be a variable in memory or stored in a database

app.post("/subscribe", async (req, res) => {
  const { endpoint, keys } = req.body;

  // Ensure both 'endpoint' and 'keys' are provided
  if (!endpoint || !keys) {
    return res.status(400).json({ message: "Invalid subscription data" });
  }

  try {
    // Fetch the most recent log entry (sorting by 'createdAt' or another timestamp field)
    const log = await db.logs.findOne({
      order: [["id", "DESC"]], // Order by 'createdAt' field in descending order
    });

    if (!log) {
      return res.status(404).json({ message: "No log message found" });
    }

    // Check if the log is new by comparing timestamps
    if (
      lastLogTimestamp &&
      new Date(log.createdAt).getTime() <= lastLogTimestamp
    ) {
      return res.status(200).json({ message: "No new log to notify" });
    }

    // Update the last log timestamp to the new log's timestamp
    lastLogTimestamp = new Date(log.createdAt).getTime();

    // Prepare the notification payload
    const payload = JSON.stringify({
      title: "New Log Created!",
      body: log.api, // Assuming 'message' is a field in your log
      icon: "/logo.png", // Ensure this is a valid path or URL
    });

    // Subscription object
    const subscriptionData = { endpoint, keys };

    // Send the notification
    await webpush.sendNotification(subscriptionData, payload).catch((error) => {
      console.error("Error sending notification:", error);
      return res.status(500).json({ message: "Error sending notification." });
    });

    return res.status(200).json({ message: "Notification sent successfully!" });
  } catch (error) {
    console.error("Error in /subscribe:", error);
    res.status(500).json({ message: "Error processing subscription." });
  }
});

// app.get("/check/tokenexpiry", async (req, res) => {
//   const token = req.headers["authorization"]?.split(" ")[1];

//   if (!token) {
//     return res.status(401).json({ message: "No token provided" });
//   }

//   try {
//     jwt.verify(token, process.env.JWT_SECRET, (err, decodedToken) => {
//       if (err) {
//         return res.status(401).json({ message: "Invalid or expired token" });
//       }

//       const currentTime = Date.now() / 1000;
//       const tokenExpiryTime = decodedToken.exp;
//       const expiryBuffer = 4 * 60 * 60;

//       if (tokenExpiryTime - currentTime <= expiryBuffer) {
//         return res.status(401).json({
//           message: "Token is expired or will expire soon. Please log in again.",
//           expired: true,
//         });
//       }

//       res.status(200).json({ message: "Token is still valid" });
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// });

// app.get("/refreshtoken", async (req, res) => {
//   const token = req.headers["authorization"]?.split(" ")[1];

//   if (!token) {
//     return res.status(401).json({ message: "No token provided" });
//   }

//   try {
//     jwt.verify(token, process.env.JWT_SECRET, async (err, decodedToken) => {
//       if (err) {
//         return res.status(401).json({ message: "Invalid or expired token" });
//       }

//       const currentTime = Date.now() / 1000;
//       const tokenExpiryTime = decodedToken.exp;
//       const expiryBuffer = 4 * 60 * 60;

//       if (tokenExpiryTime - currentTime <= 5 * 60) {
//         const { userId, userRole } = decodedToken;

//         const newToken = jwt.sign(
//           { userId: userId, userRole: userRole },
//           process.env.JWT_SECRET,
//           { expiresIn: "1h" }
//         );

//         await db.users.update(
//           { token: newToken },
//           { where: { userId } }
//         );
//         return res.status(200).json({
//           message: "Token expired or will expire soon. New token generated.",
//           newToken: newToken,
//         });
//       }

//       res.status(200).json({ message: "Token is still valid" });
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// });

// for the https server

// const options = {
//   key: fs.readFileSync(
//     "//etc/letsencrypt/live/attendance.smarterspanel.com/privkey.pem"
//   ),
//   cert: fs.readFileSync(
//     "//etc/letsencrypt/live/attendance.smarterspanel.com/fullchain.pem"
//   ),
// };
// const startServer = async () => {
//   try {
//     await initializeDatabase();
//     app.createServer = https.createServer(options, app);
//     app.createServer.listen(PORT, () => {
//       console.log(`Server running on port ${PORT}`);
//     });
//   } catch (err) {
//     console.error("Unable to start the server:", err);
//     process.exit(1);
//   }
// };

// end this in this server

const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Unable to start the server:", err);
    process.exit(1);
  }
};

startServer();

const gracefulShutdown = async () => {
  try {
    await sequelize.close();
    console.log("Database connection closed.");
    process.exit(0);
  } catch (err) {
    console.error("Error during graceful shutdown:", err);
    process.exit(1);
  }
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
