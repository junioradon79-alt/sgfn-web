-- ═══════════════════════════════════════════════════════════════════════════
-- Marquer expiree l'invitation SGFN-6EW6XNSY (Chefferie d'Ebimpe)
--
-- CONTEXTE. Invitation creee le 12/07/2026 pour le chef du village d'Ebimpe,
-- expiree depuis le 19/07 et restee en 'en_attente' : l'ecran des invitations
-- l'affiche donc comme une demarche en cours, ce qu'elle n'est plus. Elle porte
-- en outre un nom INCOMPLET (« MONDON ATSIN PACOME ») alors que le referentiel
-- a ete corrige depuis au nom complet « HOBI MONDON ATSIN PACOME » (arrete
-- 38/PA/SG/D1 du 12/05/2023). Une invitation neuve sera creee A L'ECRAN par le
-- proprietaire du projet, avec le nom a jour.
--
-- PORTEE. Une seule ligne, une seule colonne (statut). Aucun code n'est
-- invalide par ce geste : `valider_invitation` controle `expire_le`, pas
-- `statut` (verifie : son corps ne contient pas la chaine 'expiree'). Le code
-- etait donc DEJA refuse. C'est de l'hygiene d'affichage.
--
-- NON DESTRUCTIF. Le code, le nom, la date de creation, l'auteur et le
-- rattachement a la chefferie sont conserves : la trace de la demarche reste
-- lisible. Aucune suppression.
--
-- IDEMPOTENT. Rejoue, il ne fait rien et le dit.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
drop table if exists public.tmp_invit_ebimpe;
create temp table tmp_invit_ebimpe(phase text, sonde text, valeur text) on commit preserve rows;
commit;

begin;
do $$
declare
  v_id   uuid := '582674e3-22b9-43f6-8b7e-9725e2e50d35';
  v_code text := 'SGFN-6EW6XNSY';
  v_statut text; v_expire timestamptz; v_nom text; v_ac uuid; v_n int;
begin
  select statut, expire_le, nom_complet, autorite_coutumiere_id
    into v_statut, v_expire, v_nom, v_ac
  from invitations where id = v_id;

  if not found then
    raise exception 'Invitation % introuvable : arret, la situation a change depuis la mesure du 31/07.', v_id;
  end if;

  insert into tmp_invit_ebimpe values
    ('AVANT','code', v_code),
    ('AVANT','nom_complet', v_nom),
    ('AVANT','statut', v_statut),
    ('AVANT','expire_le', v_expire::text),
    ('AVANT','autorite_coutumiere_id', coalesce(v_ac::text,'(null)'));

  -- Elle doit porter le code attendu : on ne touche pas une ligne inconnue.
  if (select code from invitations where id = v_id) <> v_code then
    raise exception 'L''invitation % ne porte pas le code % : arret.', v_id, v_code;
  end if;

  -- Elle ne doit JAMAIS avoir servi.
  if (select utilisee_par from invitations where id = v_id) is not null then
    raise exception 'L''invitation % a ete utilisee : arret, on ne rature pas un compte cree.', v_code;
  end if;

  -- Elle doit etre reellement perimee : on ne ferme pas une invitation vivante.
  if v_expire >= now() then
    raise exception 'L''invitation % expire le % — elle est ENCORE VALABLE : arret.', v_code, v_expire;
  end if;

  if v_statut <> 'en_attente' then
    insert into tmp_invit_ebimpe values ('ECRITURE','resultat',
      'RIEN A FAIRE — statut deja « ' || v_statut || ' »');
  else
    update invitations set statut = 'expiree'
     where id = v_id and statut = 'en_attente' and expire_le < now();

    get diagnostics v_n = row_count;
    if v_n <> 1 then
      raise exception 'L''UPDATE a touche % ligne(s) au lieu d''exactement 1 : transaction annulee.', v_n;
    end if;
    insert into tmp_invit_ebimpe values ('ECRITURE','resultat','OK — 1 ligne : en_attente -> expiree');
  end if;

  select statut into v_statut from invitations where id = v_id;
  insert into tmp_invit_ebimpe values
    ('APRES','statut', v_statut),
    ('APRES','code_conserve', (select code from invitations where id = v_id)),
    ('APRES','nom_conserve',  (select nom_complet from invitations where id = v_id)),
    ('APRES','rattachement_conserve', (select coalesce(autorite_coutumiere_id::text,'(null)')
                                       from invitations where id = v_id)),
    ('TEMOIN','invitations_en_attente_restantes',
      (select count(*)::text from invitations where statut = 'en_attente'));
end $$;
commit;

select phase, sonde, valeur from tmp_invit_ebimpe order by phase desc, sonde;
