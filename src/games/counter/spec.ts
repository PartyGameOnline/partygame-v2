import type { GameSpec } from "../../engine/types";

export type CounterState = { value: number };
export type CounterEvent =
  | { type: "inc"; by?: number }
  | { type: "dec"; by?: number }
  | { type: "reset" };

export const CounterSpec: GameSpec<CounterState, CounterEvent> = {
  initialState: (): CounterState => ({ value: 0 }),
  reduce: (s: Readonly<CounterState>, e: CounterEvent): CounterState => {
    switch (e.type) {
      case "inc":
        return { value: s.value + (e.by ?? 1) };
      case "dec":
        return { value: s.value - (e.by ?? 1) };
      case "reset":
        return { value: 0 };
      default:
        return s;
    }
  },
  validate: (s: CounterState): void => {
    if (!Number.isFinite(s.value)) throw new Error("value must be finite number");
  },
};

export const counterSpec = CounterSpec;
export default CounterSpec;
