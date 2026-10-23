import { config } from "@/config";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-3xl font-bold">{config.restaurant.name}</h1>
    </main>
  );
}
