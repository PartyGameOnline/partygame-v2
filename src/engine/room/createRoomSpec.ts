import type { GameSpec } from "../types";
import { participantsSpec } from "../participants/participantsSpec";
import type { RoomEvent, RoomState } from "./types";

export function createRoomSpec<G, GE>(
  gameSpec: GameSpec<G, GE>
): GameSpec<RoomState<G>, RoomEvent<GE>> {
  return {
    initialState: () => ({
      participants: participantsSpec.initialState(),
      game: gameSpec.initialState(),
    }),

    reduce: (state, ev) => {
      // participants / room 系イベント
      if (ev.type !== "game") {
        return {
          ...state,
          participants: participantsSpec.reduce(state.participants, ev),
        };
      }

      // gameイベント
      return {
        ...state,
        game: gameSpec.reduce(state.game, ev.event),
      };
    },

    validate: (s) => {
      // participants のvalidate
      if (participantsSpec.validate) participantsSpec.validate(s.participants);

      // game のvalidate
      if (gameSpec.validate) gameSpec.validate(s.game);
    },
  };
}
