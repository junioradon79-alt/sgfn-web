// Fichier conservé pour compatibilité mais désactivé : cette Server Action
// n'est plus utilisée (src/app/login/page.tsx appelle Supabase directement
// côté client) et était incompatible avec `output: "export"` (next.config.ts),
// qui ne supporte pas les Server Actions. Sa présence faisait échouer `next build`
// en production. Ne pas réactiver `"use server"` ici sans revoir next.config.ts.

export type LoginState = {
  error?: string;
};
