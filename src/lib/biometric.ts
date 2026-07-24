// Connexion biométrique (empreinte / visage) pour l'app native Capacitor.
//
// ⚠️ Le stockage « lié au matériel » du plugin (`accessControl:
// BIOMETRY_ANY`/`BIOMETRY_CURRENT_SET`, cryptage Keystore gated biométrie)
// est **inutilisable sur Android avec @capgo/capacitor-native-biometric
// 8.6.2** : sa config par défaut (`BiometricAuthenticatorConfig.
// defaultBiometric()`, jamais overridable depuis l'API JS de
// `setCredentials`/`getSecureCredentials` — le paramètre `allowedBiometryTypes`
// n'existe que sur `verifyIdentity`) demande à la fois `BIOMETRIC_STRONG` et
// `BIOMETRIC_WEAK` pour un prompt lié à un `CryptoObject`, combinaison
// qu'Android interdit explicitement (`IllegalArgumentException:
// Crypto-based authentication is not supported for Class 2 (Weak)
// biometrics`, non interceptée par le plugin → plante toute l'app). Reproduit
// et confirmé via `adb logcat -b crash` le 24/07/26, sur un TECNO CM6 comme
// sur tout autre appareil (le bug est dans la combinaison de flags, pas dans
// le matériel).
//
// On utilise donc uniquement le chemin **sans** liaison matérielle :
// `verifyIdentity()` (jamais de CryptoObject, donc jamais ce bug) suivi de
// `setCredentials`/`getCredentials` sans `accessControl` — c'est le flux
// « Standard Login Flow » documenté par le plugin lui-même. Les identifiants
// restent chiffrés (Keystore, clé non biométrique) mais leur lecture n'est
// plus *cryptographiquement* garantie par la biométrie : c'est notre appel à
// `verifyIdentity()` juste avant qui fait office de porte. Suffisant pour cet
// usage (assister une reconnexion), pas pour un coffre-fort/paiement.
//
// No-op hors app native (import dynamique du plugin, même pattern que le
// scanner QR ML Kit dans VerifierForm : évite de charger le pont natif au
// build web/SSR).

import { isCapacitorNative } from "./capacitor";

const SERVER = "ci.sgnf.app";

export async function biometrieDisponible(): Promise<boolean> {
  if (!isCapacitorNative()) return false;
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    const res = await NativeBiometric.isAvailable({ useFallback: false });
    return res.isAvailable;
  } catch {
    return false;
  }
}

export async function biometrieActive(): Promise<boolean> {
  if (!isCapacitorNative()) return false;
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    const res = await NativeBiometric.isCredentialsSaved({ server: SERVER });
    return res.isSaved;
  } catch {
    return false;
  }
}

export async function activerBiometrie(email: string, password: string): Promise<boolean> {
  if (!isCapacitorNative()) return false;
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    await NativeBiometric.verifyIdentity({
      reason: "Authentifiez-vous pour activer la connexion biométrique",
      title: "Activer la biométrie",
      negativeButtonText: "Annuler",
    });
    await NativeBiometric.setCredentials({ username: email, password, server: SERVER });
    return true;
  } catch {
    return false;
  }
}

export async function desactiverBiometrie(): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    await NativeBiometric.deleteCredentials({ server: SERVER });
  } catch {
    /* déjà absent : rien à faire */
  }
}

/** Invite biométrique + lecture des identifiants stockés. `null` si annulé/échoué/indisponible. */
export async function connexionBiometrique(): Promise<{ email: string; password: string } | null> {
  if (!isCapacitorNative()) return null;
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    await NativeBiometric.verifyIdentity({
      reason: "Authentifiez-vous pour accéder à votre espace SGNF",
      title: "Connexion biométrique",
      negativeButtonText: "Annuler",
    });
    const creds = await NativeBiometric.getCredentials({ server: SERVER });
    return { email: creds.username, password: creds.password };
  } catch {
    return null;
  }
}
