const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'diningProfileForm.js');
let s = fs.readFileSync(p, 'utf8');
const ins = `

/**
 * Menu sections for public place UI — coalesces storage variants and legacy keys.
 * Returns [] when there is nothing to show.
 */
export function normalizeMenuSectionsForPlaceDisplay(dp) {
  const sections = coalesceMenuSectionsInput(dp);
  const safe = Array.isArray(sections) ? sections : [];
  const mapped = safe.map((s) => {
    const title = String(s?.title || s?.heading || s?.sectionTitle || s?.section || '').trim();
    const note = String(s?.note || s?.notes || '').trim();
    const items = (Array.isArray(s?.items) ? s.items : [])
      .map((it) => {
        if (typeof it === 'string') {
          const n = it.trim();
          if (!n) return null;
          return { name: n, price: '', description: '', badge: '', image: '' };
        }
        if (!it || typeof it !== 'object') return null;
        const name = dishNameFromItem(it);
        if (!name) return null;
        return {
          name,
          price: String(it.price || it.cost || '').trim(),
          description: String(it.description || it.desc || '').trim(),
          badge: String(it.badge || '').trim(),
          image: dishImageFromItem(it),
        };
      })
      .filter(Boolean);
    return {
      title: title || 'Menu',
      note,
      items,
    };
  });
  return mapped.filter((section) => section.title || section.items.length > 0 || section.note);
}

`;
const needle = '  return out;\n}\n\n/** Maps API';
if (!s.includes(needle)) throw new Error('needle missing');
s = s.replace(needle, '  return out;\n}' + ins + '/** Maps API');
fs.writeFileSync(p, s);
console.log('patched');
