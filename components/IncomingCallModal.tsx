import React from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
// @ts-ignore
import { api } from "../convex/_generated/api";
import { useUser } from "../store/UserContext";
import { useAppTheme } from "../store/ThemeContext";

export function IncomingCallModal() {
  const router = useRouter();
  const pathname = usePathname();
  const { userId } = useUser();
  const { colors } = useAppTheme();
  // @ts-ignore
  const incomingCall = useQuery(
    api.calls.getActiveIncomingCall,
    userId ? { userId } : "skip",
  );
  // @ts-ignore
  const acceptCall = useMutation(api.calls.acceptCall);
  // @ts-ignore
  const declineCall = useMutation(api.calls.declineCall);

  const isOnCallScreen = pathname?.startsWith("/call/");
  const visible = !!incomingCall && !isOnCallScreen;

  const handleAccept = async () => {
    if (!incomingCall || !userId) return;
    await acceptCall({ callId: incomingCall._id, userId });
    router.push(`/call/${incomingCall._id}` as any);
  };

  const handleDecline = async () => {
    if (!incomingCall || !userId) return;
    await declineCall({ callId: incomingCall._id, userId });
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.panel }]}>
          {!incomingCall ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>
                  {incomingCall.otherUser?.name?.[0]?.toUpperCase() || "?"}
                </Text>
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                {incomingCall.otherUser?.name || "Someone"}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Incoming {incomingCall.mode} call
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.declineButton]}
                  onPress={handleDecline}
                >
                  <Ionicons name="call" size={26} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                  onPress={handleAccept}
                >
                  <Ionicons name="call" size={26} color="#fff" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    borderRadius: 20,
    padding: 24,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "700",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 24,
  },
  actions: {
    flexDirection: "row",
    gap: 40,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  declineButton: {
    backgroundColor: "#E53935",
    transform: [{ rotate: "135deg" }],
  },
});
