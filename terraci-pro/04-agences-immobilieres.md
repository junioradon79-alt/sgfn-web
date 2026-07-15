# TerraCI Pro — Agences immobilières

**Statut :** brouillon de conception, 13/07/2026 — rien n'est codé, rien n'est validé commercialement.

## 1. Le besoin — différent des deux métiers précédents

`dossiers-partenaires/09-agences-immobilieres.md` (§3) : *« Pour référencer vos mandats sur la marketplace Mon Terrain, un partenariat de publication peut être mis en place — à cadrer selon votre volume d'annonces. »*

Notaires et banques demandaient un **volume de vérifications**. Une agence demande autre chose : **un volume de publication**. Ce n'est pas un consommateur de verdicts, c'est un vendeur professionnel qui gère plusieurs mandats (biens de plusieurs propriétaires différents) et veut les publier efficacement sur Mon Terrain — pas les saisir un par un comme le ferait un propriétaire individuel via « Mettre en vente ».

Deux besoins concrets :
1. **Gérer plusieurs mandats sous un seul compte** — aujourd'hui, publier une annonce (`/dashboard/mettre-en-vente`) est pensé pour un propriétaire qui publie son propre bien. Une agence qui représente 15 vendeurs différents n'a pas de moyen de centraliser ça.
2. **Volume, pas verdict** — le dossier le dit explicitement : la facturation devrait suivre le nombre d'annonces, pas un forfait de vérifications comme pour les deux métiers précédents.

## 2. Tension intermédiation/contact direct — tranchée (14/07)

Le modèle marketplace actuel repose sur une décision d'architecture déjà actée (§4.2 du Document Directeur) : **SGNF reste l'intermédiaire, aucune coordonnée n'est publiée automatiquement, la mise en relation est manuelle par un admin.** C'est aussi ce qui finance le pass acheteur (5 000 FCFA/7 jours/10 contacts) : la rareté de l'accès au contact a une valeur.

Une agence professionnelle pourrait naturellement réclamer un contact direct et immédiat avec les prospects intéressés par ses mandats — ça entrerait en tension directe avec ce modèle existant, pas juste une nuance de confort. **Décision confirmée par l'utilisateur (14/07) : pas d'exception.** L'intermédiation manuelle reste identique pour les 3 paliers Agence, y compris Volume. Le palier Pro Agence est donc un outil de *gestion de volume* (mandats centralisés, tableau de bord, badge) — pas un accès privilégié au contact. Ça préserve le modèle de revenu du pass et la cohérence « aucune coordonnée jamais publiée automatiquement » ; à revisiter seulement si une vraie agence partenaire le réclame explicitement et que le modèle du pass est réévalué à ce moment-là.

## 3. Paliers proposés — volume de publication, pas de vérification

| Palier | Pour qui | Ce qu'il inclut |
|---|---|---|
| **Découverte** (statu quo, gratuit) | Propriétaire individuel, ou agence avec 1-2 mandats occasionnels | Publication via « Mettre en vente », un bien à la fois, comme aujourd'hui |
| **Pro Agence — Mandats** | Agence avec plusieurs mandats actifs en continu | Compte agence dédié, tableau de bord listant tous ses mandats (pas seulement le sien), badge « Agence partenaire » sur les annonces, publication centralisée pour le compte de plusieurs propriétaires (avec consentement du propriétaire à tracer, cf. §4) |
| **Pro Agence — Volume** | Grosse agence, gros portefeuille | Tout Mandats + tarif dégressif au nombre d'annonces actives, reporting mensuel des mandats publiés/vendus |

La mise en relation reste manuelle par l'équipe SGNF/TerraCI dans les trois paliers — le palier ne change que la capacité de gestion et le volume, pas le modèle d'intermédiation (cf. §2).

## 4. Ce qui manque vraiment pour construire ça

1. **Aucune entité « agence » n'existe aujourd'hui.** Le système connaît des propriétaires, attributaires, opérateurs — pas d'agence comme tierce partie qui publie *pour le compte* d'un propriétaire. Il faudrait une table `agences` + un lien de mandat (`mandats_agence` : agence_id, lot_id ou propriétaire_id, statut du mandat, date) qui trace explicitement que le propriétaire a bien délégué la publication — pas juste laisser une agence publier n'importe quel lot en son nom.
2. **Facturation à l'usage (nombre d'annonces actives)**, comme pour le palier API Banque — même dépendance de fond que celle déjà notée dans la fondation technique (§02) : pas de paiement récurrent aujourd'hui, et ici en plus un besoin de compter un volume qui varie dans le temps (annonces publiées puis retirées), pas juste activer/désactiver un abonnement.
3. **Décision produit sur le contact direct (§2)** — à trancher avant tout, parce que ça détermine si ce palier est un simple outil de gestion ou une vraie rupture du modèle marketplace actuel.

## 5. Ce qui existe déjà et peut être réutilisé

- Toute l'infrastructure marketplace (éligibilité, recherche guidée, flou GPS, upload photos) reste identique — un mandat Pro Agence est une annonce Mon Terrain comme une autre, juste publiée par un compte différent du propriétaire.
- Le suivi de republication du site (`marketplace_etat_site`, pastille admin) et le pipeline de contact (`/dashboard/contacts-marketplace`) restent le canal de mise en relation, sans changement.

## 6. Questions ouvertes — sans réponse pour l'instant, pas bloquant

La question de fond du §2 est tranchée (14/07, pas d'exception). Reste ouvert : mêmes inconnues que les deux métiers précédents (volume réel, interlocuteur agence identifié).
