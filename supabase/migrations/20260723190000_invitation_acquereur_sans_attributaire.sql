-- Fix : une invitation « acquéreur » ne doit JAMAIS porter d'attributaire_id.
--
-- Bug constaté le 23/07 : un compte acquéreur fraîchement créé apparaissait
-- « propriétaire » de 23 parcelles. Cause — l'ancienne contrainte (posée dans
-- 20260711_invitations_famille_autorite.sql) exigeait `attributaire_id IS NOT NULL`
-- pour groupe ∈ (proprietaire, ACQUEREUR). Le formulaire d'invitation admin
-- estampillait donc l'attributaire d'un lot existant sur une invitation acquéreur,
-- que handle_new_user() recopiait sur le profil ; l'app mobile chargeait alors les
-- attributions de cet attributaire (= les lots du vendeur) comme « mes parcelles ».
--
-- `profiles.attributaire_id` désigne « l'attributaire que cette personne EST »
-- (un propriétaire). Un acquéreur est un prospect/acheteur : il ne doit jamais
-- être rattaché à l'attributaire d'un lot au moment de l'invitation. On retire
-- donc `acquereur` de l'exigence. `proprietaire` (rôle déprécié, cf.
-- 20260717250000_deprecate_proprietaire_role) reste soumis à l'exigence pour ne
-- pas réécrire l'historique — plus aucune invitation de ce groupe n'est créée.
--
-- On va plus loin qu'un simple « non requis » : on INTERDIT désormais
-- attributaire_id sur une invitation acquéreur (fail-closed). Ainsi, même le
-- front encore déployé (qui force l'attributaire) ne peut plus recréer un
-- compte malformé — il échouera bruyamment sur la contrainte au lieu de créer
-- silencieusement un faux propriétaire. Les 2 invitations acquéreur déjà
-- utilisées (SGNF-B9RUKRFM, SGFN-F6SLXB8A) sont nettoyées avant, sinon la
-- contrainte plus stricte les rejetterait ; c'est sans effet (elles sont
-- consommées, attributaire_id n'est lu qu'au signup) et les profils
-- correspondants ont déjà été déliés (attributaire_id remis à null).

update public.invitations
set attributaire_id = null
where groupe = 'acquereur' and attributaire_id is not null;

alter table public.invitations drop constraint invitations_check;

alter table public.invitations add constraint invitations_check check (
  (groupe <> 'proprietaire'::groupe_utilisateur or attributaire_id is not null)
  and (groupe <> 'acquereur'::groupe_utilisateur or attributaire_id is null)
  and (statut <> 'en_attente' or groupe <> 'chefferie'::groupe_utilisateur
    or autorite_coutumiere_id is not null or famille_id is not null)
  and (statut <> 'en_attente' or groupe <> 'proprietaire_terrien'::groupe_utilisateur
    or famille_id is not null)
);
