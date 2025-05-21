const admin = require("../Firebase");

class NotificationService {
  static async sendNotification(deviceTokens, title, body) {
    if (!deviceTokens || !Array.isArray(deviceTokens) || deviceTokens.length === 0) {
      console.error("Invalid or empty device tokens provided.");
      return;
    }

    // Loop through all device tokens and send notifications one by one
    for (const deviceToken of deviceTokens) {
      // Validate each device token
      if (!deviceToken || typeof deviceToken !== 'string' || deviceToken.trim() === '') {
        console.error("Invalid device token:", deviceToken);
        continue;  // Skip this token and move to the next one
      }

      const message = {
        token: deviceToken,
        notification: { 
          title, 
          body 
        }, 
        data: {
          click_action: "FLUTTER_NOTIFICATION_CLICK",
          custom_data: "extra information"
        },
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "high_importance_channel", 
          }
        },
        apns: {
          payload: {
            aps: {
              alert: { title, body },
              sound: "default",
              contentAvailable: true
            }
          }
        }
      };

      console.log("Sending Notification to token:", deviceToken);

      try {
        // Send the message through Firebase
        const response = await admin.messaging().send(message);
        console.log("Notification sent successfully to token:", deviceToken, response);
      } catch (error) {
        // Log the full error details to help with debugging
        console.error("Error sending notification to token:", deviceToken, error.code, error.message, error.details);
      }
    }
  }
}

module.exports = NotificationService;
