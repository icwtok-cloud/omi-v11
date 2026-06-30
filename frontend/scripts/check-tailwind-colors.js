#!/usr/bin/env node
/**
 * Test de regresión para el bug del 2026-06-29 (ver CHANGELOG.md):
 * `text-paper` se usaba en 3 componentes pero `paper` nunca se definió en
 * `tailwind.config.js`. Tailwind descarta en silencio cualquier clase que
 * no reconoce -- no hay error de build, no hay warning en consola. El
 * resultado es un botón con texto invisible, y nadie se entera hasta que
 * un usuario se queja.
 *
 * Este script escanea todos los .tsx/.ts/.jsx/.js de `app/` y `components/`
 * en busca de clases `text-X`, `bg-X`, `border-X` (y variantes con
 * hover:/disabled:/etc.) que referencien un color custom, y falla si ese
 * color no está declarado en `theme.extend.colors` de tailwind.config.js.
 *
 * Uso: node scripts/check-tailwind-colors.js
 * (corre automáticamente en CI -- ver .github/workflows/ci.yml)
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// Colores estándar de Tailwind que NO necesitan estar en el config --
// si alguien usa text-white o bg-black, no es un color custom nuestro.
const TAILWIND_BUILTIN_COLORS = new Set([
  "white", "black", "transparent", "current", "inherit",
  "slate", "gray", "zinc", "neutral", "stone", "red", "orange", "amber",
  "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue",
  "indigo", "violet", "purple", "fuchsia", "pink", "rose",
]);

function loadConfiguredColors() {
  const configPath = path.join(ROOT, "tailwind.config.js");
  const raw = fs.readFileSync(configPath, "utf8");

  // Extrae las claves de theme.extend.colors con una regex simple --
  // no evaluamos el JS para no depender de poder hacer `require()` en CI
  // sin instalar nada extra.
  const colorsBlockMatch = raw.match(/colors:\s*{([^}]*)}/s);
  if (!colorsBlockMatch) {
    throw new Error(
      "No se encontró theme.extend.colors en tailwind.config.js -- " +
        "¿se movió o renombró la sección de colores?"
    );
  }
  const colorsBlock = colorsBlockMatch[1];
  const keyRegex = /["']?([a-zA-Z0-9-]+)["']?\s*:/g;
  const colors = new Set();
  let m;
  while ((m = keyRegex.exec(colorsBlock)) !== null) {
    colors.add(m[1]);
  }
  return colors;
}

function findSourceFiles(dir, exts, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findSourceFiles(full, exts, results);
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

function findColorClassUsages(fileContent) {
  // Matchea text-NOMBRE, bg-NOMBRE, border-NOMBRE -- incluyendo variantes
  // con modificador (hover:text-NOMBRE, disabled:bg-NOMBRE, etc.)
  // No matchea text-sm, text-xl, etc. (tamaños) porque exigimos que el
  // nombre no sea puramente numérico/de tamaño conocido.
  const regex = /(?:^|[\s"'`])(?:[a-z-]+:)*(text|bg|border)-([a-zA-Z][a-zA-Z0-9-]*)/g;
  const usages = [];
  let m;
  while ((m = regex.exec(fileContent)) !== null) {
    usages.push({ prefix: m[1], colorName: m[2] });
  }
  return usages;
}

const SIZE_OR_UTILITY_SUFFIXES = new Set([
  // No son colores -- son utilidades de Tailwind con el mismo prefijo
  // (text-sm, border-2, bg-cover, etc.) que la regex de arriba puede
  // confundir con un nombre de color.
  "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl",
  "center", "left", "right", "justify", "opacity", "dashed", "solid",
  "double", "none", "hidden", "collapse", "separate", "cover", "contain",
  "auto", "top", "bottom", "transparent", "current",
  // border-{lado}: direcciones, no colores
  "t", "b", "l", "r", "x", "y", "s", "e",
]);

function main() {
  const configuredColors = loadConfiguredColors();
  const srcDirs = [path.join(ROOT, "app"), path.join(ROOT, "components")];
  const files = srcDirs.flatMap((d) =>
    findSourceFiles(d, [".tsx", ".ts", ".jsx", ".js"])
  );

  const problems = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const usages = findColorClassUsages(content);
    for (const { prefix, colorName } of usages) {
      const baseColor = colorName.split("-")[0]; // ej: "verify-light" -> "verify" si el config tiene shades, pero igual chequeamos el nombre completo primero
      if (/^\d+$/.test(colorName)) continue; // border-2, etc.
      if (SIZE_OR_UTILITY_SUFFIXES.has(colorName)) continue;
      if (TAILWIND_BUILTIN_COLORS.has(baseColor)) continue;

      const existsExact = configuredColors.has(colorName);
      const existsAsBase = configuredColors.has(baseColor);
      if (!existsExact && !existsAsBase) {
        problems.push({
          file: path.relative(ROOT, file),
          class: `${prefix}-${colorName}`,
        });
      }
    }
  }

  if (problems.length > 0) {
    console.error("\n❌ Colores de Tailwind usados pero no definidos en tailwind.config.js:\n");
    for (const p of problems) {
      console.error(`  ${p.file}: ${p.class}`);
    }
    console.error(
      "\nEsto es exactamente el bug del 2026-06-29 (ver CHANGELOG.md): " +
        "Tailwind descarta en silencio una clase que no existe, y el " +
        "elemento queda con texto invisible o sin estilo, sin ningún " +
        "error de build.\n" +
        "Fix: agregar el color faltante a theme.extend.colors en " +
        "tailwind.config.js.\n"
    );
    process.exit(1);
  }

  console.log(
    `✅ Todas las clases de color usadas en ${files.length} archivos están definidas en tailwind.config.js`
  );
}

main();
