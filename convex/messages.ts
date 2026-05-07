import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const listChats = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Note: In a production app, it's better to store participant lists or a separate ChatMembers table.
    // Here we query all chats where participants array contains our userId
    const chats = await ctx.db.query("chats").collect();
    const myChats = chats.filter(c => c.participants.includes(args.userId));
    
    // Enrich with other user's details and last message
    return await Promise.all(
      myChats.map(async (chat) => {
        const otherUserId = chat.participants.find(id => id !== args.userId) || args.userId;
        const otherUser = await ctx.db.query("users").withIndex("by_userId", q => q.eq("userId", otherUserId)).first();
        
        let lastMessage = null;
        if (chat.lastMessageId) {
          lastMessage = await ctx.db.get(chat.lastMessageId);
        }

        return {
          ...chat,
          otherUser,
          lastMessage,
        };
      })
    );
  },
});

export const getOrCreateChat = mutation({
  args: { myUserId: v.string(), otherUserId: v.string() },
  handler: async (ctx, args) => {
    const chats = await ctx.db.query("chats").collect();
    const existingChat = chats.find(
      c => c.participants.includes(args.myUserId) && c.participants.includes(args.otherUserId)
    );

    if (existingChat) return existingChat._id;

    return await ctx.db.insert("chats", {
      participants: [args.myUserId, args.otherUserId],
      updatedAt: Date.now(),
    });
  },
});

export const getMessages = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .collect();

    return Promise.all(
      messages.map(async (message) => {
        let url = null;
        if (message.fileId) {
          url = await ctx.storage.getUrl(message.fileId);
        }
        
        let repliedMessage = null;
        if (message.replyToId) {
          const rm = await ctx.db.get(message.replyToId);
          if (rm) {
            repliedMessage = {
              _id: rm._id,
              senderId: rm.senderId,
              content: rm.type === "image" ? "📷 Image" : rm.content,
            };
          }
        }

        return {
          ...message,
          url,
          repliedMessage,
        };
      })
    );
  },
});

export const sendMessage = mutation({
  args: {
    chatId: v.id("chats"),
    senderId: v.string(),
    type: v.union(v.literal("text"), v.literal("image")),
    content: v.string(),
    fileId: v.optional(v.id("_storage")),
    replyToId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      chatId: args.chatId,
      senderId: args.senderId,
      type: args.type,
      content: args.content,
      fileId: args.fileId,
      isRead: false,
      replyToId: args.replyToId,
    });

    await ctx.db.patch(args.chatId, {
      lastMessageId: messageId,
      updatedAt: Date.now(),
    });

    // Fire push notification in the background
    await ctx.scheduler.runAfter(0, internal.push.sendPushNotification, {
      chatId: args.chatId,
      senderId: args.senderId,
      messageContent: args.type === "image" ? "📷 Image" : args.content,
    });

    return messageId;
  },
});

export const editMessage = mutation({
  args: {
    messageId: v.id("messages"),
    senderId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.senderId !== args.senderId) throw new Error("Unauthorized");
    if (message.type !== "text") throw new Error("Cannot edit images");
    
    // 10 minutes limit (10 * 60 * 1000 ms)
    if (Date.now() - message._creationTime > 600000) {
      throw new Error("Can only edit messages sent within the last 10 minutes");
    }

    await ctx.db.patch(args.messageId, {
      content: args.content,
      isEdited: true,
    });
  },
});

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});
