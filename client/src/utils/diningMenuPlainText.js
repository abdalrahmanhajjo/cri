/**
 * Plain-text menu format for dining profile editors (no JSON).
 *
 * Format:
 * 1. Start each section with: ## Section title
 * 2. Optional line: Note: …
 * 3. One dish per line: name | price | description | badge | image URL (optional)
 *
 * If you omit ## headers, everything is treated as one section titled "Menu".
 */

export function menuSectionsToPlainText(sections) {
  if (!Array.isArray(sections) || sections.length === 0) return '';
  return sections
    .map((sec) => {
      const title = String(sec?.title || '').trim() || 'Menu';
      let block = `## ${title}`;
      const note = String(sec?.note || '').trim();
      if (note) block += `\nNote: ${note}`;
      const items = Array.isArray(sec?.items) ? sec.items : [];
      for (const raw of items) {
        if (typeof raw === 'string') {
          const n = raw.trim();
          if (n) block += `\n${n}`;
          continue;
        }
        if (!raw || typeof raw !== 'object') continue;
        const name = String(raw.name || '').trim();
        if (!name) continue;
        const price = String(raw.price || '').trim();
        const description = String(raw.description || '').trim();
        const badge = String(raw.badge || '').trim();
        const image = String(raw.image || '').trim();
        const parts = [name, price, description, badge];
        if (image) parts.push(image);
        block += `\n${parts.join(' | ')}`;
      }
      return block;
    })
    .join('\n\n');
}

export function parseMenuSectionsPlainText(text) {
  const src = String(text || '').trim();
  if (!src) return [];

  const hasHeaders = /^##\s+/m.test(src);
  const lines = src.split(/\r?\n/).map((l) => l.trim());

  const out = [];
  let section = hasHeaders ? null : { title: 'Menu', note: '', items: [] };

  const flush = () => {
    if (section && (section.title || section.items.length)) {
      out.push({
        title: (section.title || 'Menu').trim() || 'Menu',
        note: String(section.note || '').trim(),
        items: section.items,
      });
    }
    section = null;
  };

  const pushDish = (line) => {
    const parts = line.split('|').map((s) => s.trim());
    const name = parts[0];
    if (!name) return;
    const [price, description, badge, image] = parts.slice(1);
    section.items.push({
      name,
      ...(price ? { price } : {}),
      ...(description ? { description } : {}),
      ...(badge ? { badge } : {}),
      ...(image ? { image } : {}),
    });
  };

  for (const line of lines) {
    if (!line) continue;
    const hm = line.match(/^##\s+(.+)$/);
    if (hm) {
      flush();
      section = { title: hm[1].trim(), note: '', items: [] };
      continue;
    }
    if (!section) section = { title: 'Menu', note: '', items: [] };

    const nm = line.match(/^Note:\s*(.*)$/i);
    if (nm) {
      section.note = nm[1].trim();
      continue;
    }
    if (line.includes('|')) {
      pushDish(line);
    } else {
      section.items.push({ name: line });
    }
  }
  flush();
  return out.filter((s) => s.items.length > 0 || s.note || (s.title && s.title !== 'Menu'));
}
