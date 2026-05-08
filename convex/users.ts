import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createUser = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existingUser) {
      return existingUser._id;
    }

    return await ctx.db.insert("users", {
      userId: args.userId,
      name: args.name,
      ...(args.deviceId ? { deviceId: args.deviceId } : {}),
    });
  },
});

export const updatePushToken = mutation({
  args: {
    userId: v.string(),
    pushToken: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (user) {
      await ctx.db.patch(user._id, { pushToken: args.pushToken });
    }
  },
});

export const getUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const updateDeviceId = mutation({
  args: {
    userId: v.string(),
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (user && user.deviceId !== args.deviceId) {
      await ctx.db.patch(user._id, { deviceId: args.deviceId });
    }
  },
});

export const getUsersByDeviceId = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .take(3);

    return users.map((user) => ({
      _id: user._id,
      userId: user.userId,
      name: user.name,
      avatarUrl: user.avatarUrl,
      _creationTime: user._creationTime,
    }));
  },
});
