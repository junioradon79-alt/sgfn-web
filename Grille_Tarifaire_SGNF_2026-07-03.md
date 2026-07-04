# Grille tarifaire — SGNF & Mon Terrain

> Mise à jour 03/07/2026 — montants réels fournis par le user, marqués **✅ validé**. Ce qui reste **[à valider]** n'a pas encore de chiffre confirmé.

## 1. Actes payants — plateforme SGNF

| Acte | Montant (fourchette) | Commission SGNF | Statut |
|---|---|---|---|
| Attestation de cession (délivrance) | 100 000 – 150 000 FCFA | 10 000 FCFA | ✅ validé |
| Consultation via QR code d'une attestation de cession | 55 000 FCFA | 5 000 FCFA | ✅ validé — **règle à appliquer**, actuellement `/verifier` est gratuit et sans paiement (voir ci-dessous) |
| Vente de terrain | — | Aucune commission | ✅ validé |

## 2. Honoraires géomètre — par démarche (table `demarches`)

| Démarche | Montant (fourchette) | Commission SGNF | Statut |
|---|---|---|---|
| Entérinement chefferie (délivrance APFC) | 550 000 FCFA | 50 000 FCFA | ✅ validé |
| Mutation acquéreur | 550 000 FCFA | 50 000 FCFA | ✅ validé |
| Transmission | 300 000 – 500 000 FCFA | 30 000 – 50 000 FCFA | ✅ validé |
| Levée de litige | 110 000 FCFA | 10 000 FCFA | ✅ validé |
| Bornage | — | — | [à valider] |
| Demande ACD | — | — | [à valider] |
| Autre | Montant libre | — | Déjà fonctionnel tel quel |

*Note : la table `demarches` existe et porte déjà la colonne `montant_honoraires`, mais aucune démarche n'a de montant renseigné en base à ce jour — le flux est prêt, pas encore utilisé.*

*L'APFC n'est donc pas un acte à part : c'est le document délivré au terme de la démarche « Entérinement chefferie ».*

## 3. Marketplace « Mon Terrain » (monterrain-web)

| Acte | Montant | Statut |
|---|---|---|
| Pass contact (7 jours, 10 mises en relation, non remboursable) | 5 000 FCFA | ✅ réel, actif en base — paiement CinetPay pas encore opérationnel en prod (secret manquant) |
| Commission SGNF sur les ventes de lots via la marketplace | 0 FCFA | ✅ décision déjà actée |

## 4. Règle nouvelle — consultation QR payante (validée, non implémentée)

La vérification d'une attestation de cession via le QR code devient un acte payant :

- **Montant** : 55 000 FCFA, dont 5 000 FCFA de commission SGNF.
- **Payeur** : le vérificateur (le tiers qui scanne le QR code), pas le propriétaire. Modèle *pay-per-view* : chaque consultation d'une attestation de cession via `/verifier` doit être payée avant affichage du verdict.
- **Portée** : attestation de cession uniquement. Certificat de vente et APFC restent gratuits à la vérification pour l'instant.
- **Statut d'implémentation** : décision produit actée, mais **pas encore codée**. `/verifier` reste aujourd'hui public et gratuit, sans paiement. Choix assumé de ne pas construire le paywall tant que CinetPay n'est pas opérationnel en prod (secret manquant) — inutile de livrer un flux de paiement qu'on ne peut pas tester en conditions réelles. À reprendre en même temps que l'activation du paiement en ligne (CinetPay/Resend), avec un chantier dédié : blocage de l'accès au verdict tant que le paiement n'est pas confirmé, session/jeton de consultation, edge function dédiée.

---

**Prochaine étape suggérée** : chiffrer bornage et demande ACD, trancher les points ouverts sur la consultation QR payante, puis décider s'il faut :
- poser les montants comme valeurs par défaut côté UI (`dashboard/paiements`, formulaire démarches) au lieu d'une saisie libre à chaque fois ;
- introduire une vraie table `tarifs` en base pour centraliser ces montants (aujourd'hui aucune table de ce type n'existe — tout est saisi manuellement paiement par paiement).
