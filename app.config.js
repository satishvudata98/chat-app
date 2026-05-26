const appJson = require("./app.json");

const channel = process.env.EXPO_UPDATES_CHANNEL;
const expoConfig = appJson.expo;
const updates = expoConfig.updates ?? {};

module.exports = {
  expo: {
    ...expoConfig,
    updates: channel
      ? {
          ...updates,
          requestHeaders: {
            ...(updates.requestHeaders ?? {}),
            "expo-channel-name": channel,
          },
        }
      : updates,
  },
};