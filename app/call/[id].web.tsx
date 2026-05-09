import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";

export default function UnsupportedWebCallScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Calls are available on Android</Text>
      <Text style={styles.body}>
        Voice and video calls use native WebRTC in the mobile app.
      </Text>
      <Link href="/(tabs)/chats" style={styles.link}>
        Back to chats
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111B21",
    marginBottom: 8,
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    color: "#667781",
    marginBottom: 20,
    textAlign: "center",
  },
  link: {
    color: "#00A884",
    fontSize: 16,
    fontWeight: "700",
  },
});
