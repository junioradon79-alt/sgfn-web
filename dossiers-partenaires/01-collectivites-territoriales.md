# SGNF pour les collectivités territoriales

**À l'attention de :** communes, préfectures, autorités décentralisées en charge du foncier local

---

## 1. Votre réalité aujourd'hui

Une collectivité qui gère ou supervise un lotissement fait face à des difficultés récurrentes : registres papier dispersés, doublons d'attribution difficiles à détecter, litiges fonciers qui s'enlisent faute de trace exploitable, et une dépendance à la mémoire de quelques agents pour retrouver l'historique d'une parcelle. Chaque contestation devient une enquête, chaque succession un casse-tête administratif.

## 2. Ce que SGNF change concrètement

SGNF est une plateforme numérique qui centralise, pour un lotissement donné, l'intégralité du cycle de vie foncier :

- **Registre unique des lots** — îlots, lots, statut (libre, attribué, vendu, verrouillé), superficie, nature du droit.
- **Traçabilité complète** — chaque création, modification ou attribution est journalisée automatiquement (horodatage, auteur, ancienne/nouvelle valeur), consultable en cas de contestation.
- **Gestion des litiges** — registre dédié, statut de résolution suivi, historique consultable.
- **Respect de la coutume** — la hiérarchie familiale (grande famille → lignée → collectif d'ayants-droit) et les PV de réunion de famille sont modélisés en base, pas ignorés : une cession ne peut être validée sans que le collectif désigné l'ait actée.
- **Documents officiels sécurisés** — attestations de cession, certificats de vente, attestations coutumières (APFC) générés au format PDF, vérifiables publiquement par QR code.

## 3. Comment ça fonctionne pour vous

La vérification des documents (`/verifier`) est **publique et ne nécessite aucun compte** : n'importe quel agent municipal peut, avec le simple appareil photo de son téléphone, authentifier une attestation de cession présentée par un administré.

Pour un suivi plus poussé (supervision du registre, indicateurs de conformité, historique des litiges de votre territoire), un accès de supervision peut être construit sur le modèle de l'espace déjà existant pour les commissaires de justice — lecture seule, cloisonné à votre périmètre géographique. C'est un point à cadrer ensemble selon vos besoins précis (quel périmètre, quels indicateurs, quel niveau d'accès).

## 4. Cas d'usage

Un administré se présente en mairie avec une attestation de cession pour appuyer une demande de permis de construire. L'agent municipal scanne le QR code avec son téléphone : en quelques secondes, la plateforme confirme (ou infirme) l'authenticité du document et son statut à jour — sans appel téléphonique, sans recherche dans une armoire, sans dépendre de la disponibilité d'un tiers.

## 5. Un argument de confiance à connaître

Le QR code d'un document SGNF encode une simple adresse web sécurisée (HTTPS) — pas de format propriétaire, pas d'application à installer. Le verdict d'authenticité est **toujours calculé côté serveur**, jamais par l'appareil qui scanne : impossible de le falsifier en trafiquant un lecteur QR. Le jeton de vérification est distinct de la référence imprimée sur le document, ce qui empêche de fabriquer un faux QR à partir d'un document légitime.

## 6. Prochaine étape

Échanger sur votre périmètre et vos besoins de supervision : [Doter ma collectivité de SGNF](https://sgfn.ci/contact?profil=collectivite).
