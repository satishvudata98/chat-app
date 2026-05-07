import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    userId: v.string(), // Local UUID generated on device
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    pushToken: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  chats: defineTable({
    participants: v.array(v.string()), // Array of userIds
    lastMessageId: v.optional(v.id("messages")),
    updatedAt: v.number(),
  }),

  messages: defineTable({
    chatId: v.id("chats"),
    senderId: v.string(), // userId of sender
    type: v.union(v.literal("text"), v.literal("image")),
    content: v.string(), // text content or empty string for image
    fileId: v.optional(v.id("_storage")),
    isRead: v.boolean(),
    isEdited: v.optional(v.boolean()),
    replyToId: v.optional(v.id("messages")),
  }).index("by_chatId", ["chatId"]),
});
