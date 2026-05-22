import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const CHAT_LIST_LIMIT = 100;
const EDIT_WINDOW_MS = 600_000; // 10 minutes

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

async function enrichMessage(
  ctx: QueryCtx,
  message: Doc<"messages">,
  archiveCutoff: number,
  viewerUserId: string,
  otherUserLastReadAt?: number,
) {
  if (message.isDeleted) {
    return {
      ...message,
      content: "",
      url: null,
      repliedMessage: null,
      deliveryStatus: null,
    };
  }

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
        isEncrypted: rm.isEncrypted ?? false,
        content: rm.isDeleted
          ? null
          : rm.type === "image"
            ? "Image"
            : rm.type === "call"
              ? rm.content || "Call"
              : rm.content,
      };
    }
  }

  return {
    ...message,
    url,
    repliedMessage,
    deliveryStatus:
      message.senderId === viewerUserId
        ? otherUserLastReadAt !== undefined &&
          otherUserLastReadAt >= message._creationTime
          ? "read"
          : "sent"
        : null,
  };
}

async function enrichChat(
  ctx: QueryCtx,
  chat: Doc<"chats">,
  userId: string,
  existingOtherUser?: Doc<"users"> | null,
) {
  const otherUserId = getOtherUserId(chat, userId);
  const otherUser = existingOtherUser ?? await getUserByUserId(ctx, otherUserId);

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
  args: {
    userId: v.string(),
    searchText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const searchText = args.searchText?.trim().toLowerCase() ?? "";
    const isSearching = searchText.length > 0;

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

    const chatMap = new Map<Id<"chats">, Doc<"chats">>();
    for (const chat of [...chatsAsA, ...chatsAsB]) {
      chatMap.set(chat._id, chat);
    }

    // Load all archives for this user in one query (fixes N+1)
    const userArchives = await ctx.db
      .query("chatArchives")
      .withIndex("by_userId_and_chatId", (q) => q.eq("userId", args.userId))
      .collect();
    const archiveMap = new Map(userArchives.map((a) => [a.chatId.toString(), a]));

    const visibleChats: { chat: Doc<"chats">; otherUser?: Doc<"users"> | null }[] = [];
    for (const chat of chatMap.values()) {
      const archive = archiveMap.get(chat._id.toString());

      if (archive && chat.updatedAt <= archive.archivedAt && !isSearching) {
        continue;
      }

      if (isSearching) {
        const otherUser = await getUserByUserId(ctx, getOtherUserId(chat, args.userId));
        const searchableName = otherUser?.name?.toLowerCase() ?? "";
        const searchableUserId = otherUser?.userId?.toLowerCase() ?? "";
        if (
          !searchableName.includes(searchText) &&
          !searchableUserId.includes(searchText)
        ) {
          continue;
        }

        visibleChats.push({ chat, otherUser });
        continue;
      }

      visibleChats.push({ chat });
    }

    visibleChats.sort((a, b) => b.chat.updatedAt - a.chat.updatedAt);

    return await Promise.all(
      visibleChats.slice(0, CHAT_LIST_LIMIT).map(({ chat, otherUser }) =>
        enrichChat(ctx, chat, args.userId, otherUser),
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

    const userArchives = await ctx.db
      .query("chatArchives")
      .withIndex("by_userId_and_chatId", (q) =>
        q.eq("userId", args.viewerUserId).eq("chatId", args.chatId),
      )
      .first();
    const archiveCutoff = userArchives?.archivedAt ?? 0;
    const otherUserId = getOtherUserId(chat, args.viewerUserId);
    const otherUserLastReadAt = chat.lastReadAt?.[otherUserId];

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
        page.page.map((message) =>
          enrichMessage(
            ctx,
            message,
            archiveCutoff,
            args.viewerUserId,
            otherUserLastReadAt,
          ),
        ),
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
    isEncrypted: v.optional(v.boolean()),
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
      isEncrypted: args.isEncrypted,
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

    // Cancel existing pending notification, reschedule with 3-second delay
    if (chat.pendingNotifJobId) {
      await ctx.scheduler.cancel(chat.pendingNotifJobId);
    }
    const pendingNotifJobId = await ctx.scheduler.runAfter(
      3000,
      internal.push.sendPushNotification,
      {
        chatId: args.chatId,
        senderId: args.senderId,
        messageContent: args.type === "image" ? "📷 Image" : args.isEncrypted ? "New message" : args.content,
      },
    );

    const patch: Partial<Doc<"chats">> = {
      lastMessageId: messageId,
      updatedAt: now,
      lastReadAt,
      unreadCounts,
      pendingNotifJobId,
    };

    if (!chat.pairKey && chat.participants.length === 2) {
      Object.assign(
        patch,
        getPairFields(chat.participants[0], chat.participants[1]),
      );
    }

    await ctx.db.patch(args.chatId, patch);

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

    // Cancel pending notification — user is reading right now
    if (chat.pendingNotifJobId) {
      await ctx.scheduler.cancel(chat.pendingNotifJobId);
    }

    const unreadCounts = { ...(chat.unreadCounts ?? {}) };
    unreadCounts[args.userId] = 0;

    await ctx.db.patch(args.chatId, {
      lastReadAt: {
        ...(chat.lastReadAt ?? {}),
        [args.userId]: Date.now(),
      },
      unreadCounts,
      pendingNotifJobId: undefined,
    });
  },
});

// Called by the push action after delivering the notification
export const clearPendingNotifJob = internalMutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.chatId, { pendingNotifJobId: undefined });
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
    const userArchives = await ctx.db
      .query("chatArchives")
      .withIndex("by_userId_and_chatId", (q) =>
        q.eq("userId", args.userId).eq("chatId", args.chatId),
      )
      .first();
    if (userArchives) {
      await ctx.db.patch(userArchives._id, { archivedAt: now });
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
    isEncrypted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.senderId !== args.senderId) throw new Error("Unauthorized");
    if (message.type !== "text") throw new Error("Cannot edit images");
    if (message.isDeleted) throw new Error("Cannot edit a deleted message");

    if (Date.now() - message._creationTime > EDIT_WINDOW_MS) {
      throw new Error("Can only edit messages sent within the last 10 minutes");
    }

    await ctx.db.patch(args.messageId, {
      content: args.content,
      isEdited: true,
      editedAt: Date.now(),
      isEncrypted: args.isEncrypted,
    });
  },
});

export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
    senderId: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.senderId !== args.senderId) throw new Error("Unauthorized");
    if (message.type === "call") throw new Error("Cannot delete call records");

    await ctx.db.patch(args.messageId, {
      isDeleted: true,
      content: "",
    });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
