import { internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const getPushTokensForChat = internalQuery({
  args: { chatId: v.id("chats"), senderId: v.string() },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat) return [];

    const sender = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.senderId))
      .first();

    const recipientIds = chat.participants.filter((id) => id !== args.senderId);
    const recipients = [];

    for (const recipientId of recipientIds) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", recipientId))
        .first();
      
      if (user && user.pushToken) {
        recipients.push({
          pushToken: user.pushToken,
          senderName: sender?.name || "Someone",
        });
      }
    }

    return recipients;
  },
});

export const sendPushNotification = internalAction({
  args: {
    chatId: v.id("chats"),
    senderId: v.string(),
    messageContent: v.string(),
  },
  handler: async (ctx, args) => {
    const { chatId, senderId, messageContent } = args;

    const recipients = await ctx.runQuery(internal.push.getPushTokensForChat, {
      chatId,
      senderId,
    });

    for (const recipient of recipients) {
      if (recipient.pushToken) {
        try {
          const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: recipient.pushToken,
              title: recipient.senderName,
              body: messageContent,
              sound: "default",
              priority: "high",
              channelId: "default",
              data: { chatId },
            }),
          });

          const ticket = await response.json();
          if (!response.ok || ticket.data?.status === "error") {
            console.error("Expo push notification error", ticket);
          }
        } catch (error) {
          console.error("Failed to send push notification", error);
        }
      }
    }
  },
});
