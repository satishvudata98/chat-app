import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

const TYPING_TTL_MS = 4000;

export const setTyping = mutation({
  args: { chatId: v.id("chats"), userId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("typing")
      .withIndex("by_chatId_and_userId", (q) =>
        q.eq("chatId", args.chatId).eq("userId", args.userId),
      )
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { updatedAt: now });
    } else {
      await ctx.db.insert("typing", {
        chatId: args.chatId,
        userId: args.userId,
        updatedAt: now,
      });
    }
  },
});

export const clearTyping = mutation({
  args: { chatId: v.id("chats"), userId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("typing")
      .withIndex("by_chatId_and_userId", (q) =>
        q.eq("chatId", args.chatId).eq("userId", args.userId),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const cleanupStaleTyping = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 10_000;
    const stale = await ctx.db
      .query("typing")
      .filter((q) => q.lt(q.field("updatedAt"), cutoff))
      .collect();
    await Promise.all(stale.map((r) => ctx.db.delete(r._id)));
  },
});

export const getTypingUsers = query({
  args: { chatId: v.id("chats"), viewerUserId: v.string() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - TYPING_TTL_MS;
    const records = await ctx.db
      .query("typing")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .collect();

    const active = records.filter(
      (r) => r.userId !== args.viewerUserId && r.updatedAt >= cutoff,
    );

    if (active.length === 0) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", active[0].userId))
      .first();

    return user?.name ?? "Someone";
  },
});
