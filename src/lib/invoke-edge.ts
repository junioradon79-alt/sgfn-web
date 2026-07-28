/**
 * Invocation d'une edge function dont le motif d'erreur atteint réellement
 * l'écran.
 *
 * Le piège corrigé ici (dette #23 du document directeur) : sur une réponse
 * non-2xx, `supabase.functions.invoke` ne remplit PAS `data`. Il le laisse à
 * `null` et range la réponse dans `error.context`. Le réflexe naturel —
 *
 *     if (res.error || res.data?.error) setMessage(res.data?.error ?? "Erreur.")
 *
 * — retombe donc TOUJOURS sur le repli générique dès que le serveur répond en
 * erreur, c'est-à-dire précisément quand son message avait de la valeur. Un
 * agrégateur non configuré devenait « Erreur lors de l'initialisation du
 * paiement. » : l'utilisateur ne pouvait pas savoir que rien ne clochait de son
 * côté.
 *
 * Le repli reste indispensable : une panne réseau ou un corps non-JSON ne
 * portent aucun message exploitable. Mais il redevient ce qu'il aurait dû
 * toujours être — le dernier recours, pas le cas courant.
 *
 * Même intention que `invokeFn` dans monterrain-web (`src/lib/pass.ts`), qui
 * avait déjà résolu le problème de son côté ; ce module en est le pendant, avec
 * une signature `{ data, error }` alignée sur celle des appels existants.
 */

/**
 * Contrat structurel minimal, plutôt que le `SupabaseClient<Database>` complet :
 * le helper n'a besoin que de `functions.invoke`, et s'en tenir là évite de
 * traîner le générique `Database` dans chaque appelant.
 */
interface ClientAvecFonctions {
  functions: {
    invoke: (
      nom: string,
      options: { body: Record<string, unknown> },
    ) => Promise<{ data: unknown; error: unknown }>;
  };
}

export interface ResultatEdge<T> {
  /** `null` dès qu'une erreur est remontée, quelle qu'en soit l'origine. */
  data: T | null;
  /** Message prêt à afficher tel quel, ou `null` si tout s'est bien passé. */
  error: string | null;
}

/** Les fonctions du projet répondent `{ error }` ; `analyser-document-ia` dit `{ erreur }`. */
function messageDuCorps(corps: unknown): string | null {
  if (!corps || typeof corps !== "object") return null;
  const c = corps as { error?: unknown; erreur?: unknown };
  for (const valeur of [c.error, c.erreur]) {
    if (typeof valeur === "string" && valeur.trim()) return valeur.trim();
  }
  return null;
}

/**
 * Extrait le message que le serveur a réellement envoyé, en lisant la `Response`
 * cachée dans `error.context`.
 */
async function messageDuServeur(erreur: unknown): Promise<string | null> {
  const contexte = (erreur as { context?: unknown } | null)?.context;
  if (!contexte || typeof contexte !== "object") return null;

  const reponse = contexte as Response;
  if (typeof reponse.json !== "function") return null;

  // Le corps d'une Response ne se lit qu'UNE fois. On travaille sur une copie
  // pour garder l'original intact et pouvoir retomber sur `.text()` si la
  // fonction a répondu autre chose que du JSON (crash Deno, page d'erreur de la
  // plateforme…).
  const copie = typeof reponse.clone === "function" ? reponse.clone() : reponse;

  let corpsEtaitDuJson = false;
  try {
    const json = await copie.json();
    corpsEtaitDuJson = true;
    const message = messageDuCorps(json);
    if (message) return message;
  } catch {
    /* corps non JSON — on tente le texte brut ci-dessous */
  }

  // Si le corps était du JSON mais sans message exploitable, le relire en texte
  // ne rendrait que le JSON brut — soit un dump technique (`{"code":42}`) sous
  // les yeux de l'utilisateur. On s'arrête ici pour laisser jouer le repli.
  if (corpsEtaitDuJson) return null;

  try {
    const texte = (await reponse.text()).trim();
    // Une trace technique ou un dump HTML n'a rien à faire sous les yeux de
    // l'utilisateur : on ne remonte que ce qui ressemble à une phrase.
    if (texte && texte.length <= 200 && !texte.startsWith("<")) return texte;
  } catch {
    /* corps déjà consommé ou illisible */
  }

  return null;
}

/**
 * @param repli message affiché quand le serveur n'en fournit aucun d'exploitable.
 */
export async function invokeEdge<T = unknown>(
  client: ClientAvecFonctions,
  nom: string,
  corps: Record<string, unknown>,
  repli: string,
): Promise<ResultatEdge<T>> {
  let reponse: { data: unknown; error: unknown };
  try {
    reponse = await client.functions.invoke(nom, { body: corps });
  } catch {
    // `invoke` peut lever au lieu de renvoyer (coupure réseau, CORS).
    return { data: null, error: repli };
  }

  if (reponse.error) {
    return { data: null, error: (await messageDuServeur(reponse.error)) ?? repli };
  }

  // Une fonction peut répondre 200 en signalant un échec métier dans le corps.
  const metier = messageDuCorps(reponse.data);
  if (metier) return { data: null, error: metier };

  return { data: reponse.data as T, error: null };
}
