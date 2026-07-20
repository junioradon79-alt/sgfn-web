import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "database.types.ts",
    // Capacitor recopie l'export statique de `out/` dans le projet Android
    // (assets de l'app + intermédiaires de build Gradle). Ce sont les mêmes
    // bundles minifiés que `out/`, déjà ignoré — les analyser produisait
    // **22 733 problèmes** de bruit qui noyaient les 56 du vrai code.
    "android/**",
    // Scripts de vérification jetables et artefacts téléchargés depuis la prod.
    ".shots/**",
  ]),
]);

export default eslintConfig;
