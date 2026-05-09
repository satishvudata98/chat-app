import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanup expired call signals",
  { minutes: 30 },
  internal.calls.cleanupOldSignals,
  {},
);

export default crons;
