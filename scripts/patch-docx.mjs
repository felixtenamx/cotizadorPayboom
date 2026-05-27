// docx@9.6.x publica un package.json que apunta a dist/index.mjs (que no existe en el bundle).
// Este script normaliza el package.json para usar dist/index.cjs y se ejecuta automáticamente
// vía "postinstall" después de cada `npm install`.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const pkgPath = join(process.cwd(), "node_modules", "docx", "package.json");
if (!existsSync(pkgPath)) {
  process.exit(0);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
let patched = false;

if (pkg.exports && pkg.exports["."]?.import?.default === "./dist/index.mjs") {
  delete pkg.exports;
  patched = true;
}
if (pkg.module === "./dist/index.mjs") {
  delete pkg.module;
  patched = true;
}
if (pkg.main !== "dist/index.cjs") {
  pkg.main = "dist/index.cjs";
  patched = true;
}
if (pkg.types !== "dist/index.d.cts") {
  pkg.types = "dist/index.d.cts";
  patched = true;
}

if (patched) {
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  console.log("[patch-docx] node_modules/docx/package.json normalizado.");
}
