import type { ParticipantsEvent, ParticipantsState } from "../participants/types";

export type RoomState<G> = {
  participants: ParticipantsState;
  game: G;
};

export type RoomEvent<GE> = ParticipantsEvent | { type: "game"; event: GE }; // ★ゲームイベントは必ずラップして衝突回避
