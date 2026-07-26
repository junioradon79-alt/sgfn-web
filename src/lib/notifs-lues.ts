// État de lecture des notifications — stocké **sur l'appareil**.
//
// La table `notifications` n'a pas de colonne `lu` et son RLS (`notif_read`)
// n'accorde que le SELECT : c'est une file d'expédition WhatsApp/e-mail, pas
// une boîte de réception. Un accusé de lecture écrit en base échouerait, et le
// contourner (table annexe, colonne détournée) reviendrait à inventer un
// modèle de données pour un confort d'affichage. L'information vit donc là où
// elle a du sens pour l'utilisateur — son téléphone — en assumant qu'elle ne
// le suive pas d'un appareil à l'autre.
//
// La clé est **par utilisateur** : un même téléphone sert souvent à plusieurs
// comptes (un agent et un proche), et hériter de l'état de lecture d'autrui
// masquerait des notifications jamais vues.

const PREFIXE = "sgnf.notifs-lues.";

/**
 * Plafond du nombre d'identifiants conservés. Sans borne, la clé grossirait
 * indéfiniment au fil des années ; 200 couvre largement les 50 notifications
 * que la requête ramène, donc aucune notification affichable n'est oubliée.
 */
const MAX_IDS = 200;

const cle = (userId: string) => `${PREFIXE}${userId}`;

function lireIds(userId: string | null): string[] {
  if (!userId || typeof window === "undefined") return [];
  try {
    const brut = window.localStorage.getItem(cle(userId));
    if (!brut) return [];
    const parse: unknown = JSON.parse(brut);
    // Valeur corrompue ou écrite par une version antérieure : on repart de
    // zéro plutôt que de laisser un type inattendu remonter jusqu'à l'écran.
    if (!Array.isArray(parse)) return [];
    return parse.filter((v): v is string => typeof v === "string");
  } catch {
    // localStorage inaccessible (navigation privée, stockage bloqué) ou JSON
    // illisible : tout paraîtra non lu — le défaut le moins nuisible, on
    // sur-signale au lieu de masquer.
    return [];
  }
}

function ecrireIds(userId: string, ids: string[]): void {
  try {
    window.localStorage.setItem(cle(userId), JSON.stringify(ids));
  } catch {
    // Quota atteint ou stockage refusé : l'état de lecture ne survivra pas à
    // la session. Jamais bloquant — l'écran doit s'afficher quoi qu'il arrive.
  }
}

/** Identifiants déjà lus par cet utilisateur sur cet appareil. */
export function lireNotifsLues(userId: string | null): Set<string> {
  return new Set(lireIds(userId));
}

/**
 * Marque `ids` comme lus et renvoie l'ensemble résultant (à poser en état :
 * relire le stockage juste après une écriture qui a pu échouer donnerait un
 * affichage incohérent).
 */
export function marquerNotifsLues(userId: string | null, ids: string[]): Set<string> {
  const anciens = lireIds(userId);
  // Sans utilisateur, il n'y a pas de clé où écrire : on rend l'ensemble vide
  // sans rien persister, donc la pastille resterait allumée pour toujours.
  // Inatteignable aujourd'hui — `userId` et l'état connecté sont posés dans le
  // même lot, et les deux appelants ne montent qu'une fois la session établie —
  // mais l'écrire évite qu'un futur appel plus tôt dans le cycle de vie casse
  // silencieusement l'état de lecture.
  if (!userId) return new Set(anciens);
  const frais = new Set(ids);
  // Les identifiants qu'on vient de lire passent en tête : le plafond écarte
  // ainsi les plus anciens, ceux dont la notification a de toute façon quitté
  // la liste affichée.
  const fusion = [...ids, ...anciens.filter((id) => !frais.has(id))].slice(0, MAX_IDS);
  ecrireIds(userId, fusion);
  return new Set(fusion);
}
