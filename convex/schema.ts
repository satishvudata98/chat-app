import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    userId: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    pushToken: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    publicKey: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_deviceId", ["deviceId"]),

  chats: defineTable({
    participants: v.array(v.string()),
    participantA: v.optional(v.string()),
    participantB: v.optional(v.string()),
    pairKey: v.optional(v.string()),
    lastMessageId: v.optional(v.id("messages")),
    updatedAt: v.number(),
    lastReadAt: v.optional(v.record(v.string(), v.number())),
    unreadCounts: v.optional(v.record(v.string(), v.number())),
    pendingNotifJobId: v.optional(v.id("_scheduled_functions")),
  })
    .index("by_participantA_and_updatedAt", ["participantA", "updatedAt"])
    .index("by_participantB_and_updatedAt", ["participantB", "updatedAt"])
    .index("by_pairKey", ["pairKey"]),

  chatArchives: defineTable({
    userId: v.string(),
    chatId: v.id("chats"),
    archivedAt: v.number(),
  }).index("by_userId_and_chatId", ["userId", "chatId"]),

  messages: defineTable({
    chatId: v.id("chats"),
    senderId: v.string(),
    type: v.union(v.literal("text"), v.literal("image"), v.literal("call")),
    content: v.string(),
    fileId: v.optional(v.id("_storage")),
    isDeleted: v.optional(v.boolean()),
    isRead: v.boolean(),
    isEncrypted: v.optional(v.boolean()),
    isEdited: v.optional(v.boolean()),
    editedAt: v.optional(v.number()),
    isDeleted: v.optional(v.boolean()),
    replyToId: v.optional(v.id("messages")),
    callId: v.optional(v.id("calls")),
    callMode: v.optional(v.union(v.literal("audio"), v.literal("video"))),
    callStatus: v.optional(v.union(
      v.literal("ringing"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("ended"),
      v.literal("missed"),
      v.literal("failed"),
    )),
  }).index("by_chatId", ["chatId"]),

  calls: defineTable({
    chatId: v.id("chats"),
    callerId: v.string(),
    calleeId: v.string(),
    participants: v.array(v.string()),
    mode: v.union(v.literal("audio"), v.literal("video")),
    status: v.union(
      v.literal("ringing"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("ended"),
      v.literal("missed"),
      v.literal("failed"),
    ),
    startedAt: v.number(),
    acceptedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    endedBy: v.optional(v.string()),
    callMessageId: v.optional(v.id("messages")),
  })
    .index("by_chatId_and_startedAt", ["chatId", "startedAt"])
    .index("by_calleeId_and_status", ["calleeId", "status"])
    .index("by_callerId_and_status", ["callerId", "status"]),

  callSignals: defineTable({
    callId: v.id("calls"),
    senderId: v.string(),
    type: v.union(
      v.literal("offer"),
      v.literal("answer"),
      v.literal("ice-candidate"),
    ),
    payload: v.string(),
    expiresAt: v.number(),
  })
    .index("by_callId", ["callId"])
    .index("by_expiresAt", ["expiresAt"]),

  typing: defineTable({
    chatId: v.id("chats"),
    userId: v.string(),
    updatedAt: v.number(),
  })
    .index("by_chatId", ["chatId"])
    .index("by_chatId_and_userId", ["chatId", "userId"]),

  appConfig: defineTable({
    key: v.string(),
    latestVersion: v.string(),
    minimumVersion: v.string(),
    apkUrl: v.string(),
    message: v.optional(v.string()),
  }).index("by_key", ["key"]),
});
