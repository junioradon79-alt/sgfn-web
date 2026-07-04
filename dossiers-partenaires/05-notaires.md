# SGNF pour les notaires

**À l'attention de :** études notariales

---

## 1. Votre réalité aujourd'hui

Authentifier un acte foncier suppose de vérifier l'historique de propriété d'une parcelle et l'absence de litige en cours — une vérification qui, sans registre numérique partagé, repose sur des attestations papier difficiles à authentifier à distance et sur des échanges avec des tiers pas toujours réactifs.

## 2. Ce que SGNF change concrètement

- **Vérification instantanée et publique** — n'importe quel document SGNF (attestation de cession, certificat de vente, attestation coutumière) porte un QR code vérifiable en quelques secondes, sans compte ni application dédiée, avec l'appareil photo d'un simple smartphone.
- **Historique de propriété consultable** — la chronologie des attributions et cessions d'un lot est conservée et horodatée, pas seulement son état actuel.
- **Respect de la chaîne de droits coutumiers** — la hiérarchie familiale (grande famille, lignée, collectif d'ayants-droit désigné par PV de réunion) est modélisée, pas seulement déclarative : une cession ne peut être validée sans que les bonnes personnes l'aient actée.
- **Détection d'anomalies** — un système de détection automatique signale les schémas de scan anormaux (tentative de vérification depuis de nombreuses localisations distinctes en peu de temps), utile pour repérer une tentative de fraude documentaire.

## 3. Comment ça fonctionne pour vous

La vérification (`/verifier`) est publique et immédiate — utilisable dès aujourd'hui par votre étude sans aucune intégration technique. Pour un usage plus soutenu (volume important de vérifications, besoin d'historique consolidé), une discussion de partenariat permettrait de cadrer un accès dédié.

## 4. Cas d'usage

Avant d'authentifier un acte de cession, le notaire scanne le QR code de l'attestation présentée par les parties. La plateforme confirme instantanément le statut « délivrée », l'absence de litige actif sur le lot, et l'identité de l'acquéreur enregistrée — une vérification qui, sans cet outil, aurait nécessité un appel ou un déplacement.

## 5. Un argument de confiance à connaître

Le QR encode une simple adresse HTTPS, pas un format propriétaire — aucune barrière d'adoption, votre étude n'a rien à installer. Le verdict est toujours calculé côté serveur SGNF : impossible de le falsifier en manipulant un lecteur QR tiers. Le jeton de vérification (32 caractères aléatoires) est distinct de la référence imprimée sur le document, ce qui empêche de forger un faux QR à partir d'un document authentique existant.

## 6. Prochaine étape

Sécuriser vos actes notariés : [Sécuriser mes actes notariés](https://sgfn.ci/contact?profil=notaire).
