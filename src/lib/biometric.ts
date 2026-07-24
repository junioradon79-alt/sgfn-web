// Connexion biométrique (empreinte / visage) pour l'app native Capacitor.
//
// Les identifiants (email + mot de passe) sont chiffrés dans le coffre natif
// (Android Keystore / iOS Keychain) sous `AccessControl.BIOMETRY_ANY` : leur
// lecture (`getSecureCredentials`) déclenche elle-même l'invite biométrique du
// système — pas besoin d'appeler `verifyIdentity` séparément avant. No-op hors
// app native (import dynamique du plugin, même pattern que le scanner QR ML Kit
// dans VerifierForm : évite de charger le pont natif au build web/SSR).

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
    const { NativeBiometric, AccessControl } = await import("@capgo/capacitor-native-biometric");
    await NativeBiometric.setCredentials({
      username: email,
      password,
      server: SERVER,
      accessControl: AccessControl.BIOMETRY_ANY,
      title: "Protéger la connexion SGNF",
      negativeButtonText: "Annuler",
    });
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
    const creds = await NativeBiometric.getSecureCredentials({
      server: SERVER,
      reason: "Authentifiez-vous pour accéder à votre espace SGNF",
      title: "Connexion biométrique",
      negativeButtonText: "Annuler",
    });
    return { email: creds.username, password: creds.password };
  } catch {
    return null;
  }
}
