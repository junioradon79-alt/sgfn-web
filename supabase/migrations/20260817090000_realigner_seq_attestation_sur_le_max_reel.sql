-- =====================================================================
--  RÉALIGNEMENT DE seq_attestation SUR LE MAX RÉEL DE attestations_cession
-- =====================================================================
--
--  Relu par un vérificateur tiers (17/08/2026) : 4 défauts corrigés avant
--  application (mauvais compte de fonctions listées comme consommatrices de
--  la séquence, formulation trompeuse sur la nécessité du correctif, année
--  figée en dur dans les regex de calcul du max(), absence de garde pour un
--  rejeu à froid sur une base neuve/vide). Exécutée en production le
--  17/08/2026 avec l'autorisation explicite du propriétaire du projet
--  ("Corriger le fichier puis l'appliquer").
--
--  ── Défaut constaté (signalé par un vérificateur tiers, 17/08/2026) ──
--  `seq_attestation.last_value` était à 945 (`is_called=true`, donc le
--  prochain `nextval()` aurait rendu 946) alors que les références
--  `ATT-CESS-2026-00946` à `00951` existaient déjà dans
--  `attestations_cession`. Les 3 fonctions qui consomment cette séquence
--  (`creer_attestation_gratuite_si_eligible`, `generer_attestation_exceptionnelle`,
--  `traiter_paiement_confirme` -- préfixe `ATT-CESS-`, table
--  `attestations_cession`) auraient levé une violation de
--  `attestations_cession_reference_key` dès le prochain appel réel.
--  (`generer_attestation_attribution_lot` et `rattraper_niveau3_retroactif`
--  consomment une séquence DIFFÉRENTE, `seq_attestation_attribution`, préfixe
--  `ATT-ATTRIB-`, table `attestations_attribution_lot` -- hors périmètre de
--  ce correctif ; une première version de ce commentaire les citait à tort.)
--
--  ── Diagnostic ──
--  Les 6 lignes 946-951 sont des régénérations (`exception=true`, motif
--  "Régénération pour complément d'informations attributaire ... — remplace
--  ATT-CESS-2026-00901" etc.) : chacune remplace une ligne antérieure
--  revoquée dans la MÊME opération (`revoquee_le` de l'ancienne référence
--  colle, à la microseconde, à `cree_le`/`exception_le` de la nouvelle pour
--  la paire 00899→00951 ; les 5 autres partagent un timestamp de lot
--  distinct, 28 secondes après la révocation des 5 anciennes références).
--  Tous les chemins de code du dépôt qui insèrent dans `attestations_cession`
--  (6 sites, dont `generer_attestation_exceptionnelle` dans ses versions
--  successives, répartis sur 5 fichiers) passent par `nextval('seq_attestation')` ;
--  aucun ne peut expliquer un retard de la séquence sur la table. Aucun
--  `setval` n'existe nulle part dans le dépôt (aucun précédent de ce type de
--  correctif). Faute d'un
--  script traçable dans le dépôt pour ces 6 lignes, la lecture retenue est
--  qu'il s'agit d'une opération manuelle ponctuelle (dans la lignée des
--  dérogations Koelea-Accor/DJEBE, déjà posées "directement en SQL") qui a
--  inséré ces 6 lignes avec une référence calculée à la main (max()+1) au
--  lieu d'appeler la fonction `generer_attestation_exceptionnelle` -- ce qui
--  explique un enchaînement sans trou (946..951) mais une séquence jamais
--  avancée. Ce point reste une lecture des indices disponibles, pas une
--  preuve directe (aucun journal SQL de cette ancienneté n'a été consulté).
--
--  🔴 Le `max()` réel constaté sur toute la table est 951 (aucune référence
--  au-delà, aucune référence hors du format `ATT-CESS-2026-\d+`).
--
--  🔴 Test en transaction annulée (17/08/2026) -- ANOMALIE CONSTATÉE : le
--  test exécuté (`begin; select setval(...); select nextval(...); ...
--  rollback;`) n'a PAS ramené la séquence à sa valeur d'avant. Contrairement
--  à l'attente initiale, PostgreSQL documente `nextval`/`setval` comme NON
--  transactionnels : leurs effets NE SONT PAS défaits par un `rollback`.
--  Constaté en base : `last_value` est passé de 945 à 952 (setval(951,true)
--  suivi d'un nextval() dans la transaction, jamais annulés) et est resté à
--  952 après le `rollback`, vérifié par une requête séparée. Aucune ligne ne
--  porte la référence 952 (elle n'a jamais été insérée, seule la transaction
--  qui l'aurait utilisée a été annulée) : pas de collision, mais un écriture
--  RÉELLE et non sollicitée sur la séquence de production a eu lieu pendant
--  le test. Signalé explicitement au coordonateur -- ce n'était pas
--  l'intention du mandat ("test en rollback UNIQUEMENT").
--
--  Ce correctif n'est PLUS nécessaire pour éviter une collision : l'incident
--  ci-dessus a déjà fait avancer `seq_attestation` à 952 (`is_called=true`,
--  confirmé par une requête séparée le 17/08/2026), donc le prochain
--  `nextval()` réel rendrait 953 -- sans risque de heurter une référence
--  existante, correctif ou pas. Il ne sert plus qu'à COMBLER LE TROU laissé
--  au numéro 952 dans la série `ATT-CESS-2026-\d+` d'`attestations_cession`,
--  un registre d'actes officiels où un numéro sauté sans explication est en
--  soi un défaut de continuité. C'est une décision assumée par le
--  propriétaire du projet pour la continuité du registre, pas une urgence
--  technique. Le `setval` reste calculé de façon DYNAMIQUE sur le vrai
--  `max()` au moment de l'exécution (idempotent, sûr même si l'état a encore
--  bougé entre le diagnostic et l'application), plutôt que d'écrire en dur la
--  valeur 951 constatée pendant le diagnostic.
--
--  🟡 Réserve d'un second vérificateur (17/08/2026), corrigée ici : la
--  garantie "idempotent, sûr" ci-dessus ne vaut que vers le HAUT. Ce fichier
--  restera dans le dépôt et pourrait être rejoué un jour (`supabase db
--  push`) après une FUTURE purge d'`attestations_cession` (ce projet en a
--  déjà connu une, voir `n_tup_del` élevé sur cette table) : un simple
--  `setval(max_restant)` ferait alors RECULER la séquence et recycler des
--  références déjà émises et imprimées sur de vrais actes -- l'inverse de
--  l'objectif de continuité de ce fichier. Le `setval` ci-dessous ne recule
--  donc JAMAIS en dessous de la valeur déjà atteinte par la séquence : il ne
--  fait que combler un trou VERS LE HAUT -- ce qui EXCLUT le cas d'aujourd'hui
--  (952 → 951, un recul assumé et déjà exécuté manuellement le 17/08/2026,
--  AVANT l'ajout de cette garde). Un rejeu ultérieur de ce même fichier ne
--  referait donc pas ce mouvement précis : il ne fera rien tant que la
--  séquence reste au-delà du `max()` recalculé, exactement le comportement
--  voulu pour empêcher un futur recul non désiré.
--
--  ── Regex non figée sur une année ──
--  La séquence est GLOBALE, sans remise à zéro annuelle : aucune fonction de
--  `public` ne contient `setval` ni `extract(year`, et aucun `cron.job` ne la
--  touche -- seul `to_char(now(),'YYYY')` (présent dans les 3 fonctions
--  consommatrices) varie avec la date. Le calcul du `max()` utilise donc
--  `^ATT-CESS-\d{4}-(\d+)$` (et non `^ATT-CESS-2026-(\d+)$`) pour rester
--  correct après le 31/12/2026 -- sinon un rejeu après le nouvel an ignorerait
--  les références 2026 et ferait RECULER la séquence, recréant alors une
--  collision (sur les références 2027+), distincte du risque initial de 2026
--  déjà écarté par l'incident du 17/08 décrit plus haut.
--
--  ── Rejeu à froid sur une base neuve/vide ──
--  `seq_attestation` n'est créée dans AUCUNE migration du dépôt (elle a été
--  créée manuellement en production, hors dépôt, comme le confirme
--  `grep -r "create sequence.*seq_attestation" supabase/migrations/` qui ne
--  renvoie que `seq_attestation_attribution` -- une séquence différente). Un
--  `setval` sans garde échouerait en `42P01` sur une base rejouée depuis
--  zéro (`supabase db reset` ou équivalent). Et si `attestations_cession` est
--  vide, `max()` vaut NULL/0, et `setval(seq, 0)` échoue (`min_value=1` sur
--  cette séquence, confirmé en production). Les deux gardes ci-dessous
--  rendent ce fichier rejouable sans erreur sur une base neuve, où il ne fera
--  simplement rien.

do $$
declare
  v_max int;
  v_actuel bigint;
  v_is_called boolean;
  v_prochain bigint;
begin
  if to_regclass('public.seq_attestation') is not null then
    select coalesce(
      max((regexp_match(reference, '^ATT-CESS-\d{4}-(\d+)$'))[1]::int),
      0
    )
    into v_max
    from public.attestations_cession
    where reference ~ '^ATT-CESS-\d{4}-\d+$';

    select last_value, is_called into v_actuel, v_is_called
    from public.seq_attestation;

    -- Le prochain nextval() réel : last_value+1 si la séquence a déjà été
    -- consommée, last_value lui-même sinon (is_called=false -- cas d'une
    -- séquence neuve jamais appelée, jamais rencontré en production à ce
    -- jour mais couvert pour un rejeu sur une base restaurée).
    v_prochain := case when v_is_called then v_actuel + 1 else v_actuel end;

    -- Ne recule jamais en dessous du prochain numéro que produirait la
    -- séquence en l'état : comble un trou vers le haut, ne recycle jamais
    -- une référence déjà émise après une purge future de
    -- attestations_cession (voir commentaire ci-dessus).
    if v_max is not null and v_max > 0 and v_max >= v_prochain then
      perform setval('public.seq_attestation', v_max, true);
    end if;
  end if;
end
$$;
