import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  mediaDevices,
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
} from "react-native-webrtc";
import InCallManager from "react-native-incall-manager";
// @ts-ignore
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";

type CallDoc = Doc<"calls"> & {
  otherUser?: {
    name?: string;
    userId?: string;
  } | null;
};

type ConnectionState =
  | "idle"
  | "starting"
  | "ringing"
  | "connecting"
  | "connected"
  | "failed"
  | "ended";

type UseCallSessionArgs = {
  call: CallDoc | null | undefined;
  callId: Id<"calls"> | null;
  userId: string | null;
};

type IceServer = { urls: string | string[]; username?: string; credential?: string };
const iceServers: IceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

// Add TURN relay if credentials are provided (prevents call failures on strict NAT networks)
const turnUsername = process.env.EXPO_PUBLIC_TURN_USERNAME;
const turnCredential = process.env.EXPO_PUBLIC_TURN_CREDENTIAL;
if (turnUsername && turnCredential) {
  iceServers.push(
    { urls: "turn:relay.metered.ca:80", username: turnUsername, credential: turnCredential },
    { urls: "turn:relay.metered.ca:443", username: turnUsername, credential: turnCredential },
    { urls: "turns:relay.metered.ca:443", username: turnUsername, credential: turnCredential },
  );
}

const rtcConfig = { iceServers };

const terminalStatuses = new Set(["declined", "ended", "missed", "failed"]);

export function useCallSession({ call, callId, userId }: UseCallSessionArgs) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const peerConnectionRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const processedSignalIdsRef = useRef(new Set<string>());
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const offerSentRef = useRef(false);
  const isStoppingRef = useRef(false);

  // @ts-ignore
  const sendSignal = useMutation(api.calls.sendSignal);
  // @ts-ignore
  const signals = useQuery(
    api.calls.listSignals,
    callId && userId ? { callId, userId } : "skip",
  ) ?? [];

  const isCaller = !!call && !!userId && call.callerId === userId;
  const canConnect = useMemo(() => {
    if (!call || !callId || !userId) return false;
    if (terminalStatuses.has(call.status)) return false;
    if (call.status === "accepted") return true;
    return isCaller && call.status === "ringing";
  }, [call, callId, isCaller, userId]);

  const stop = useCallback(() => {
    isStoppingRef.current = true;

    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    pendingCandidatesRef.current = [];
    offerSentRef.current = false;
    InCallManager.setForceSpeakerphoneOn(false);
    InCallManager.stop();
    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState("ended");
    setIsSpeakerOn(false);
  }, []);

  const sendPeerSignal = useCallback(
    async (type: "offer" | "answer" | "ice-candidate", payload: unknown) => {
      if (!callId || !userId) return;
      await sendSignal({
        callId,
        senderId: userId,
        type,
        payload: JSON.stringify(payload),
      });
    },
    [callId, sendSignal, userId],
  );

  const createPeerConnection = useCallback(
    async (stream: MediaStream) => {
      if (peerConnectionRef.current) return peerConnectionRef.current;

      const peerConnection = new RTCPeerConnection(rtcConfig) as any;
      peerConnectionRef.current = peerConnection;

      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      peerConnection.onicecandidate = (event: any) => {
        if (!event.candidate) return;
        sendPeerSignal("ice-candidate", event.candidate.toJSON()).catch((error) => {
          console.error("Failed to send ICE candidate", error);
        });
      };

      peerConnection.ontrack = (event: any) => {
        const [streamFromEvent] = event.streams;
        if (streamFromEvent) {
          setRemoteStream(streamFromEvent);
          setConnectionState("connected");
        }
      };

      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        if (state === "connected") {
          setConnectionState("connected");
          return;
        }
        if (state === "connecting") {
          setConnectionState("connecting");
          return;
        }
        if (state === "failed" || state === "disconnected") {
          setConnectionState("failed");
          setErrorMessage("Could not keep the call connected.");
        }
      };

      return peerConnection;
    },
    [sendPeerSignal],
  );

  const start = useCallback(async () => {
    if (!call || !canConnect || localStreamRef.current || isStoppingRef.current) return;

    setErrorMessage(null);
    setConnectionState(call.status === "ringing" ? "ringing" : "starting");

    try {
      const stream = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video:
          call.mode === "video"
            ? {
                facingMode: "user",
              }
            : false,
      } as any);

      localStreamRef.current = stream;
      setLocalStream(stream);
      const shouldUseSpeaker = call.mode === "video";
      InCallManager.start({ media: call.mode });
      InCallManager.setForceSpeakerphoneOn(shouldUseSpeaker);
      setIsSpeakerOn(shouldUseSpeaker);

      const peerConnection = await createPeerConnection(stream);

      if (isCaller && !offerSentRef.current) {
        offerSentRef.current = true;
        const offer = await peerConnection.createOffer({});
        await peerConnection.setLocalDescription(offer);
        await sendPeerSignal("offer", offer);
      }
    } catch (error) {
      console.error("Failed to start call media", error);
      setConnectionState("failed");
      setErrorMessage("Could not access camera or microphone.");
      stop();
    }
  }, [call, canConnect, createPeerConnection, isCaller, sendPeerSignal, stop]);

  useEffect(() => {
    if (!canConnect) {
      return;
    }

    isStoppingRef.current = false;
    start();
  }, [canConnect, start]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  useEffect(() => {
    if (call && terminalStatuses.has(call.status)) {
      stop();
    }
  }, [call, stop]);

  useEffect(() => {
    const processSignals = async () => {
      if (!call || !userId || !canConnect) return;

      const stream = localStreamRef.current;
      if (!stream) return;

      const peerConnection = await createPeerConnection(stream);

      for (const signal of signals) {
        if (signal.senderId === userId) continue;
        if (processedSignalIdsRef.current.has(signal._id)) continue;

        processedSignalIdsRef.current.add(signal._id);
        let payload: unknown;
        try {
          payload = JSON.parse(signal.payload);
        } catch {
          console.error("Malformed signal payload, skipping", signal._id);
          continue;
        }

        if (signal.type === "offer") {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(payload as any));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          await sendPeerSignal("answer", answer);

          while (pendingCandidatesRef.current.length > 0) {
            const candidate = pendingCandidatesRef.current.shift();
            if (candidate) await peerConnection.addIceCandidate(candidate);
          }
          continue;
        }

        if (signal.type === "answer") {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(payload as any));

          while (pendingCandidatesRef.current.length > 0) {
            const candidate = pendingCandidatesRef.current.shift();
            if (candidate) await peerConnection.addIceCandidate(candidate);
          }
          continue;
        }

        if (signal.type === "ice-candidate") {
          const candidate = new RTCIceCandidate(payload as any);
          if (peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(candidate);
          } else {
            pendingCandidatesRef.current.push(candidate);
          }
        }
      }
    };

    processSignals().catch((error) => {
      console.error("Failed to process call signal", error);
      setConnectionState("failed");
      setErrorMessage("A WebRTC signaling error occurred.");
    });
  }, [call, canConnect, createPeerConnection, localStream, sendPeerSignal, signals, userId]);

  const toggleMicrophone = useCallback(() => {
    const nextMuted = !isMuted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const nextCameraOff = !isCameraOff;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !nextCameraOff;
    });
    setIsCameraOff(nextCameraOff);
  }, [isCameraOff]);

  const toggleSpeaker = useCallback(() => {
    const nextSpeakerOn = !isSpeakerOn;
    InCallManager.setForceSpeakerphoneOn(nextSpeakerOn);
    InCallManager.setSpeakerphoneOn(nextSpeakerOn);
    setIsSpeakerOn(nextSpeakerOn);
  }, [isSpeakerOn]);

  return {
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
  };
}
