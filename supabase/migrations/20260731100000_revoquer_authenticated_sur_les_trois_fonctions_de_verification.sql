-- ═══════════════════════════════════════════════════════════════════════════
-- S1 — Les trois fonctions de verification ne sont plus executables par
--      `authenticated`. Il ne reste que `service_role` (et `postgres`).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- MOTIF
--
-- `verifier_document(text)`, `verifier_attestation(text)` et
-- `verifier_attestation_attribution(text)` sont SECURITY DEFINER, propriete de
-- `postgres`, et leur corps ne contient NI `auth.uid`, NI `est_admin`, NI de
-- `raise ... 42501` : elles n'ont AUCUNE garde. Elles rendent, sur simple
-- reference, l'etat courant d'un document et le nom du proprietaire ACTUEL.
--
-- Mesure du 31/07/2026 (`pg_proc.proacl`, seule source qui ne mente pas) :
--
--   verifier_document(text)                 postgres=X | authenticated=X | service_role=X
--   verifier_attestation(text)              postgres=X | authenticated=X | service_role=X
--   verifier_attestation_attribution(text)  postgres=X | authenticated=X | service_role=X
--
-- Or le grant `authenticated` n'a AUCUN appelant :
--
--   * dans le depot, le seul appel est `supabase/functions/verification-qr/
--     index.ts:116` — `supabase.rpc("verifier_document", { p_ref: ref })` —
--     et ce client est construit avec la cle `service_role` ;
--   * en base, aucune policy RLS ne les cite (`pg_policies` : 0 resultat) ;
--   * aucune autre fonction SQL de `public` ne les cite, SAUF
--     `verifier_document` elle-meme, qui aiguille vers les deux autres.
--
-- ⭐ CE DERNIER POINT EST CE QUI REND LE RETRAIT SUR. `verifier_document` est
-- SECURITY DEFINER : a l'interieur de son corps, l'utilisateur effectif est
-- son proprietaire `postgres`, et c'est contre LUI que le droit d'EXECUTE des
-- deux fonctions appelees est verifie. Retirer `authenticated` ne peut donc
-- pas casser l'aiguillage interne. Verifie apres coup par un appel reel.
--
-- Conserve tant qu'un `authenticated` peut l'atteindre, ce grant est le
-- chemin par lequel un cedant titulaire d'un compte — ou n'importe quel
-- titulaire de compte — obtient le nom du proprietaire ACTUEL d'un bien a
-- partir de la seule reference d'un acte qu'il detient encore. C'est
-- exactement ce que l'arbitrage du proprietaire du projet ferme.
--
-- CE QUE CELA NE FERME PAS, ET VOLONTAIREMENT (arbitrage 2 du 29/07/2026) :
-- l'historique public nominatif reste ouvert par le QR public, qui passe par
-- l'edge function `verification-qr` en `service_role`. Le present retrait ne
-- retire donc aucun service au public ; il retire un raccourci SQL direct.

revoke execute on function public.verifier_document(text)                from authenticated;
revoke execute on function public.verifier_attestation(text)             from authenticated;
revoke execute on function public.verifier_attestation_attribution(text) from authenticated;

-- Regle permanente §5 bis ① : le defaut du moteur accorde EXECUTE a PUBLIC,
-- et un `revoke ... from anon` seul paraitrait reussir sans rien fermer. On
-- ferme les deux nommement, meme si la mesure du jour ne montre ni PUBLIC ni
-- `anon` dans ces trois ACL — pour que l'intention reste lisible et qu'une
-- reecriture ulterieure ne les rouvre pas par inadvertance.
revoke execute on function public.verifier_document(text)                from public, anon;
revoke execute on function public.verifier_attestation(text)             from public, anon;
revoke execute on function public.verifier_attestation_attribution(text) from public, anon;

-- Le seul appelant legitime, explicitement reaffirme.
grant execute on function public.verifier_document(text)                to service_role;
grant execute on function public.verifier_attestation(text)             to service_role;
grant execute on function public.verifier_attestation_attribution(text) to service_role;

comment on function public.verifier_document(text) is
  'Verification publique d''un document par reference. SECURITY DEFINER SANS GARDE : elle rend le proprietaire ACTUEL a quiconque peut l''appeler. Reservee a `service_role` depuis le 31/07/2026 — son unique appelant est l''edge function `verification-qr`. Ne PAS la re-accorder a `authenticated` : c''etait le chemin par lequel un cedant obtenait le nom de son successeur.';

comment on function public.verifier_attestation(text) is
  'Idem `verifier_document` : SECURITY DEFINER sans garde, reservee a `service_role` depuis le 31/07/2026. Appelee en interne par `verifier_document`, ce qui reste possible car l''utilisateur effectif y est `postgres`.';

comment on function public.verifier_attestation_attribution(text) is
  'Idem `verifier_document` : SECURITY DEFINER sans garde, reservee a `service_role` depuis le 31/07/2026. Appelee en interne par `verifier_document`, ce qui reste possible car l''utilisateur effectif y est `postgres`.';
