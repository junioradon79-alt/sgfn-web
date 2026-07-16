import { createClient } from "@supabase/supabase-js";
import LotissementDetailClient from "./LotissementDetailClient";

// Export statique (output: 'export') : chaque route [id] doit être connue au
// moment du build. Lecture anonyme directe (lotissements_public_read est déjà
// en lecture publique, cf. score de confiance/passeport parcelle), pas besoin
// de session — cette fonction ne s'exécute qu'au build, jamais côté client.
export async function generateStaticParams() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.from("lotissements").select("id");
  return (data ?? []).map((l) => ({ id: l.id as string }));
}

export default function LotissementDetailPage() {
  return <LotissementDetailClient />;
}
