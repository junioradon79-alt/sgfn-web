# Grille tarifaire — SGNF & Mon Terrain

> Mise à jour 03/07/2026 — montants réels fournis par le user, marqués **✅ validé**. Ce qui reste **[à valider]** n'a pas encore de chiffre confirmé.

## 1. Actes payants — plateforme SGNF

| Acte | Montant (fourchette) | Commission SGNF | Statut |
| --- | --- | --- | --- |
| Attestation de cession (délivrance) | 100 000 – 150 000 FCFA | 10 000 FCFA | ✅ validé |
| Consultation via QR code d'une attestation de cession | 60 000 FCFA (dont 50 000 pour la chefferie concernée) | 10 000 FCFA | ✅ validé (montants réajustés le 07/07) — **implémenté le 07/07** : verdict bloqué tant que la consultation n'est pas payée (voir §4) |
| Vente de terrain | — | Aucune commission | ✅ validé |

## 2. Honoraires géomètre — par démarche (table `demarches`)

| Démarche | Montant (fourchette) | Commission SGNF | Statut |
| --- | --- | --- | --- |
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
| --- | --- | --- |
| Pass contact (7 jours, 10 mises en relation, non remboursable) | 5 000 FCFA | ✅ réel, actif en base — paiement CinetPay pas encore opérationnel en prod (secret manquant) |
| Commission SGNF sur les ventes de lots via la marketplace | 0 FCFA | ✅ décision déjà actée |

## 4. Règle nouvelle — consultation QR payante (implémentée le 07/07)

La vérification d'une attestation de cession via le QR code est un acte payant :

- **Montant** : 60 000 FCFA, dont **50 000 FCFA pour la chefferie concernée** et **10 000 FCFA de commission SGNF** (montants réajustés le 07/07 — remplacent les 55 000/5 000 du 03/07).
- **Payeur** : le vérificateur (le tiers qui scanne le QR code), pas le propriétaire. Modèle *pay-per-view* : chaque consultation d'une attestation de cession via `/verifier` doit être payée avant affichage du verdict.
- **Portée** : attestation de cession uniquement. Certificat de vente et APFC restent gratuits à la vérification.
- **Statut d'implémentation — CODÉ ET DÉPLOYÉ le 07/07** :
  - Le parcours amont reste libre (scan, saisie de référence, identification du document : type + référence affichés gratuitement).
  - Le verdict complet est bloqué côté serveur (edge fn `verification-qr` v15) tant que la consultation n'est pas payée. Table `consultations_qr` (montants historisés par ligne, RLS admin), jeton secret porteur + code court `CQR-XXXXXX` communiqué au vérificateur.
  - Paiement en ligne : edge fns `payer-consultation-qr`/`confirmer-consultation-qr` (CinetPay) prêtes — répondent 503 « bientôt disponible » tant que les secrets CinetPay ne sont pas posés.
  - En attendant : paiement manuel au guichet — l'admin valide la consultation depuis `/dashboard/consultations-qr` (bouton « Marquer payée »), le vérificateur clique ensuite « J'ai payé — afficher le résultat ».
  - Une consultation payée reste consultable 24 h (re-affichage, retour agrégateur).

---

**Prochaine étape suggérée** : chiffrer bornage et demande ACD, trancher les points ouverts sur la consultation QR payante, puis décider s'il faut :

- poser les montants comme valeurs par défaut côté UI (`dashboard/paiements`, formulaire démarches) au lieu d'une saisie libre à chaque fois ;
- introduire une vraie table `tarifs` en base pour centraliser ces montants (aujourd'hui aucune table de ce type n'existe — tout est saisi manuellement paiement par paiement).
