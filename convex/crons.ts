import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanup expired call signals",
  { minutes: 30 },
  internal.calls.cleanupOldSignals,
  {},
);

crons.interval(
  "cleanup stale typing indicators",
  { minutes: 5 },
  // @ts-ignore — internal.typing is generated after `npx convex dev`
  internal.typing.cleanupStaleTyping,
  {},
);

export default crons;
