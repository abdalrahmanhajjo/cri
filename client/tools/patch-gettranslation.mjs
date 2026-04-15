import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "../src/i18n/translations.js");
let s = fs.readFileSync(file, "utf8");
const oldFn = "export function getTranslation(lang, namespace, key) {\n  const base = translations[lang]?.[namespace]?.[key];\n  const overrides = getTranslationOverrides();\n  const override = overrides[lang]?.[namespace]?.[key];\n  if (translationOverrideAllowed(namespace, key) && override !== undefined) {\n    return normalizeTranslationValue(override);\n  }\n  return normalizeTranslationValue(base ?? key);\n}";
const newFn = "export function getTranslation(lang, namespace, key) {\n  const overrides = getTranslationOverrides();\n  const override = overrides[lang]?.[namespace]?.[key];\n  if (translationOverrideAllowed(namespace, key) && override !== undefined) {\n    return normalizeTranslationValue(override);\n  }\n  const base = translations[lang]?.[namespace]?.[key];\n  const enFallback = lang !== \"en\" ? translations.en?.[namespace]?.[key] : undefined;\n  return normalizeTranslationValue(base ?? enFallback ?? key);\n}";
if (!s.includes(oldFn)) { console.error("getTranslation not found"); process.exit(1); }
s = s.replace(oldFn, newFn);
fs.writeFileSync(file, s, "utf8");
console.log("patched getTranslation");
