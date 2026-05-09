import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const RING_TIMEOUT_MS = 45_000;
const SIGNAL_TTL_MS = 10 * 60_000;
const SIGNAL_CLEANUP_BATCH_SIZE = 50;

const callStatusValidator = v.union(
  v.literal("ringing"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("ended"),
  v.literal("missed"),
  v.literal("failed"),
);

const terminalStatuses = new Set(["declined", "ended", "missed", "failed"]);

function getPairFields(userA: string, userB: string) {
  const [participantA, participantB] = [userA, userB].sort();
  return {
    participantA,
    participantB,
    pairKey: `${participantA}:${participantB}`,
  };
}

function getCallMessageContent(mode: "audio" | "video") {
  return mode === "video" ? "Video call" : "Audio call";
}

async function getUserByUserId(ctx: QueryCtx | MutationCtx, userId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
}

async function requireParticipant(
  ctx: QueryCtx | MutationCtx,
  callId: Id<"calls">,
  userId: string,
) {
  const call = await ctx.db.get(callId);
  if (!call) throw new Error("Call not found");
  if (!call.participants.includes(userId)) {
    throw new Error("User is not a call participant");
  }

  return call;
}

async function deleteSignalsForCall(ctx: MutationCtx, callId: Id<"calls">) {
  const signals = await ctx.db
    .query("callSignals")
    .withIndex("by_callId", (q) => q.eq("callId", callId))
    .take(SIGNAL_CLEANUP_BATCH_SIZE);

  for (const signal of signals) {
    await ctx.db.delete(signal._id);
  }

  if (signals.length === SIGNAL_CLEANUP_BATCH_SIZE) {
    await ctx.scheduler.runAfter(0, internal.calls.cleanupSignalsForCall, {
      callId,
    });
  }
}

async function updateCallMessageStatus(
  ctx: MutationCtx,
  call: Doc<"calls">,
  status: "ringing" | "accepted" | "declined" | "ended" | "missed" | "failed",
) {
  if (!call.callMessageId) return;

  const message = await ctx.db.get(call.callMessageId);
  if (!message) return;

  await ctx.db.patch(call.callMessageId, {
    callStatus: status,
  });
}

async function enrichCall(ctx: QueryCtx, call: Doc<"calls">, viewerId: string) {
  const otherUserId = call.participants.find((id) => id !== viewerId);
  const otherUser = otherUserId ? await getUserByUserId(ctx, otherUserId) : null;

  return {
    ...call,
    otherUser,
  };
}

export const startCall = mutation({
  args: {
    chatId: v.id("chats"),
    callerId: v.string(),
    mode: v.union(v.literal("audio"), v.literal("video")),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat) throw new Error("Chat not found");
    if (!chat.participants.includes(args.callerId)) {
      throw new Error("Caller is not a chat participant");
    }
    if (chat.participants.length !== 2) {
      throw new Error("Calls are only supported for one-to-one chats");
    }

    const calleeId = chat.participants.find((id) => id !== args.callerId);
    if (!calleeId) throw new Error("Could not find callee");

    const now = Date.now();
    const callId = await ctx.db.insert("calls", {
      chatId: args.chatId,
      callerId: args.callerId,
      calleeId,
      participants: chat.participants,
      mode: args.mode,
      status: "ringing",
      startedAt: now,
    });

    const callMessageId = await ctx.db.insert("messages", {
      chatId: args.chatId,
      senderId: args.callerId,
      type: "call",
      content: getCallMessageContent(args.mode),
      isRead: false,
      callId,
      callMode: args.mode,
      callStatus: "ringing",
    });

    const lastReadAt = { ...(chat.lastReadAt ?? {}) };
    lastReadAt[args.callerId] = now;

    const unreadCounts = { ...(chat.unreadCounts ?? {}) };
    for (const participantId of chat.participants) {
      unreadCounts[participantId] =
        participantId === args.callerId
          ? 0
          : (unreadCounts[participantId] ?? 0) + 1;
    }

    const chatPatch: Partial<Doc<"chats">> = {
      lastMessageId: callMessageId,
      updatedAt: now,
      lastReadAt,
      unreadCounts,
    };

    if (!chat.pairKey && chat.participants.length === 2) {
      Object.assign(
        chatPatch,
        getPairFields(chat.participants[0], chat.participants[1]),
      );
    }

    await ctx.db.patch(args.chatId, chatPatch);
    await ctx.db.patch(callId, { callMessageId });

    await ctx.scheduler.runAfter(0, internal.push.sendCallNotification, {
      callId,
      chatId: args.chatId,
      callerId: args.callerId,
      calleeId,
      mode: args.mode,
    });

    await ctx.scheduler.runAfter(RING_TIMEOUT_MS, internal.calls.markMissedIfUnanswered, {
      callId,
    });

    return callId;
  },
});

export const getCall = query({
  args: { callId: v.id("calls"), userId: v.string() },
  handler: async (ctx, args) => {
    const call = await requireParticipant(ctx, args.callId, args.userId);
    return await enrichCall(ctx, call, args.userId);
  },
});

export const getActiveIncomingCall = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const calls = await ctx.db
      .query("calls")
      .withIndex("by_calleeId_and_status", (q) =>
        q.eq("calleeId", args.userId).eq("status", "ringing"),
      )
      .order("desc")
      .take(1);

    const call = calls[0];
    if (!call) return null;

    return await enrichCall(ctx, call, args.userId);
  },
});

export const acceptCall = mutation({
  args: { callId: v.id("calls"), userId: v.string() },
  handler: async (ctx, args) => {
    const call = await requireParticipant(ctx, args.callId, args.userId);
    if (call.calleeId !== args.userId) {
      throw new Error("Only the callee can accept this call");
    }
    if (call.status !== "ringing") {
      return call.status;
    }

    await ctx.db.patch(args.callId, {
      status: "accepted",
      acceptedAt: Date.now(),
    });
    await updateCallMessageStatus(ctx, call, "accepted");

    return "accepted";
  },
});

export const declineCall = mutation({
  args: { callId: v.id("calls"), userId: v.string() },
  handler: async (ctx, args) => {
    const call = await requireParticipant(ctx, args.callId, args.userId);
    if (call.status !== "ringing") {
      return call.status;
    }

    await ctx.db.patch(args.callId, {
      status: "declined",
      endedAt: Date.now(),
      endedBy: args.userId,
    });
    await updateCallMessageStatus(ctx, call, "declined");
    await deleteSignalsForCall(ctx, args.callId);

    return "declined";
  },
});

export const endCall = mutation({
  args: {
    callId: v.id("calls"),
    userId: v.string(),
    status: v.optional(callStatusValidator),
  },
  handler: async (ctx, args) => {
    const call = await requireParticipant(ctx, args.callId, args.userId);
    if (terminalStatuses.has(call.status)) {
      return call.status;
    }

    const nextStatus = args.status && terminalStatuses.has(args.status)
      ? args.status
      : "ended";

    await ctx.db.patch(args.callId, {
      status: nextStatus,
      endedAt: Date.now(),
      endedBy: args.userId,
    });
    await updateCallMessageStatus(ctx, call, nextStatus);
    await deleteSignalsForCall(ctx, args.callId);

    return nextStatus;
  },
});

export const sendSignal = mutation({
  args: {
    callId: v.id("calls"),
    senderId: v.string(),
    type: v.union(
      v.literal("offer"),
      v.literal("answer"),
      v.literal("ice-candidate"),
    ),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    const call = await requireParticipant(ctx, args.callId, args.senderId);
    if (terminalStatuses.has(call.status)) {
      throw new Error("Call has ended");
    }

    return await ctx.db.insert("callSignals", {
      callId: args.callId,
      senderId: args.senderId,
      type: args.type,
      payload: args.payload,
      expiresAt: Date.now() + SIGNAL_TTL_MS,
    });
  },
});

export const listSignals = query({
  args: { callId: v.id("calls"), userId: v.string() },
  handler: async (ctx, args) => {
    await requireParticipant(ctx, args.callId, args.userId);

    return await ctx.db
      .query("callSignals")
      .withIndex("by_callId", (q) => q.eq("callId", args.callId))
      .take(200);
  },
});

export const markMissedIfUnanswered = internalMutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    const call = await ctx.db.get(args.callId);
    if (!call || call.status !== "ringing") return null;

    await ctx.db.patch(args.callId, {
      status: "missed",
      endedAt: Date.now(),
    });
    await updateCallMessageStatus(ctx, call, "missed");
    await deleteSignalsForCall(ctx, args.callId);

    return null;
  },
});

export const cleanupSignalsForCall = internalMutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    await deleteSignalsForCall(ctx, args.callId);
    return null;
  },
});

export const cleanupOldSignals = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const signals = await ctx.db
      .query("callSignals")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(SIGNAL_CLEANUP_BATCH_SIZE);

    for (const signal of signals) {
      await ctx.db.delete(signal._id);
    }

    if (signals.length === SIGNAL_CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.calls.cleanupOldSignals, {});
    }

    return null;
  },
});
