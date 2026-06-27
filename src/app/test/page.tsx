import { supabase } from "@/lib/supabase";

export default async function TestPage() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .limit(5);

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">
        Test Supabase
      </h1>

      <pre className="mt-6 rounded bg-slate-100 p-4">
        {JSON.stringify({ data, error }, null, 2)}
      </pre>
    </main>
  );
}