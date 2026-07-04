# SGNF pour les banques

**À l'attention de :** établissements bancaires et institutions de financement

---

## 1. Votre réalité aujourd'hui

Avant d'accorder un financement adossé à un titre foncier, votre établissement doit s'assurer que le document présenté est authentique et à jour — un titre déjà cédé, litigieux ou falsifié fait courir un risque direct sur la garantie du prêt. Cette vérification, quand elle repose sur des démarches manuelles ou des tiers, ralentit l'instruction du dossier et n'offre pas toujours une garantie fiable.

## 2. Ce que SGNF change concrètement

- **Vérification instantanée, sans compte ni application** — chaque document SGNF (attestation de cession, certificat de vente) porte un QR code que votre chargé de dossier peut scanner avec un simple smartphone, obtenant en quelques secondes le statut réel du document (délivré, révoqué, litige en cours).
- **Verdict toujours calculé côté serveur** — la réponse n'est jamais produite par l'application qui scanne, ce qui exclut toute manipulation du résultat par un tiers malveillant.
- **Détection de tentatives de fraude** — un mécanisme automatique signale les schémas de vérification anormaux (nombreuses localisations distinctes en peu de temps sur un même document), un signal utile avant d'engager un financement.
- **Historique consultable** — la chronologie de propriété du bien financé, pas seulement son état présent.

## 3. Comment ça fonctionne pour vous

La vérification (`/verifier`) est publique et utilisable dès aujourd'hui, sans aucune intégration technique de votre part. Pour un volume important de dossiers de financement, une intégration API dédiée (vérification automatisée depuis votre système de gestion de prêts) est un sujet de partenariat à étudier ensemble.

## 4. Cas d'usage

Un client présente une attestation de cession en garantie d'un prêt immobilier. Le chargé de dossier scanne le QR code : la plateforme confirme le statut « délivrée », l'absence de litige actif, et l'identité de l'acquéreur enregistrée — une vérification en quelques secondes, avant même de lancer le reste de l'instruction du dossier.

## 5. Un argument de confiance à connaître

Le QR code encode une adresse HTTPS standard, pas un format propriétaire — aucune app à installer, aucune dépendance technique à votre système d'information pour commencer à l'utiliser. Le jeton de vérification est un identifiant aléatoire de 32 caractères, distinct de la référence imprimée sur le document : connaître la référence visible ne suffit pas à deviner une URL de vérification valide, ce qui exclut la fabrication d'un faux QR à partir d'un document légitime.

## 6. Prochaine étape

Sécuriser vos dossiers de financement : [Sécuriser mes dossiers de financement](https://sgfn.ci/contact?profil=banque).
