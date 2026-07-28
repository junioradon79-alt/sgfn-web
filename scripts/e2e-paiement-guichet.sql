-- Chaine d'encaissement au GUICHET (especes / virement), de bout en bout.
--
--   powershell> .\scripts\supabase-sql.ps1 -SqlFile .\scripts\e2e-paiement-guichet.sql
--
-- Attendu : 10 lignes, colonne `ok` a true partout.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POURQUOI CE TEST EST ECRIT EN SQL, ET DANS UNE TRANSACTION ANNULEE
--
-- C'est le seul rail de paiement qui fonctionne : CinetPay n'a pas de secrets
-- poses, donc `initier-paiement` repond 503 et le rail en ligne s'arrete au
-- premier clic. Le guichet, lui, ne depend de rien d'externe.
--
-- Mais confirmer un paiement en production declenche SEPT effets, dont trois
-- sortent de la base :
--   trg_gen_quittance      -> sgfn_call_edge('generation-document')
--                             -> rendu PDFMonkey REEL (facture, et stocke)
--   trg_notifier_payeur    -> email Resend REEL au payeur
--   trg_paiement_active_jeton -> active un jeton marketplace
--   trg_reference_quittance-> consomme nextval('seq_quittance')
--   trg_ventiler_paiement  -> cree les lignes de repartition
--   trg_paiement           -> solde cessions / echeances / ventes
--   trg_audit_paiements    -> journal
--
-- `sgfn_call_edge` passe par `net.http_post` (pg_net), qui ECRIT DANS UNE TABLE.
-- L'appel HTTP n'est donc emis qu'apres COMMIT : un ROLLBACK l'annule, comme il
-- annule l'email et toutes les lignes creees. C'est ce qui rend ce test sur
-- pour la production, et c'est verifie — pas suppose (cf. probe du 28/07 : une
-- table creee puis annulee n'existait plus apres coup).
--
-- 🔴 CE QUI N'EST PAS ANNULE : `nextval`. Les sequences sont hors transaction.
--    Chaque passage consomme donc un numero de quittance (`seq_quittance`) qui
--    ne sera jamais imprime. C'est un TROU dans une serie comptable. Il est
--    invisible et sans consequence fonctionnelle, mais il est definitif : ne
--    pas passer ce script en boucle sans raison.
--
-- Choix du type `autre` : c'est le seul qui n'entraine aucun effet metier de
-- bord dans `traiter_paiement_confirme` (pas de cession soldee, pas
-- d'attestation creee, pas d'echeance marquee payee). `acquereur_id` est laisse
-- NULL, ce qui coupe en plus la notification du payeur a la racine.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create temp table res(n int, controle text, ok boolean, detail text) on commit drop;

-- ── Le paiement de controle ────────────────────────────────────────────────
insert into public.paiements
  (id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut, acquereur_id)
values
  ('e2e00000-0000-4000-8000-000000000001', 'autre', 50000, 10000,
   'Controle e2e guichet (transaction annulee)', 'especes', 'en_attente_validation', null);

-- ── 1 a 3 : l'etat a la creation ───────────────────────────────────────────
-- Un encaissement au guichet n'est PAS un paiement confirme : il attend qu'un
-- agent atteste avoir recu l'argent. Tant que ce n'est pas fait, ni quittance
-- ni repartition ne doivent exister.
insert into res
select 1, 'Creation au guichet : statut en_attente_validation',
       statut::text = 'en_attente_validation', statut::text
  from public.paiements where id = 'e2e00000-0000-4000-8000-000000000001';

insert into res
select 2, 'Aucune quittance numerotee avant validation',
       reference is null, coalesce(reference, '(null)')
  from public.paiements where id = 'e2e00000-0000-4000-8000-000000000001';

insert into res
select 3, 'Aucune repartition avant validation',
       count(*) = 0, count(*)::text || ' ligne(s)'
  from public.repartitions_paiement
 where paiement_id = 'e2e00000-0000-4000-8000-000000000001';

-- ── La validation manuelle par un agent ────────────────────────────────────
select public.valider_paiement_manuel(
         'e2e00000-0000-4000-8000-000000000001',
         '7291e76a-9dd1-4989-b744-0caedc517934'  -- profil admin junior.adon79
       );

-- ── 4 a 8 : ce que la validation doit avoir produit ────────────────────────
insert into res
select 4, 'Apres validation : statut confirme',
       statut::text = 'confirme', statut::text
  from public.paiements where id = 'e2e00000-0000-4000-8000-000000000001';

insert into res
select 5, 'Le validateur et l''horodatage sont traces',
       valide_par is not null and valide_le is not null,
       coalesce(valide_par::text, '(null)') || ' @ ' || coalesce(valide_le::text, '(null)')
  from public.paiements where id = 'e2e00000-0000-4000-8000-000000000001';

insert into res
select 6, 'Une quittance est numerotee au format QUIT-AAAA-NNNNN',
       reference ~ '^QUIT-[0-9]{4}-[0-9]{5}$', coalesce(reference, '(null)')
  from public.paiements where id = 'e2e00000-0000-4000-8000-000000000001';

insert into res
select 7, 'La ventilation a produit des lignes de repartition',
       count(*) > 0, count(*)::text || ' ligne(s) : ' ||
       coalesce(string_agg(beneficiaire_type || '=' || montant::text, ' + ' order by beneficiaire_type), '')
  from public.repartitions_paiement
 where paiement_id = 'e2e00000-0000-4000-8000-000000000001';

-- L'invariant comptable : rien ne se perd, rien ne se cree. C'est le seul
-- controle de ce fichier qui protege l'argent lui-meme.
insert into res
select 8, 'La somme des repartitions egale le montant encaisse',
       coalesce(sum(r.montant), 0) = p.montant_total,
       coalesce(sum(r.montant), 0)::text || ' / ' || p.montant_total::text
  from public.paiements p
  left join public.repartitions_paiement r on r.paiement_id = p.id
 where p.id = 'e2e00000-0000-4000-8000-000000000001'
 group by p.montant_total;

-- ── 9 et 10 : les gardes de `valider_paiement_manuel` ──────────────────────
-- Une double validation ne doit pas repasser la ventilation : `ventiler_paiement`
-- efface puis reinsere, et un rejeu sur un paiement deja confirme dupliquerait
-- ou effacerait des lignes selon l'ordre. La garde est donc dans la RPC.
do $$
declare v_msg text; v_leve boolean := false;
begin
  begin
    perform public.valider_paiement_manuel(
      'e2e00000-0000-4000-8000-000000000001',
      '7291e76a-9dd1-4989-b744-0caedc517934');
  exception when others then
    v_leve := true; v_msg := sqlerrm;
  end;
  insert into res values (9, 'Une seconde validation est refusee', v_leve,
                          coalesce(v_msg, 'AUCUNE exception : le rejeu est passe'));
end $$;

do $$
declare v_msg text; v_leve boolean := false;
begin
  begin
    perform public.valider_paiement_manuel(
      '00000000-0000-4000-8000-000000000000',
      '7291e76a-9dd1-4989-b744-0caedc517934');
  exception when others then
    v_leve := true; v_msg := sqlerrm;
  end;
  insert into res values (10, 'Un paiement inexistant est refuse', v_leve,
                          coalesce(v_msg, 'AUCUNE exception : un id inconnu est passe'));
end $$;

select n, controle, ok, detail from res order by n;

rollback;
