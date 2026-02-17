import CounterView from "../../../games/counter/CounterView";

export default function CounterRoomPage({ params }: { params: { room: string } }) {
  return <CounterView roomCode={params.room} />;
}
