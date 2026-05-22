import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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

  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);

  useEffect(() => {
    if (connectionState !== "connected") return;
    elapsedRef.current = 0;
    setElapsed(0);
    const timer = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, [connectionState]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const activeCallStates = new Set(["ringing", "starting", "connecting", "connected"]);
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => activeCallStates.has(connectionState);
      BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => BackHandler.removeEventListener("hardwareBackPress", onBackPress);
    }, [connectionState])
  );

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
    if (call.status === "ringing") return isCaller ? "Ringing..." : "Incoming call";
    if (call.status === "accepted") {
      if (connectionState === "connected") return `Connected • ${formatDuration(elapsed)}`;
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

  // During video call: remote fills screen, local goes to corner.
  // While waiting (no remote yet): local fills screen so user sees their camera.
  const showRemoteFullscreen = isVideo && !!remoteStreamUrl;
  const showLocalFullscreen = isVideo && !!localStreamUrl && !remoteStreamUrl;
  const showLocalCorner = isVideo && !!localStreamUrl && !!remoteStreamUrl;

  return (
    <View style={styles.root}>
      {/* Layer 0 — background video surfaces (native, use zOrder to stack) */}
      {showRemoteFullscreen && (
        <RTCView
          streamURL={remoteStreamUrl!}
          style={StyleSheet.absoluteFillObject}
          objectFit="cover"
          zOrder={0}
        />
      )}
      {showLocalFullscreen && (
        <RTCView
          streamURL={localStreamUrl!}
          style={StyleSheet.absoluteFillObject}
          objectFit="cover"
          zOrder={0}
          mirror
        />
      )}

      {/* Audio call / non-video background */}
      {!isVideo && (
        <View style={styles.audioBackground}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {call.otherUser?.name?.[0]?.toUpperCase() || "?"}
            </Text>
          </View>
          <Text style={styles.nameText}>{call.otherUser?.name || "Unknown User"}</Text>
          <Text style={styles.modeText}>Audio call</Text>
        </View>
      )}

      {/* Video call waiting state: show name over local camera preview */}
      {showLocalFullscreen && (
        <View style={[styles.waitingOverlay, { paddingTop: Math.max(insets.top + 24, 48) }]}>
          <Text style={styles.waitingName}>{call.otherUser?.name || "Unknown"}</Text>
          <Text style={styles.waitingStatus}>{getStatusText()}</Text>
        </View>
      )}

      {/* Local camera corner pip — zOrder={1} so it sits on top of remote video */}
      {showLocalCorner && (
        <View
          style={[
            styles.localCorner,
            { bottom: Math.max(insets.bottom + 108, 126) },
          ]}
        >
          <RTCView
            streamURL={localStreamUrl!}
            style={StyleSheet.absoluteFillObject}
            objectFit="cover"
            zOrder={1}
            mirror
          />
        </View>
      )}

      {/* Top bar: status text */}
      {(!showLocalFullscreen) && (
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>
      )}

      {/* Bottom controls */}
      {isIncomingRinging ? (
        <View style={[styles.incomingRow, { paddingBottom: Math.max(insets.bottom + 32, 48) }]}>
          <View style={styles.incomingLabel}>
            <Text style={styles.incomingName}>{call.otherUser?.name || "Unknown"}</Text>
            <Text style={styles.incomingSubtitle}>
              {call.mode === "video" ? "Incoming video call" : "Incoming audio call"}
            </Text>
          </View>
          <View style={styles.incomingButtons}>
            <View style={styles.incomingBtnCol}>
              <TouchableOpacity style={styles.declineBtn} onPress={handleDecline}>
                <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
              </TouchableOpacity>
              <Text style={styles.incomingBtnLabel}>Decline</Text>
            </View>
            <View style={styles.incomingBtnCol}>
              <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: colors.primary }]} onPress={handleAccept}>
                <Ionicons name="call" size={30} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.incomingBtnLabel}>Accept</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
          <TouchableOpacity
            style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
            onPress={toggleMicrophone}
          >
            <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#fff" />
            <Text style={styles.controlLabel}>{isMuted ? "Unmute" : "Mute"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]}
            onPress={toggleSpeaker}
          >
            <Ionicons name={isSpeakerOn ? "volume-high" : "volume-medium"} size={24} color="#fff" />
            <Text style={styles.controlLabel}>{isSpeakerOn ? "Speaker" : "Earpiece"}</Text>
          </TouchableOpacity>

          {isVideo && (
            <TouchableOpacity
              style={[styles.controlBtn, isCameraOff && styles.controlBtnActive]}
              onPress={toggleCamera}
            >
              <Ionicons name={isCameraOff ? "videocam-off" : "videocam"} size={24} color="#fff" />
              <Text style={styles.controlLabel}>{isCameraOff ? "Cam on" : "Cam off"}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.endBtn} onPress={leaveCall}>
            <Ionicons name="call" size={26} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
            <Text style={styles.controlLabel}>{isTerminal ? "Close" : "End"}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#070B0D",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  audioBackground: {
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
    color: "rgba(255,255,255,0.65)",
    fontSize: 15,
    marginTop: 8,
  },
  // Local camera full-screen waiting state overlay
  waitingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 24,
  },
  waitingName: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
  },
  waitingStatus: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 16,
    marginTop: 8,
  },
  // Local camera corner PiP
  localCorner: {
    position: "absolute",
    right: 16,
    width: 110,
    height: 160,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "#111",
    // elevation and zIndex for the View container (non-native layer)
    elevation: 10,
    zIndex: 10,
  },
  // Top status bar
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
    zIndex: 20,
  },
  statusText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  errorText: {
    color: "#FFB4AB",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  // Controls bar
  controls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 20,
  },
  controlBtn: {
    flex: 1,
    maxWidth: 80,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    gap: 4,
  },
  controlBtnActive: {
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  endBtn: {
    flex: 1,
    maxWidth: 80,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#E53935",
    gap: 4,
  },
  controlLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  // Incoming call
  incomingRow: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingTop: 24,
    paddingHorizontal: 24,
    zIndex: 20,
  },
  incomingLabel: {
    alignItems: "center",
    marginBottom: 32,
  },
  incomingName: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
  },
  incomingSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    marginTop: 6,
  },
  incomingButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 64,
  },
  incomingBtnCol: {
    alignItems: "center",
    gap: 10,
  },
  declineBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E53935",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  incomingBtnLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontWeight: "600",
  },
});
