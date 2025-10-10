import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Hello world</h1>
      <p>
        <Link href="/counter">→ Counter Demo へ</Link>
      </p>
    </main>
  );
}
