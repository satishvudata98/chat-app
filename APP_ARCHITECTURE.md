# Chat App — Architecture Reference

> **Living document.** Update the [Feature Tracker](#13-feature-tracker) whenever a feature is added or a flow changes.
> Provide this file to any AI agent working on the codebase for full context.

---

## 1. Project Overview

| Property | Value |
|----------|-------|
| **Type** | Real-time chat + audio/video calling app |
| **Platform** | React Native (Expo) — iOS, Android, Web |
| **Backend** | Convex (real-time DB, serverless functions) |
| **Routing** | Expo Router (file-based) |
| **Language** | TypeScript |
| **Auth model** | Device-local UUID (no server-side auth) |

---

## 2. Directory Structure

```
chat-app/
├── app/                        # Expo Router screens
│   ├── _layout.tsx             # Root layout — all providers, global modals
│   ├── index.tsx               # Auth gate — redirects to onboarding or tabs
│   ├── onboarding.tsx          # New user setup / profile restore
│   ├── scan.tsx                # QR code scanner
│   ├── modal.tsx               # Generic modal template (unused)
│   ├── (tabs)/
│   │   ├── _layout.tsx         # Bottom tab navigator
│   │   ├── chats.tsx           # Chat list with search
│   │   ├── profile.tsx         # User profile + QR code
│   │   └── settings.tsx        # Theme toggle
│   ├── chat/
│   │   └── [id].tsx            # Individual chat (messages, input, replies)
│   ├── call/
│   │   └── [id].tsx            # Audio / video call screen (WebRTC)
│   └── user/
│       └── [id].tsx            # Deep link handler (chatapp://user/<id>)
├── components/
│   ├── IncomingCallModal.tsx   # Global incoming call overlay
│   └── NativeUpdatePrompt.tsx  # Android APK update check
├── convex/                     # Backend (Convex)
│   ├── schema.ts               # Database schema
│   ├── users.ts                # User queries & mutations
│   ├── messages.ts             # Chat & message logic
│   ├── calls.ts                # Call lifecycle + WebRTC signaling
│   ├── push.ts                 # Push notification actions
│   ├── appConfig.ts            # Android version config
│   ├── crons.ts                # Scheduled jobs
│   └── http.ts                 # HTTP endpoint (/add?id=)
├── hooks/
│   ├── useCallSession.ts       # WebRTC peer connection + streams
│   ├── usePushNotifications.ts # Expo push token registration + routing
│   ├── useDeviceProfile.ts     # Android device ID linking
│   └── use-theme-color.ts      # Color helper
├── store/
│   ├── UserContext.tsx         # Global auth state (userId)
│   └── ThemeContext.tsx        # Global theme state (light/dark)
├── constants/
│   └── theme.ts                # Light & dark color definitions
└── assets/                     # Images, icons
```

---

## 3. Tech Stack & Key Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| `expo` | ~53.x | Build toolchain, native module access |
| `expo-router` | 6.x | File-based navigation |
| `convex` | 1.37.0 | Real-time backend — DB, queries, mutations |
| `react-native-webrtc` | 124.0.7 | Peer-to-peer audio/video (RTCPeerConnection) |
| `react-native-incall-manager` | 4.2.1 | Audio routing (speaker/earpiece) |
| `expo-notifications` | 0.32.x | Push notifications (Expo push API) |
| `expo-secure-store` | 15.x | Encrypted local storage (userId, theme) |
| `expo-image-picker` | 17.x | Camera roll / photo picker |
| `expo-image` | 3.x | Optimized image display |
| `expo-camera` | — | QR code scanner |
| `expo-application` | — | Android device ID |
| `react-native-qrcode-svg` | — | QR code generation (profile screen) |
| `@react-navigation/*` | — | Navigation primitives |
| `react-native-reanimated` | — | Swipe-to-reply gesture animations |
| `react-native-uuid` | 2.x | UUID generation for userId |

---

## 4. Navigation & Routing

### Route Table

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/index.tsx` | Redirects → `/onboarding` or `/(tabs)/chats` |
| `/onboarding` | `app/onboarding.tsx` | Create or restore user profile |
| `/(tabs)/chats` | `app/(tabs)/chats.tsx` | Chat list (default tab) |
| `/(tabs)/profile` | `app/(tabs)/profile.tsx` | QR code + share link |
| `/(tabs)/settings` | `app/(tabs)/settings.tsx` | Theme toggle |
| `/chat/[id]` | `app/chat/[id].tsx` | Chat messages screen |
| `/call/[id]` | `app/call/[id].tsx` | Audio/video call screen |
| `/scan` | `app/scan.tsx` | QR scanner → add contact |
| `/user/[id]` | `app/user/[id].tsx` | Deep link: `chatapp://user/<id>` |

### Provider & Layout Hierarchy

```
RootLayout (app/_layout.tsx)
  ├── ConvexProvider                    ← backend client
  ├── UserProvider                      ← userId state (secure storage)
  └── ThemePreferenceProvider           ← theme state (secure storage)
      └── AppShell
          ├── ThemeProvider             ← React Navigation theme injection
          ├── Stack (Expo Router)
          │   ├── onboarding
          │   ├── (tabs)                ← bottom tab navigator
          │   │   ├── chats
          │   │   ├── profile
          │   │   └── settings
          │   ├── chat/[id]
          │   ├── call/[id]
          │   ├── scan
          │   └── user/[id]
          ├── IncomingCallModal         ← global overlay
          └── NativeUpdatePrompt        ← Android update check
```

---

## 5. Authentication & Session

### User ID Generation
1. User opens app for the first time → `onboarding.tsx`
2. User enters name → `api.users.createUser({ userId, name, deviceId })`
3. `userId` = `uuid.v4()` (generated client-side)
4. Saved to `expo-secure-store` under key `'userId'`

### Session Restoration
- On every launch `UserProvider` reads `expo-secure-store`
- If `userId` found → `app/index.tsx` redirects to `/(tabs)/chats`
- If missing → redirects to `/onboarding`

### Device ID Linking (Android only)
- `useDeviceProfileId()` → `expo-application.getAndroidId()`
- Stored in `users.deviceId` field
- On onboarding: `getUsersByDeviceId` returns existing profiles on this device
- User can **restore** previous profile (same UUID) or create a new one

### Security Model
- No server-side auth — functions accept `userId` as a plain string argument
- Trust is device-local (anyone who knows a userId can impersonate)
- Suitable for personal/demo apps; not production-safe without server auth

---

## 6. Database Schema (Convex)

### `users`
| Field | Type | Notes |
|-------|------|-------|
| `userId` | string | Client-generated UUID |
| `name` | string | Display name |
| `avatarUrl` | string? | Optional avatar |
| `pushToken` | string? | Expo push token |
| `deviceId` | string? | Android device ID |
| **Indexes** | `by_userId`, `by_deviceId` | |

### `chats`
| Field | Type | Notes |
|-------|------|-------|
| `participants` | string[] | Array of userIds |
| `participantA` | string? | Sorted lower userId |
| `participantB` | string? | Sorted higher userId |
| `pairKey` | string? | `"<A>:<B>"` for dedup |
| `lastMessageId` | id<"messages">? | Latest message ref |
| `updatedAt` | number | Timestamp (for sort) |
| `lastReadAt` | Record<userId, timestamp>? | Per-user read cursor |
| `unreadCounts` | Record<userId, number>? | Per-user unread count |
| **Indexes** | `by_participantA_and_updatedAt`, `by_participantB_and_updatedAt`, `by_pairKey` | |

### `messages`
| Field | Type | Notes |
|-------|------|-------|
| `chatId` | id<"chats"> | Parent chat |
| `senderId` | string | userId of sender |
| `type` | "text" \| "image" \| "call" | Message type |
| `content` | string | Text or empty string |
| `fileId` | id<"_storage">? | Convex storage reference (images) |
| `isRead` | boolean | Legacy field |
| `isEdited` | boolean? | Edited flag |
| `replyToId` | id<"messages">? | Quoted message |
| `callId` | id<"calls">? | Linked call |
| `callMode` | "audio" \| "video"? | For call messages |
| `callStatus` | "ringing" \| "accepted" \| "declined" \| "ended" \| "missed" \| "failed"? | Mirrors call state |
| **Indexes** | `by_chatId` | |

### `calls`
| Field | Type | Notes |
|-------|------|-------|
| `chatId` | id<"chats"> | Parent chat |
| `callerId` | string | userId |
| `calleeId` | string | userId |
| `participants` | string[] | Both users |
| `mode` | "audio" \| "video" | |
| `status` | "ringing" \| "accepted" \| "declined" \| "ended" \| "missed" \| "failed" | |
| `startedAt` | number | Timestamp |
| `acceptedAt` | number? | |
| `endedAt` | number? | |
| `endedBy` | string? | userId |
| `callMessageId` | id<"messages">? | Linked message |
| **Indexes** | `by_chatId_and_startedAt`, `by_calleeId_and_status`, `by_callerId_and_status` | |

### `callSignals`
| Field | Type | Notes |
|-------|------|-------|
| `callId` | id<"calls"> | |
| `senderId` | string | |
| `type` | "offer" \| "answer" \| "ice-candidate" | WebRTC signal type |
| `payload` | string | JSON-serialized signal |
| `expiresAt` | number | TTL = 10 minutes |
| **Indexes** | `by_callId`, `by_expiresAt` | |

### `chatArchives`
| Field | Type | Notes |
|-------|------|-------|
| `userId` | string | |
| `chatId` | id<"chats"> | |
| `archivedAt` | number | Messages before this timestamp hidden |
| **Indexes** | `by_userId_and_chatId` | |

### `appConfig`
| Field | Type | Notes |
|-------|------|-------|
| `key` | string | Config key |
| `latestVersion` | string | |
| `minimumVersion` | string | |
| `apkUrl` | string | Direct APK download |
| `message` | string? | Update prompt text |

---

## 7. Backend API Surface

### Queries

| Function | File | Args | Returns |
|----------|------|------|---------|
| `users.getUser` | `users.ts` | `userId` | User doc or null |
| `users.getUsersByDeviceId` | `users.ts` | `deviceId` | Up to 3 users |
| `messages.listChats` | `messages.ts` | `userId`, `searchText?` | Enriched chats (otherUser, lastMessage, hasUnread) — max 100 |
| `messages.getChatDetails` | `messages.ts` | `chatId`, `userId` | Chat + otherUser |
| `messages.getMessages` | `messages.ts` | `chatId`, `viewerUserId`, `paginationOpts` | Paginated messages with url, repliedMessage, deliveryStatus |
| `calls.getCall` | `calls.ts` | `callId`, `userId` | Call + otherUser |
| `calls.getActiveIncomingCall` | `calls.ts` | `userId` | Active "ringing" call for callee or null |
| `calls.listSignals` | `calls.ts` | `callId`, `userId` | Up to 200 WebRTC signals |
| `appConfig.getAndroidUpdate` | `appConfig.ts` | — | Android version config or null |

### Mutations

| Function | File | Args | Side Effects |
|----------|------|------|-------------|
| `users.createUser` | `users.ts` | `userId`, `name`, `deviceId?` | Inserts user if not exists |
| `users.updatePushToken` | `users.ts` | `userId`, `pushToken` | Updates push token |
| `users.updateDeviceId` | `users.ts` | `userId`, `deviceId` | Updates device binding |
| `messages.getOrCreateChat` | `messages.ts` | `myUserId`, `otherUserId` | Creates 1-1 chat or returns existing; generates pairKey |
| `messages.sendMessage` | `messages.ts` | `chatId`, `senderId`, `type`, `content`, `fileId?`, `replyToId?` | Inserts message; updates chat metadata; increments unread; schedules push |
| `messages.markChatRead` | `messages.ts` | `chatId`, `userId` | Resets unreadCounts[userId] to 0; sets lastReadAt |
| `messages.archiveChatForUser` | `messages.ts` | `chatId`, `userId` | Creates archive entry; hides old messages |
| `messages.editMessage` | `messages.ts` | `messageId`, `senderId`, `content` | Updates text; 10-min window; sets isEdited |
| `messages.generateUploadUrl` | `messages.ts` | — | Returns signed URL for Convex storage upload |
| `calls.startCall` | `calls.ts` | `chatId`, `callerId`, `mode` | Creates call (ringing); creates call message; schedules push + 45s missed timeout |
| `calls.acceptCall` | `calls.ts` | `callId`, `userId` | Sets status → accepted; sets acceptedAt |
| `calls.declineCall` | `calls.ts` | `callId`, `userId` | Sets status → declined; deletes signals |
| `calls.endCall` | `calls.ts` | `callId`, `userId`, `status?` | Sets terminal status; deletes signals; updates call message |
| `calls.sendSignal` | `calls.ts` | `callId`, `senderId`, `type`, `payload` | Stores WebRTC signal with 10-min TTL |

### Internal Actions (server-side only)

| Function | File | Trigger | Purpose |
|----------|------|---------|---------|
| `push.sendPushNotification` | `push.ts` | After `sendMessage` (0ms) | Sends chat push via Expo API |
| `push.sendCallNotification` | `push.ts` | After `startCall` (0ms) | Sends incoming call push |
| `calls.markMissedIfUnanswered` | `calls.ts` | After `startCall` (45s) | Auto-marks call missed if still ringing |
| `calls.cleanupSignalsForCall` | `calls.ts` | After call ends | Batch-deletes signals |
| `calls.cleanupOldSignals` | `calls.ts` | Cron every 30 min | Deletes expired signals by TTL |

### HTTP Endpoint

| Route | File | Purpose |
|-------|------|---------|
| `GET /add?id={userId}` | `http.ts` | Returns HTML page with deep link button → `chatapp://user/<id>` |

### Cron Jobs (`convex/crons.ts`)

| Schedule | Function | Purpose |
|----------|----------|---------|
| Every 30 minutes | `internal.calls.cleanupOldSignals` | Delete expired WebRTC signals |

---

## 8. Real-Time Data Flow

Convex queries are **reactive** — the UI re-renders automatically when data changes in the DB.

```
┌─────────────────────────────────────────────────────────────┐
│                    Convex Real-Time Queries                 │
│                                                             │
│  ChatsScreen          listChats(userId)                     │
│  ChatScreen           getChatDetails + getMessages (paginated) │
│  CallScreen           getCall(callId)                       │
│  IncomingCallModal    getActiveIncomingCall(userId)         │
│  useCallSession       listSignals(callId)  ← WebRTC signals │
└─────────────────────────────────────────────────────────────┘
                            │ mutation triggers DB write
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Convex Mutations (client)                 │
│                                                             │
│  sendMessage → updates chats + messages tables             │
│  markChatRead → updates lastReadAt/unreadCounts            │
│  startCall → creates calls record                          │
│  acceptCall/declineCall/endCall → updates calls record     │
│  sendSignal → inserts callSignals row                      │
└─────────────────────────────────────────────────────────────┘
                            │ ctx.scheduler.runAfter
                            ↓
┌─────────────────────────────────────────────────────────────┐
│               Internal Actions (server-scheduled)          │
│                                                             │
│  sendPushNotification → Expo push API                      │
│  sendCallNotification → Expo push API                      │
│  markMissedIfUnanswered → after 45s                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Feature Flows

### Chat Flow
```
ChatsScreen (listChats query)
  → tap chat item
    → router.push('/chat/<chatId>')
      → ChatScreen mounts
        → getChatDetails (header name)
        → getMessages paginated (message list)
        → useFocusEffect → markChatRead mutation
      → user types + taps Send
        → sendMessage mutation
          → message inserted → DB write
            → ChatsScreen & ChatScreen auto-update (reactive)
            → scheduler fires sendPushNotification (0ms)
              → Expo push API notifies recipient
      → recipient opens app from notification
        → router.push('/chat/<chatId>')
          → markChatRead called
            → sender sees double blue ticks (deliveryStatus: "read")
```

### Call Flow
```
ChatScreen header → tap audio/video call button
  → startCall mutation
    → call created (status: ringing)
    → call message inserted in chat
    → scheduler: sendCallNotification (0ms) + markMissedIfUnanswered (45s)
      → recipient IncomingCallModal appears (getActiveIncomingCall query)
        → [Accept] → acceptCall mutation → router.push('/call/<callId>')
          → CallScreen mounts → useCallSession starts
            → Caller: creates RTCPeerConnection, getUserMedia, createOffer
            → sendSignal mutation (type: "offer")
              → Callee: listSignals query fires, receives offer
              → Callee: setRemoteDescription, createAnswer
              → sendSignal mutation (type: "answer")
              → ICE candidates exchanged via sendSignal (type: "ice-candidate")
            → ontrack fires → remoteStream set → video/audio plays
          → Either party taps End
            → endCall mutation → status: "ended"
            → call message callStatus updated
            → signals deleted
        → [Decline] → declineCall mutation → modal dismisses
      → 45s timeout (no answer) → markMissedIfUnanswered → status: "missed"
```

### Push Notification Flow
```
sendMessage mutation (server)
  → ctx.scheduler.runAfter(0, internal.push.sendPushNotification, { chatId, senderId, messageContent })
    → getPushTokensForChat query: fetch tokens of all recipients except sender
    → POST https://exp.host/--/api/v2/push/send
      → { title: senderName, body: messageContent, data: { chatId } }
    → Device receives notification
      → usePushNotifications: addNotificationResponseReceivedListener
        → router.push('/chat/<chatId>')
```

### Image Upload Flow
```
ChatScreen → tap image button
  → expo-image-picker (native crop UI)
    → generateUploadUrl mutation → signed POST URL returned
    → fetch(url, { method: 'POST', body: imageBlob })
    → response → { storageId }
    → sendMessage({ type: 'image', fileId: storageId, content: captionText })
      → message inserted with fileId
        → getMessages query: ctx.storage.getUrl(fileId) → signed download URL
        → MessageBubble renders <Image source={{ uri: url }} />
```

### QR / Discovery Flow
```
ProfileScreen
  → QR code value = "chatapp://user/<userId>"
  → Share button → Share.share({ url: "https://<site>/add?id=<userId>" })
    → recipient opens URL → HTML page with deep link button
      → chatapp://user/<userId> opens app
        → /user/[id] handler → getOrCreateChat mutation
          → router.replace('/chat/<chatId>')

  OR

  → "Scan QR" button → router.push('/scan')
    → ScanScreen: CameraView (QR mode)
      → barcode detected → parse "chatapp://user/<scannedUserId>"
        → getOrCreateChat(myUserId, scannedUserId)
          → router.replace('/chat/<chatId>')
```

### Onboarding Flow
```
app launch → UserProvider: load userId from expo-secure-store
  → null → app/index.tsx → router.replace('/onboarding')
    → OnboardingScreen
      → Android: useDeviceProfileId() → getUsersByDeviceId
        → existing profiles found → show "Welcome back" restore UI
          → [Continue] → setUserId(existing.userId) → saves to secure-store → /(tabs)/chats
          → [New profile] → show name input form
        → no profiles → show name input form
      → user types name → [Continue]
        → createUser({ userId: uuid.v4(), name, deviceId }) mutation
        → setUserId(newUserId) → saves to secure-store
        → router.replace('/(tabs)/chats')
```

---

## 10. State Management

| State | Location | Storage | Scope |
|-------|----------|---------|-------|
| `userId` | `UserContext` | `expo-secure-store` | Global, persisted |
| `themeName` / `colors` | `ThemeContext` | `expo-secure-store` | Global, persisted |
| Server data (chats, messages, calls) | Convex reactive queries | Convex cloud DB | Server, real-time |
| UI state (input text, modal open, reply target) | `useState` in component | Memory | Local, ephemeral |
| WebRTC streams & connection | `useCallSession` | Memory | Call lifecycle |

No Redux or Zustand. State is either persisted context, server-reactive, or component-local.

---

## 11. Key Hooks

### `useCallSession` — `hooks/useCallSession.ts`
Manages the full WebRTC lifecycle for a call.

| Export | Type | Description |
|--------|------|-------------|
| `localStream` | MediaStream \| null | Own camera/mic |
| `remoteStream` | MediaStream \| null | Other party's stream |
| `connectionState` | string | idle / starting / ringing / connecting / connected / failed / ended |
| `isMuted` | boolean | Microphone state |
| `isCameraOff` | boolean | Camera state |
| `isSpeakerOn` | boolean | Speaker routing |
| `stop()` | fn | Cleanup: close peer connection, stop tracks |
| `toggleMicrophone()` | fn | Mute/unmute |
| `toggleCamera()` | fn | Camera on/off |
| `toggleSpeaker()` | fn | Speaker/earpiece |

STUN server: `stun:stun.l.google.com:19302`

---

### `usePushNotifications` — `hooks/usePushNotifications.ts`
Registers for Expo push notifications and routes taps to the correct screen.

- On mount: `registerForPushNotificationsAsync()` → returns `expoPushToken`
- Caller must save token: `updatePushToken(userId, expoPushToken)`
- Notification tap → reads `data.callId` or `data.chatId` → `router.push(...)`
- Android: sets up notification channel with vibration + light

---

### `useDeviceProfile` — `hooks/useDeviceProfile.ts`

| Export | Purpose |
|--------|---------|
| `getDeviceProfileId()` | Returns Android device ID (async) |
| `useDeviceProfileId()` | Hook version with state |
| `useLinkCurrentDeviceToUser()` | Calls `updateDeviceId` mutation on mount |

---

### `useAppTheme` — from `store/ThemeContext.tsx`

| Export | Type |
|--------|------|
| `themeName` | `'light' \| 'dark'` |
| `setThemeName(name)` | Persists to secure-store |
| `colors` | Color object from `constants/theme.ts` |
| `isLoading` | boolean |

---

## 12. Theme System

**Definitions:** `constants/theme.ts`
Two theme objects: `AppTheme.light` and `AppTheme.dark`

| Key Colors | Light | Dark |
|------------|-------|------|
| Primary (green) | `#00A884` | `#00A884` |
| Background | `#FFFFFF` | `#0B141A` |
| Surface | `#F0F2F5` | `#1A2530` |
| Text primary | `#111B21` | `#E9EDEF` |
| Text secondary | `#667781` | `#8696A0` |

**Flow:**
1. `ThemePreferenceProvider` loads `'themePreference'` from `expo-secure-store`
2. `useAppTheme()` returns `colors` object based on current theme
3. Every screen and component reads colors from `useAppTheme()` — no hardcoded color values
4. Navigation theme built dynamically in `AppShell` and injected into `ThemeProvider`

---

## 13. Feature Tracker

Update this table when a feature is added, changed, or removed.

| Feature | Status | Notes |
|---------|--------|-------|
| Chat list (search, unread dots) | Done | `app/(tabs)/chats.tsx` |
| 1-1 messaging (text) | Done | `app/chat/[id].tsx` |
| Image messages + upload | Done | Convex storage, expo-image-picker |
| Reply / quote message | Done | `replyToId` field, swipe gesture |
| Edit message (10-min window) | Done | Text only |
| Delete message | Not implemented | — |
| Read receipts (blue ticks) | Done | `deliveryStatus` from `getMessages` |
| Typing indicator | Not implemented | — |
| Audio call (WebRTC) | Done | `hooks/useCallSession.ts` |
| Video call (WebRTC) | Done | RTCView local + remote streams |
| Incoming call modal | Done | `components/IncomingCallModal.tsx` |
| Call missed timeout (45s) | Done | Convex scheduler |
| Push notifications (messages) | Done | Expo push API |
| Push notifications (calls) | Done | Expo push API |
| QR code profile sharing | Done | `app/(tabs)/profile.tsx` |
| QR scanner (add contact) | Done | `app/scan.tsx` |
| Deep link `chatapp://user/<id>` | Done | `app/user/[id].tsx` |
| Web share link (`/add?id=`) | Done | `convex/http.ts` |
| Profile restore (device ID) | Done | Android only |
| Chat archive (delete for me) | Done | `chatArchives` table |
| Light / dark theme | Done | `constants/theme.ts`, ThemeContext |
| Android APK update check | Done | `appConfig` table, NativeUpdatePrompt |
| Group chat | Not implemented | Schema is 1-1 only |
| Message reactions | Not implemented | — |
| Message search | Not implemented | Search is by contact name only |
| Voice messages | Not implemented | — |
| Profile avatar upload | Not implemented | `avatarUrl` field exists in schema |
