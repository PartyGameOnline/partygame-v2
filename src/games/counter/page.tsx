import CounterView from "../../games/counter/CounterView";

export default function Page({ searchParams }: { searchParams: { room?: string } }) {
  const roomCode =
    typeof searchParams?.room === "string" && searchParams.room.length > 0
      ? searchParams.room
      : undefined;

  return <CounterView roomCode={roomCode} />;
}
