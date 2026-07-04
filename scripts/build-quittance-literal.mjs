import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("scripts/quittance.html", "utf8");
const escaped = html
  .replace(/\\/g, "\\\\")
  .replace(/`/g, "\\`")
  .replace(/\$\{/g, "\\${");

writeFileSync("scripts/quittance-escaped.txt", escaped);
console.log("escaped length:", escaped.length);
