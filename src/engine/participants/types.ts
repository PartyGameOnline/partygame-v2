export type ParticipantRole = "host" | "member";

export type Participant = {
  id: string; // = clientId
  name: string;
  role: ParticipantRole;
  ready: boolean;
  joinedAt: number;
  lastSeenAt: number;
  online: boolean;
};

export type ParticipantsState = {
  roomCode: string | null;
  closed: boolean; // 全員退出でtrue
  hostId: string | null;
  byId: Record<string, Participant>;
  order: string[]; // join順
};

export type ParticipantsEvent =
  | { type: "room/open"; roomCode: string; at: number }
  | { type: "room/close"; at: number }
  | { type: "participants/join"; id: string; name: string; at: number }
  | { type: "participants/leave"; id: string; at: number }
  | { type: "participants/setName"; id: string; name: string; at: number }
  | { type: "participants/setReady"; id: string; ready: boolean; at: number }
  | { type: "participants/heartbeat"; id: string; at: number }
  | { type: "participants/kick"; id: string; at: number }
  | { type: "participants/transferHost"; toId: string; at: number };
