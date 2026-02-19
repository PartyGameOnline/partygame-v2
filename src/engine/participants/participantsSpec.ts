import type { GameSpec } from "../types";
import type { Participant, ParticipantsEvent, ParticipantsState } from "./types";

const ONLINE_TIMEOUT_MS = 20_000; // 表示上のオンライン判定用(目安)

function isOnline(p: Participant, at: number) {
  return at - p.lastSeenAt <= ONLINE_TIMEOUT_MS;
}

function pickHostId(state: ParticipantsState, at: number): string | null {
  // order順で「まだ在室中」かつオンライン扱いを優先
  for (const id of state.order) {
    const p = state.byId[id];
    if (!p) continue;
    if (p.online || isOnline(p, at)) return id;
  }
  // 全員offlineなら order先頭(在室中)をhostにする
  for (const id of state.order) {
    if (state.byId[id]) return id;
  }
  return null;
}

function closeIfEmpty(state: ParticipantsState): ParticipantsState {
  if (state.closed) return state;
  const count = Object.keys(state.byId).length;
  if (count > 0) return state;
  return { ...state, closed: true, hostId: null };
}

export const participantsSpec: GameSpec<ParticipantsState, ParticipantsEvent> = {
  initialState: () => ({
    roomCode: null,
    closed: false,
    hostId: null,
    byId: {},
    order: [],
  }),

  reduce: (state, ev) => {
    // closed後はroom/open以外を無視（読み取り専用状態）
    if (state.closed && ev.type !== "room/open") return state;

    switch (ev.type) {
      case "room/open": {
        if (state.roomCode && state.roomCode !== ev.roomCode) {
          // roomCodeが変わる用途は想定しない
          return state;
        }
        return { ...state, roomCode: ev.roomCode, closed: false };
      }

      case "room/close": {
        return { ...state, closed: true, hostId: null };
      }

      case "participants/join": {
        const existing = state.byId[ev.id];
        if (existing) {
          // 再join: lastSeen更新 + online化 + 名前更新(任意)
          const updated: Participant = {
            ...existing,
            name: ev.name ?? existing.name,
            lastSeenAt: ev.at,
            online: true,
          };
          return { ...state, byId: { ...state.byId, [ev.id]: updated } };
        }

        const isFirst = Object.keys(state.byId).length === 0;
        const role: Participant["role"] = isFirst ? "host" : "member";
        const p: Participant = {
          id: ev.id,
          name: ev.name,
          role,
          ready: false,
          joinedAt: ev.at,
          lastSeenAt: ev.at,
          online: true,
        };

        const byId = { ...state.byId, [ev.id]: p };
        const order = state.order.includes(ev.id) ? state.order : [...state.order, ev.id];

        const hostId = state.hostId ?? (isFirst ? ev.id : null);
        return { ...state, byId, order, hostId: hostId ?? state.hostId ?? ev.id };
      }

      case "participants/leave": {
        if (!state.byId[ev.id]) return state;

        const { [ev.id]: _removed, ...rest } = state.byId;
        let next: ParticipantsState = { ...state, byId: rest };

        // hostが抜けたら引き継ぎ
        if (state.hostId === ev.id) {
          const hostId = pickHostId(next, ev.at);
          next = { ...next, hostId };
          // role更新
          if (hostId && next.byId[hostId]) {
            next = {
              ...next,
              byId: {
                ...next.byId,
                [hostId]: { ...next.byId[hostId], role: "host" },
              },
            };
          }
        }

        // 全員退出で解散
        return closeIfEmpty(next);
      }

      case "participants/kick": {
        // kick = leave と同等
        return participantsSpec.reduce(state, { type: "participants/leave", id: ev.id, at: ev.at });
      }

      case "participants/setName": {
        const p = state.byId[ev.id];
        if (!p) return state;
        return { ...state, byId: { ...state.byId, [ev.id]: { ...p, name: ev.name } } };
      }

      case "participants/setReady": {
        const p = state.byId[ev.id];
        if (!p) return state;
        return { ...state, byId: { ...state.byId, [ev.id]: { ...p, ready: ev.ready } } };
      }

      case "participants/heartbeat": {
        const p = state.byId[ev.id];
        if (!p) return state;
        const updated: Participant = { ...p, lastSeenAt: ev.at, online: true };
        return { ...state, byId: { ...state.byId, [ev.id]: updated } };
      }

      case "participants/transferHost": {
        if (!state.byId[ev.toId]) return state;
        const prevHost = state.hostId;
        const byId = { ...state.byId };

        if (prevHost && byId[prevHost]) byId[prevHost] = { ...byId[prevHost], role: "member" };
        byId[ev.toId] = { ...byId[ev.toId], role: "host" };

        return { ...state, hostId: ev.toId, byId };
      }

      default:
        return state;
    }
  },

  validate: (s) => {
    if (s.closed) {
      // closedなら参加者が残っていても良い(ログ閲覧用途)が、hostはnullに寄せる
      return;
    }

    // roomCodeは open 済みなら非null推奨（必須化したいならここでthrow）
    if (s.hostId !== null && !s.byId[s.hostId]) {
      throw new Error("participantsSpec.validate: hostId not in byId");
    }

    // role整合性(最低限)
    if (s.hostId && s.byId[s.hostId]?.role !== "host") {
      throw new Error("participantsSpec.validate: host role mismatch");
    }
  },
};
