const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC_APP = path.join(ROOT, ".next", "server", "app");
const SRC_STATIC = path.join(ROOT, ".next", "static");
const SRC_PUBLIC = path.join(ROOT, "public");
const OUT = path.join(ROOT, "out");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

function copyHtml(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const item of fs.readdirSync(srcDir)) {
    const s = path.join(srcDir, item);
    const d = path.join(destDir, item);
    if (fs.statSync(s).isDirectory()) {
      copyHtml(s, d);
    } else if (item.endsWith(".html") && item !== "_global-error.html") {
      const destName = item === "_not-found.html" ? "404.html" : item;
      fs.copyFileSync(s, path.join(destDir, destName));
    }
  }
}

// 1. Nettoyer out/
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);

// 2. HTML pages
copyHtml(SRC_APP, OUT);

// 3. Assets Next.js
copyDir(SRC_STATIC, path.join(OUT, "_next", "static"));

// 4. Public (images, etc.) — sauf .htaccess géré séparément
for (const item of fs.readdirSync(SRC_PUBLIC)) {
  if (item === ".htaccess") continue;
  const s = path.join(SRC_PUBLIC, item);
  const d = path.join(OUT, item);
  fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
}

// 5. .htaccess
const htaccess = path.join(SRC_PUBLIC, ".htaccess");
if (fs.existsSync(htaccess)) fs.copyFileSync(htaccess, path.join(OUT, ".htaccess"));

// 6. Rapport
const total = fs.readdirSync(OUT, { recursive: true }).length;
console.log(`✓ out/ créé — ${total} entrées`);
