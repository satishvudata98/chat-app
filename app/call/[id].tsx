import React, { useCallback } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { RTCView } from "react-native-webrtc";
import { useMutation, useQuery } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useUser } from "../../store/UserContext";
import { useAppTheme } from "../../store/ThemeContext";
import { useCallSession } from "../../hooks/useCallSession";

const terminalStatuses = new Set(["declined", "ended", "missed", "failed"]);

export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const callId = id as Id<"calls">;
  const router = useRouter();
  const { userId } = useUser();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  // @ts-ignore
  const call = useQuery(
    api.calls.getCall,
    id && userId ? { callId, userId } : "skip",
  );
  // @ts-ignore
  const acceptCall = useMutation(api.calls.acceptCall);
  // @ts-ignore
  const declineCall = useMutation(api.calls.declineCall);
  // @ts-ignore
  const endCall = useMutation(api.calls.endCall);

  const {
    localStream,
    remoteStream,
    connectionState,
    errorMessage,
    isMuted,
    isCameraOff,
    isSpeakerOn,
    stop,
    toggleMicrophone,
    toggleCamera,
    toggleSpeaker,
  } = useCallSession({ call, callId: id ? callId : null, userId });

  const isCaller = !!call && call.callerId === userId;
  const isIncomingRinging = !!call && call.status === "ringing" && !isCaller;
  const isVideo = call?.mode === "video";
  const isTerminal = !!call && terminalStatuses.has(call.status);

  const handleAccept = useCallback(async () => {
    if (!call || !userId) return;
    await acceptCall({ callId: call._id, userId });
  }, [acceptCall, call, userId]);

  const leaveCall = useCallback(async () => {
    if (call && userId && !terminalStatuses.has(call.status)) {
      await endCall({ callId: call._id, userId, status: "ended" });
    }
    stop();
    router.back();
  }, [call, endCall, router, stop, userId]);

  const handleDecline = useCallback(async () => {
    if (call && userId) {
      await declineCall({ callId: call._id, userId });
    }
    stop();
    router.back();
  }, [call, declineCall, router, stop, userId]);

  const getStatusText = () => {
    if (!call) return "Loading call...";
    if (call.status === "ringing") {
      return isCaller ? "Ringing..." : "Incoming call";
    }
    if (call.status === "accepted") {
      if (connectionState === "connected") return "Connected";
      if (connectionState === "failed") return "Connection problem";
      return "Connecting...";
    }
    if (call.status === "declined") return "Call declined";
    if (call.status === "missed") return "Missed call";
    if (call.status === "failed") return "Call failed";
    return "Call ended";
  };

  if (call === undefined) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (call === null) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.statusText, { color: colors.text }]}>Call not found</Text>
      </SafeAreaView>
    );
  }

  const localStreamUrl = localStream?.toURL();
  const remoteStreamUrl = remoteStream?.toURL();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.stage}>
        {isVideo && remoteStreamUrl ? (
          <RTCView
            streamURL={remoteStreamUrl}
            style={styles.remoteVideo}
            objectFit="contain"
          />
        ) : (
          <View style={styles.audioStage}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {call.otherUser?.name?.[0]?.toUpperCase() || "?"}
              </Text>
            </View>
            <Text style={styles.nameText}>{call.otherUser?.name || "Unknown User"}</Text>
            <Text style={styles.modeText}>{call.mode === "video" ? "Video call" : "Audio call"}</Text>
          </View>
        )}

        {isVideo && localStreamUrl && (
          <View style={[styles.localPreview, { top: Math.max(insets.top + 44, 76) }]}>
            <RTCView
              streamURL={localStreamUrl}
              style={styles.localVideo}
              objectFit="cover"
              mirror
            />
          </View>
        )}

        <View style={[styles.topBar, { top: Math.max(insets.top, 12) }]}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
        </View>

        {isIncomingRinging ? (
          <View style={[styles.incomingActions, { bottom: Math.max(insets.bottom + 22, 34) }]}>
            <TouchableOpacity
              style={[styles.roundButton, styles.declineButton]}
              onPress={handleDecline}
            >
              <Ionicons name="call" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roundButton, { backgroundColor: colors.primary }]}
              onPress={handleAccept}
            >
              <Ionicons name="call" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.controls, { bottom: Math.max(insets.bottom + 12, 18) }]}>
            <TouchableOpacity style={styles.controlButton} onPress={toggleMicrophone}>
              <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#fff" />
              <Text style={styles.controlLabel}>{isMuted ? "Unmute" : "Mute"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={toggleSpeaker}>
              <Ionicons
                name={isSpeakerOn ? "volume-high" : "volume-medium"}
                size={24}
                color="#fff"
              />
              <Text style={styles.controlLabel}>{isSpeakerOn ? "Speaker" : "Earpiece"}</Text>
            </TouchableOpacity>

            {isVideo && (
              <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
                <Ionicons
                  name={isCameraOff ? "videocam-off" : "videocam"}
                  size={24}
                  color="#fff"
                />
                <Text style={styles.controlLabel}>
                  {isCameraOff ? "Camera on" : "Camera off"}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.controlButton, styles.endButton]}
              onPress={leaveCall}
            >
              <Ionicons name="call" size={24} color="#fff" />
              <Text style={styles.controlLabel}>{isTerminal ? "Close" : "End"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#070B0D",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stage: {
    flex: 1,
    backgroundColor: "#070B0D",
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  audioStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  avatar: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  avatarText: {
    color: "#fff",
    fontSize: 46,
    fontWeight: "700",
  },
  nameText: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
  },
  modeText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    marginTop: 8,
  },
  localPreview: {
    position: "absolute",
    right: 16,
    width: 108,
    height: 156,
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "#111",
    elevation: 8,
    zIndex: 5,
  },
  localVideo: {
    flex: 1,
  },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 6,
  },
  statusText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  errorText: {
    color: "#FFB4AB",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
  controls: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  controlButton: {
    flex: 1,
    maxWidth: 86,
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 6,
  },
  endButton: {
    backgroundColor: "#E53935",
  },
  controlLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  incomingActions: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 46,
  },
  roundButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
  },
  declineButton: {
    backgroundColor: "#E53935",
    transform: [{ rotate: "135deg" }],
  },
});
