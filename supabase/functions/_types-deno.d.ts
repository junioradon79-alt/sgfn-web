// =====================================================================
//  DECLARATIONS MINIMALES POUR LE TYPAGE DES EDGE FUNCTIONS
//
//  ── Pourquoi ce fichier existe (dette #49, 10/08/2026) ───────────────
//  `tsconfig.json` porte `"exclude": [..., "supabase/functions/**/*.ts"]`.
//  Consequence, mesuree par un verificateur tiers : `npx tsc --noEmit`
//  analyse 908 fichiers et AUCUN des edge functions. Un correctif de
//  securite de plusieurs centaines de lignes a ete livre en annoncant
//  « tsc exit 0 » — un vert qui ne portait sur rien.
//
//  Les edge functions tournent sous Deno et importent par URL ; le
//  `tsconfig` de Next ne sait resoudre ni l'un ni l'autre, d'ou
//  l'exclusion d'origine, qui etait un choix raisonnable. Ce fichier ne
//  la remet pas en cause : il fournit le strict necessaire pour qu'un
//  SECOND tsconfig (`tsconfig.edge.json`) puisse verifier les fonctions
//  qui portent la garde de chemin.
//
//  ⚠️ CE SHIM N'EST PAS LE VRAI TYPAGE DE supabase-js. Il decrit
//  exactement les appels que `telecharger-document` et
//  `convertir-plan-cad` effectuent, et rien de plus. L'elargir a d'autres
//  fonctions demandera de l'etendre, et c'est voulu : un shim trop
//  permissif rendrait le typage aussi vide que l'exclusion qu'il remplace.
//
//  ── CE QU'IL ATTRAPE REELLEMENT ──────────────────────────────────────
//   · une methode mal orthographiee ou une arite fausse ;
//   · une valeur `string | null` passee la ou une `string` est attendue —
//     c'est ce qui a fait apparaitre, des sa premiere execution, le
//     `.download(docRow.url_fichier)` non narrowe de `convertir-plan-cad` ;
//   · une colonne inexistante lue sur une ligne de `documents`, grace a
//     la surcharge `from("documents")` ci-dessous.
//
//  ── 🔴 CETTE DERNIERE PROMESSE A D'ABORD ETE ECRITE FAUSSE ───────────
//  La premiere redaction annoncait deja « une colonne lue sur un objet
//  qui ne la porte pas ». C'etait faux : `from()` rendait
//  `Requete<Record<string, string | null>>`, dans lequel TOUTE cle est
//  valide — le verificateur a montre que `docRow.colonne_qui_nexiste_pas`
//  compilait sans broncher. La promesse a ete rendue VRAIE (surcharge
//  `from("documents")` + `LigneDocuments`) plutot que retiree, parce
//  qu'elle etait tenable a peu de frais. Un commentaire faux est pire
//  qu'aucun commentaire : c'est exactement ce qui venait de se passer
//  avec la justification ACL de la migration.
//
//  ⚠️ La promesse ne vaut QUE pour `from("documents")`. Les autres tables
//  passent par la signature generale et restent permissives : leurs
//  colonnes ne sont pas connues du shim, et pretendre le contraire
//  reintroduirait le meme mensonge.
// =====================================================================

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  env: { get(nom: string): string | undefined };
};

/**
 * `generation-document` importe le generateur de QR par specificateur Deno
 * (`npm:qrcode`). Seule la surface REELLEMENT appelee est decrite ; le
 * reste de la bibliotheque ne l'est pas, et ne doit pas l'etre.
 */
declare module "npm:qrcode" {
  const QRCode: {
    toString(donnees: string, options?: Record<string, unknown>): Promise<string>;
    toDataURL(donnees: string, options?: Record<string, unknown>): Promise<string>;
  };
  export default QRCode;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  /** Reponse PostgREST : `data` est nul des que `error` ne l'est pas. */
  interface Reponse<T> {
    data: T | null;
    error: { message: string } | null;
  }

  /**
   * Une requete PostgREST est CHAINABLE puis AWAITABLE.
   *
   * `PromiseLike<Reponse<T[]>>` : `await requete` rend une LISTE — c'est ce
   * qui permet a `maj.data?.length` d'etre type apres
   * `.update(...).select("id")`. `single()`/`maybeSingle()` rendent au
   * contraire UNE ligne. Cette distinction n'est pas cosmetique : c'est
   * elle qui fait la difference entre « 0 ligne mise a jour, il faut
   * inserer » et « la ligne existe », c'est-a-dire entre une ligne par
   * chemin et une ligne par generation (les 57 doublons du 10/08).
   */
  interface Requete<T> extends PromiseLike<Reponse<T[]>> {
    select(colonnes?: string, options?: { count?: string; head?: boolean }): Requete<T>;
    eq(colonne: string, valeur: unknown): Requete<T>;
    neq(colonne: string, valeur: unknown): Requete<T>;
    is(colonne: string, valeur: unknown): Requete<T>;
    in(colonne: string, valeurs: readonly unknown[]): Requete<T>;
    gte(colonne: string, valeur: unknown): Requete<T>;
    lte(colonne: string, valeur: unknown): Requete<T>;
    order(colonne: string, options?: { ascending?: boolean }): Requete<T>;
    limit(n: number): Requete<T>;
    update(valeurs: Record<string, unknown>): Requete<T>;
    insert(valeurs: Record<string, unknown>): Requete<T>;
    upsert(valeurs: Record<string, unknown>, options?: { onConflict?: string }): Requete<T>;
    delete(): Requete<T>;
    maybeSingle(): Promise<Reponse<T>>;
    single(): Promise<Reponse<T>>;
  }

  interface Bucket {
    createSignedUrl(chemin: string, secondes: number): Promise<Reponse<{ signedUrl: string }>>;
    download(chemin: string): Promise<Reponse<Blob>>;
    upload(
      chemin: string,
      contenu: Uint8Array | Blob,
      options?: { contentType?: string; upsert?: boolean },
    ): Promise<Reponse<unknown>>;
    remove(chemins: string[]): Promise<Reponse<unknown>>;
  }

  /**
   * Les colonnes de `public.documents` que les deux fonctions lisent.
   * Relevees en base le 10/08/2026 : `url_fichier` est NOT NULL en base
   * mais reste `string | null` ici, parce que c'est ce que PostgREST rend
   * quand la colonne n'est pas dans le `select()` — et c'est precisement
   * ce narrowing manquant qui a ete attrape sur `.download()`.
   */
  interface LigneDocuments {
    id: string;
    type: string;
    url_fichier: string | null;
    apercu_url: string | null;
  }

  /**
   * Valeur d'une colonne d'une table NON decrite par ce shim.
   *
   * 🔴 C'est le seul `any` du fichier, et il est ici plutot que partout.
   * Une ligne PostgREST reelle porte des nombres, des booleens, des dates
   * et des objets imbriques (les jointures `lots(...)`), pas seulement des
   * chaines. Un type plus etroit produisait cinq erreurs fausses dans
   * `generation-document` — « string n'est pas assignable a number » sur
   * des colonnes qui SONT des nombres — et la reponse aurait ete de semer
   * des casts dans le code livre, ce qui est pire que d'assumer un `any`
   * localise dans un shim.
   *
   * Ce que ca COUTE, dit franchement : sur les tables autres que
   * `documents`, ce shim ne verifie NI le nom des colonnes NI leur type.
   * Il ne reste que le typage des methodes et de leur chainage.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type ValeurColonne = any;

  interface Client {
    // La surcharge nommee d'abord : elle rend la promesse « une colonne
    // inexistante est une erreur » VRAIE pour la table qui porte la garde.
    from(table: "documents"): Requete<LigneDocuments>;
    // Les autres tables : leurs colonnes ne sont pas connues du shim, et
    // les lignes lues portent ce que la chaine passee a `select()` decide.
    // TypeScript ne peut pas les deduire sans generer les types de la base.
    from(table: string): Requete<Record<string, ValeurColonne>>;
    rpc(fonction: string, params?: Record<string, unknown>): Requete<Record<string, ValeurColonne>>;
    storage: { from(bucket: string): Bucket };
  }

  export function createClient(
    url: string,
    cle: string,
    options?: { global?: { headers?: Record<string, string> } },
  ): Client;
}
