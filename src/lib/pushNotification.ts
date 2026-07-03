import axios from "axios";
import logger from "./logger.js";
import { User } from "../models/user.model.js";

export interface PushNotificationData {
  to: string; // Expo push token
  title?: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Sends push notifications directly via Expo's HTTP API.
 * @param notifications An array of PushNotificationData objects
 */
export const sendPushNotifications = async (notifications: PushNotificationData[]) => {
  const messages = notifications
    .filter((push) => {
      // Basic check for an Expo push token format
      const isValidToken =
        push.to &&
        typeof push.to === "string" &&
        (push.to.startsWith("ExponentPushToken[") || push.to.startsWith("ExpoPushToken["));
      
      if (!isValidToken) {
        logger.error(`Push token ${push.to} is not a valid Expo push token format`);
      }
      return isValidToken;
    })
    .map((push) => ({
      to: push.to,
      sound: "default",
      title: push.title,
      body: push.body,
      data: push.data,
    }));

  if (messages.length === 0) {
    return;
  }

  try {
    const response = await axios.post("https://exp.host/--/api/v2/push/send", messages, {
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error: any) {
    logger.error("Error sending push notifications via Expo API: " + error.message);
    throw error;
  }
};

/**
 * Convenience helper to send a push notification to a specific user by their ID.
 * Looks up their expoPushToken automatically.
 */
export const notifyUser = async (
  userId: string | any,
  title: string,
  body: string,
  data?: Record<string, any>
) => {
  try {
    const user = await User.findById(userId).select("expoPushToken");
    if (user && user.expoPushToken) {
      await sendPushNotifications([
        {
          to: user.expoPushToken,
          title,
          body,
          data,
        },
      ]);
    }
  } catch (error) {
    logger.error(`Error in notifyUser for user ${userId}: ` + error);
  }
};

