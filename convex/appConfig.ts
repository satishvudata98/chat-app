import { query } from "./_generated/server";

export const getAndroidUpdate = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", "android_update"))
      .unique();

    if (!config) return null;

    return {
      latestVersion: config.latestVersion,
      minimumVersion: config.minimumVersion,
      apkUrl: config.apkUrl,
      message: config.message ?? null,
    };
  },
});
