// controllers/notificationController.js
const db = require("../../Connection");

const SubmitNotification = async (req, res) => {
  try {
    const { id, notify, fcmtoken } = req.body;

    // Basic validation
    if (!id || !fcmtoken) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const notification = await db.Notification.create({
      userId: id,
      allow_notifcation: notify,
      fcm_token: fcmtoken,
    });

    res.json(notification);
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};



const AllowNotification = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { value } = req.body;

  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  const allowNotificationValue = value == 1 ? "1" : "0";
  console.log("Received Value:", value, "Converted:", allowNotificationValue);

  try {
    // Check if the user exists
    const user = await db.Notification.findOne({ where: { userId: id } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    console.log("User Exists:", user.dataValues);

    if (user.allow_notification === allowNotificationValue) {
      console.log("No update needed, value already set.");
      return res.status(200).json({
        message: "No change needed, value is already set.",
        allow_notifcation: user.allow_notification === "1",
      });
    }

    // Update the notification setting
    const [updatedRows] = await db.Notification.update(
      { allow_notifcation: allowNotificationValue },
      { where: { userId: id } }
    );

    console.log("Updated Rows:", updatedRows);

    if (updatedRows === 0) {
      return res.status(400).json({ message: "No changes applied" });
    }

    const updatedUser = await db.Notification.findOne({
      where: { userId: id },
    });

    return res.json({
      message: "Notification setting updated successfully",
      allow_notification: updatedUser.allow_notifcation === "1",
    });
  } catch (error) {
    console.error("Update Error:", error);
    return res
      .status(500)
      .json({ message: "Error updating notification", error: error.message });
  }
};

const GetNotification = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const user = await db.Notification.findOne({ where: { userId: id } });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ allow_notification: user.allow_notifcation === "1" });
  } catch (error) {
    res.status(500).json({ message: "Error fetching data", error: error.message });
  }
};




module.exports = {
  SubmitNotification,
  AllowNotification,
  GetNotification,
};
