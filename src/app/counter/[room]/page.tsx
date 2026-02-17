import CounterView from "@/games/counter/CounterView";

type PageProps = {
  params: Promise<{ room: string }>;
};

export default async function Page({ params }: PageProps) {
  const { room } = await params;
  return <CounterView roomCode={room} />;
}
