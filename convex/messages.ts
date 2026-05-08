import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const CHAT_LIST_LIMIT = 100;
const LEGACY_CHAT_SCAN_LIMIT = 1000;

function getPairFields(userA: string, userB: string) {
  const [participantA, participantB] = [userA, userB].sort();
  return {
    participantA,
    participantB,
    pairKey: `${participantA}:${participantB}`,
  };
}

function getOtherUserId(chat: Doc<"chats">, userId: string) {
  return chat.participants.find((id) => id !== userId) || userId;
}

async function getUserByUserId(ctx: QueryCtx | MutationCtx, userId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
}

async function getArchive(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  chatId: Id<"chats">,
) {
  return await ctx.db
    .query("chatArchives")
    .withIndex("by_userId_and_chatId", (q) =>
      q.eq("userId", userId).eq("chatId", chatId),
    )
    .first();
}

async function enrichMessage(
  ctx: QueryCtx,
  message: Doc<"messages">,
  archiveCutoff: number,
) {
  let url = null;
  if (message.fileId) {
    url = await ctx.storage.getUrl(message.fileId);
  }

  let repliedMessage = null;
  if (message.replyToId) {
    const rm = await ctx.db.get(message.replyToId);
    if (rm && rm._creationTime > archiveCutoff) {
      repliedMessage = {
        _id: rm._id,
        senderId: rm.senderId,
        content: rm.type === "image" ? "Image" : rm.content,
      };
    }
  }

  return {
    ...message,
    url,
    repliedMessage,
  };
}

async function enrichChat(ctx: QueryCtx, chat: Doc<"chats">, userId: string) {
  const otherUserId = getOtherUserId(chat, userId);
  const otherUser = await getUserByUserId(ctx, otherUserId);

  let lastMessage = null;
  if (chat.lastMessageId) {
    lastMessage = await ctx.db.get(chat.lastMessageId);
  }

  const lastReadAt = chat.lastReadAt?.[userId];
  const hasUnread =
    lastMessage !== null &&
    lastMessage.senderId !== userId &&
    (lastReadAt !== undefined
      ? lastMessage._creationTime > lastReadAt
      : (chat.unreadCounts?.[userId] ?? 0) > 0);

  return {
    ...chat,
    otherUser,
    lastMessage,
    hasUnread,
  };
}

export const listChats = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const chatsAsA = await ctx.db
      .query("chats")
      .withIndex("by_participantA_and_updatedAt", (q) =>
        q.eq("participantA", args.userId),
      )
      .order("desc")
      .take(CHAT_LIST_LIMIT);

    const chatsAsB = await ctx.db
      .query("chats")
      .withIndex("by_participantB_and_updatedAt", (q) =>
        q.eq("participantB", args.userId),
      )
      .order("desc")
      .take(CHAT_LIST_LIMIT);

    const legacyChats = await ctx.db
      .query("chats")
      .order("desc")
      .take(LEGACY_CHAT_SCAN_LIMIT);

    const chatMap = new Map<Id<"chats">, Doc<"chats">>();
    for (const chat of [...chatsAsA, ...chatsAsB]) {
      chatMap.set(chat._id, chat);
    }

    for (const chat of legacyChats) {
      if (
        !chat.pairKey &&
        chat.participants.includes(args.userId) &&
        chat.participants.length === 2
      ) {
        chatMap.set(chat._id, chat);
      }
    }

    const visibleChats = [];
    for (const chat of chatMap.values()) {
      const archive = await getArchive(ctx, args.userId, chat._id);
      if (archive && chat.updatedAt <= archive.archivedAt) {
        continue;
      }
      visibleChats.push(chat);
    }

    visibleChats.sort((a, b) => b.updatedAt - a.updatedAt);

    return await Promise.all(
      visibleChats.slice(0, CHAT_LIST_LIMIT).map((chat) =>
        enrichChat(ctx, chat, args.userId),
      ),
    );
  },
});

export const getChatDetails = query({
  args: { chatId: v.id("chats"), userId: v.string() },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat) return null;
    if (!chat.participants.includes(args.userId)) {
      throw new Error("User is not a chat participant");
    }

    const otherUser = await getUserByUserId(ctx, getOtherUserId(chat, args.userId));

    return {
      _id: chat._id,
      otherUser,
    };
  },
});

export const getOrCreateChat = mutation({
  args: { myUserId: v.string(), otherUserId: v.string() },
  handler: async (ctx, args) => {
    const pairFields = getPairFields(args.myUserId, args.otherUserId);
    const existingChat = await ctx.db
      .query("chats")
      .withIndex("by_pairKey", (q) => q.eq("pairKey", pairFields.pairKey))
      .first();

    if (existingChat) return existingChat._id;

    const legacyChats = await ctx.db
      .query("chats")
      .order("desc")
      .take(LEGACY_CHAT_SCAN_LIMIT);
    const legacyChat = legacyChats.find(
      (chat) =>
        !chat.pairKey &&
        chat.participants.includes(args.myUserId) &&
        chat.participants.includes(args.otherUserId) &&
        chat.participants.length === 2,
    );

    if (legacyChat) {
      await ctx.db.patch(legacyChat._id, pairFields);
      return legacyChat._id;
    }

    const now = Date.now();

    return await ctx.db.insert("chats", {
      participants: [args.myUserId, args.otherUserId],
      ...pairFields,
      updatedAt: now,
      lastReadAt: {
        [args.myUserId]: now,
        [args.otherUserId]: now,
      },
      unreadCounts: {
        [args.myUserId]: 0,
        [args.otherUserId]: 0,
      },
    });
  },
});

export const getMessages = query({
  args: {
    chatId: v.id("chats"),
    viewerUserId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat) throw new Error("Chat not found");
    if (!chat.participants.includes(args.viewerUserId)) {
      throw new Error("User is not a chat participant");
    }

    const archive = await getArchive(ctx, args.viewerUserId, args.chatId);
    const archiveCutoff = archive?.archivedAt ?? 0;

    const page = await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) =>
        q.eq("chatId", args.chatId).gt("_creationTime", archiveCutoff),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: await Promise.all(
        page.page.map((message) => enrichMessage(ctx, message, archiveCutoff)),
      ),
    };
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
    const chat = await ctx.db.get(args.chatId);
    if (!chat) throw new Error("Chat not found");
    if (!chat.participants.includes(args.senderId)) {
      throw new Error("Sender is not a chat participant");
    }

    const messageId = await ctx.db.insert("messages", {
      chatId: args.chatId,
      senderId: args.senderId,
      type: args.type,
      content: args.content,
      fileId: args.fileId,
      isRead: false,
      replyToId: args.replyToId,
    });

    const now = Date.now();
    const lastReadAt = { ...(chat.lastReadAt ?? {}) };
    lastReadAt[args.senderId] = now;

    const unreadCounts = { ...(chat.unreadCounts ?? {}) };
    for (const participantId of chat.participants) {
      unreadCounts[participantId] =
        participantId === args.senderId
          ? 0
          : (unreadCounts[participantId] ?? 0) + 1;
    }

    const patch: Partial<Doc<"chats">> = {
      lastMessageId: messageId,
      updatedAt: now,
      lastReadAt,
      unreadCounts,
    };

    if (!chat.pairKey && chat.participants.length === 2) {
      Object.assign(
        patch,
        getPairFields(chat.participants[0], chat.participants[1]),
      );
    }

    await ctx.db.patch(args.chatId, patch);

    await ctx.scheduler.runAfter(0, internal.push.sendPushNotification, {
      chatId: args.chatId,
      senderId: args.senderId,
      messageContent: args.type === "image" ? "Image" : args.content,
    });

    return messageId;
  },
});

export const markChatRead = mutation({
  args: {
    chatId: v.id("chats"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat) throw new Error("Chat not found");
    if (!chat.participants.includes(args.userId)) {
      throw new Error("User is not a chat participant");
    }

    const unreadCounts = { ...(chat.unreadCounts ?? {}) };
    unreadCounts[args.userId] = 0;

    await ctx.db.patch(args.chatId, {
      lastReadAt: {
        ...(chat.lastReadAt ?? {}),
        [args.userId]: Date.now(),
      },
      unreadCounts,
    });
  },
});

export const archiveChatForUser = mutation({
  args: {
    chatId: v.id("chats"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat) throw new Error("Chat not found");
    if (!chat.participants.includes(args.userId)) {
      throw new Error("User is not a chat participant");
    }

    const now = Date.now();
    const archive = await getArchive(ctx, args.userId, args.chatId);
    if (archive) {
      await ctx.db.patch(archive._id, { archivedAt: now });
    } else {
      await ctx.db.insert("chatArchives", {
        userId: args.userId,
        chatId: args.chatId,
        archivedAt: now,
      });
    }

    const unreadCounts = { ...(chat.unreadCounts ?? {}) };
    unreadCounts[args.userId] = 0;

    await ctx.db.patch(args.chatId, {
      lastReadAt: {
        ...(chat.lastReadAt ?? {}),
        [args.userId]: now,
      },
      unreadCounts,
    });
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

    if (Date.now() - message._creationTime > 600000) {
      throw new Error("Can only edit messages sent within the last 10 minutes");
    }

    await ctx.db.patch(args.messageId, {
      content: args.content,
      isEdited: true,
    });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
