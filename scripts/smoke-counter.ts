import { GameEngine } from "../src/engine/GameEngine";
import { CounterSpec, type CounterEvent, type CounterState } from "../src/games/counter/spec";

const engine = new GameEngine<CounterState, CounterEvent>(CounterSpec);

const unsubscribe = engine.subscribe((s: Readonly<CounterState>) => {
  console.log("state =>", s);
});

const events: CounterEvent[] = [
  { type: "inc" },
  { type: "inc", by: 5 },
  { type: "reset" },
  { type: "inc", by: 2 },
  { type: "dec" },
];

for (const e of events) engine.dispatch(e);
unsubscribe();
