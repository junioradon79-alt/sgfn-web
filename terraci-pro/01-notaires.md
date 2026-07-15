# TerraCI Pro — Notaires

**Statut :** brouillon de conception, 13/07/2026 — rien n'est codé, rien n'est validé commercialement.

## 1. Le besoin, tel que le dossier partenaire le formule déjà

`dossiers-partenaires/05-notaires.md` (§3) : *« la vérification (`/verifier`) est publique et immédiate — utilisable dès aujourd'hui sans intégration technique. Pour un usage plus soutenu (volume important de vérifications, besoin d'historique consolidé), une discussion de partenariat permettrait de cadrer un accès dédié. »*

Deux manques concrets, pas un vague « accès dédié » :
1. **Le prix à l'unité ne tient pas à l'échelle d'un usage professionnel.** Le paywall grand public facture 60 000 FCFA la consultation d'un verdict d'attestation de cession (au-delà de la 1ʳᵉ, gratuite). Un notaire qui authentifie plusieurs actes par mois ne peut pas fonctionner sur ce modèle — il a besoin d'un forfait.
2. **Aucune mémoire de ses propres vérifications.** Aujourd'hui `/verifier` est un aller simple : on scanne, on lit le verdict, on repart. Rien ne garde trace de ce qu'une étude a déjà vérifié — donc rien ne peut l'alerter si le statut d'un document qu'elle a authentifié change *après coup* (ex. : une attestation validée par l'étude est révoquée trois mois plus tard suite à un litige). C'est le vrai différenciateur professionnel, pas juste « moins cher à l'unité ».

## 2. Paliers proposés

| Palier | Pour qui | Ce qu'il inclut |
|---|---|---|
| **Découverte** (statu quo, gratuit) | Tout le monde, y compris les études qui ne s'abonnent pas | Scan QR public, 1ʳᵉ consultation de verdict gratuite par document, 60 000 FCFA à l'unité au-delà — inchangé |
| **Pro Notaire — Essentiel** | Étude individuelle, usage régulier | Vérifications illimitées (ou plafond haut, ex. 100/mois — à trancher), tableau de bord « Historique de mes vérifications », **alerte si un document déjà vérifié change de statut** (révoqué, litige ouvert) |
| **Pro Notaire — Étude** | Cabinet avec plusieurs clercs/collaborateurs | Tout l'Essentiel + plusieurs comptes utilisateurs sous un même abonnement, export mensuel (PDF/CSV) des vérifications effectuées — utile comme pièce de conformité interne |

Un 4ᵉ palier « API » (intégration dans un logiciel métier notarial) est volontairement **exclu de cette conception** — il recoupe l'API publique v1 (Phase 3 pt.2 du Document Directeur) et mérite son propre chantier plutôt que d'être improvisé ici. À noter comme évolution naturelle du palier Étude, pas comme un livrable de cette semaine.

## 3. Prix — hypothèse à valider, pas un chiffre définitif

Je n'ai pas de donnée de marché réelle sur ce qu'une étude notariale ivoirienne est prête à payer — ce qui suit est une méthode d'ancrage, pas un prix arrêté :

- Le point de comparaison que le notaire connaît déjà est le tarif à l'unité (60 000 FCFA). Un abonnement doit être perçu comme un vrai gain dès un usage modeste : à partir de 2-3 vérifications/mois, un forfait mensuel inférieur à 120-180 000 FCFA devient déjà rentable pour l'étude par rapport au paiement à l'unité.
- Sens inverse à garder en tête : un prix trop bas dévalorise le service par rapport au 60 000 FCFA unitaire (signal de prix), et cannibalise les études à faible volume qui auraient payé plus cher à l'unité.
- **Question pour vous** : avez-vous une idée du volume mensuel réel de vérifications qu'une étude notarial type ferait (même approximative) ? C'est la donnée qui manque le plus pour caler un prix plutôt que de deviner.

## 4. Ce qui existe déjà et peut être réutilisé

- Le calcul de verdict (`verifier_attestation()` / `verifier_document()`) et le Score de confiance v1 sont déjà en place — un compte Pro ne change pas *ce qui* est vérifié, seulement *comment on paie* et *ce qu'on garde en mémoire*.
- La fondation notifications (`notifications` + edge `envoyer-whatsapp`, inerte en attendant l'approbation Meta) peut porter le dispatch de l'alerte de révocation — mais **pas telle quelle** : elle est aujourd'hui câblée sur les événements du tunnel d'acquisition (demande/vente/certificat/attestation), pas sur un mécanisme générique « surveiller cette référence et me notifier à tout changement futur ». Une table de « suivi » (notaire ↔ référence document) serait à créer, qui viendrait déclencher la même mécanique de dispatch.

## 5. Ce qui manque vraiment (dépendances à construire, pas pour cette semaine)

1. **Paiement récurrent.** CinetPay est branché en paiement ponctuel seulement. Aucun mécanisme d'abonnement mensuel/annuel prélevé automatiquement n'existe dans le produit — c'est le plus gros écart technique, commun à tous les métiers Pro, pas spécifique aux notaires.
2. **Un rôle ou un statut de compte « professionnel »** distinct des rôles actuels (chefferie, opérateur, géomètre…) — à trancher : nouveau `groupe_utilisateur` dédié, ou un statut d'abonnement rattaché à un compte `acquereur`/`verificateur` existant.
3. **Table de suivi** des documents surveillés par un compte Pro (cf. §4).
4. **Tableau de bord « Historique de mes vérifications »** — écran à concevoir, dans l'esprit du Centre de pilotage admin mais scopé à un seul compte professionnel.

## 6. Questions ouvertes — sans réponse pour l'instant, pas bloquant

Aucune donnée de volume/marché ni interlocuteur notarial identifié à ce stade (13/07). Le prix du §3 reste une hypothèse de méthode, pas un chiffre à coder. À valider dès que du terrain réel est disponible — ça ne bloque pas la conception du reste (paliers, périmètre fonctionnel, fondation technique).
