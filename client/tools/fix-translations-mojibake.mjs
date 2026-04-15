/**
 * Fixes UTF-8 text that was misinterpreted as Latin-1 (mojibake) in translations.js.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, '../src/i18n/translations.js');
let s = fs.readFileSync(file, 'utf8');

function looksMojibake(str) {
  return /[ØÙÃ]|â€/.test(str);
}

/** Only fix UTF-8 read as Latin-1; skip real Arabic/French Unicode (code points > 255). */
function isAllLatin1Range(str) {
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 255) return false;
  }
  return true;
}

function fixLatin1Utf8(str) {
  try {
    return Buffer.from(str, 'latin1').toString('utf8');
  } catch {
    return str;
  }
}

const lines = s.split('\n');
let changed = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!looksMojibake(line)) continue;
  const newLine = line.replace(/'([^'\\]|\\.)*'/gs, (m) => {
    const inner = m.slice(1, -1);
    const unescaped = inner.replace(/\\'/g, "'");
    if (!looksMojibake(unescaped) || !isAllLatin1Range(unescaped)) return m;
    const fixed = fixLatin1Utf8(unescaped);
    if (fixed === unescaped) return m;
    changed++;
    const reescaped = fixed.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${reescaped}'`;
  });
  if (newLine !== line) lines[i] = newLine;
}

const out = lines.join('\n');
if (out !== s) {
  fs.writeFileSync(file, out, 'utf8');
  console.log(`Updated translations.js (${changed} string literals touched)`);
} else {
  console.log('No changes needed');
}
