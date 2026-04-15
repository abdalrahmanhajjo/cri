const fs = require('fs');
const p = 'client/src/pages/business/BusinessPlaceEdit.jsx';
let s = fs.readFileSync(p, 'utf8');

if (!s.includes("from '../../utils/diningProfileForm'")) {
  s = s.replace(
    "import MapPicker from '../../components/MapPicker';\nimport './Business.css';",
    "import MapPicker from '../../components/MapPicker';\nimport { diningProfileToFormFields, buildDiningProfilePayload } from '../../utils/diningProfileForm';\nimport './Business.css';"
  );
}

const oldBlock = `function diningProfileToForm(dp) {
  const profile = dp && typeof dp === 'object' && !Array.isArray(dp) ? dp : {};
  const signatureLines = Array.isArray(profile.signatureDishes)
    ? profile.signatureDishes
        .map((item) => {
          if (typeof item === 'string') return item;
          if (!item || typeof item !== 'object') return '';
          return [item.name || '', item.price || '', item.description || '', item.badge || '']
            .map((part) => String(part || '').trim())
            .join(' | ')
            .replace(/(\\s\\|\\s)+$/, '');
        })
        .filter(Boolean)
        .join('\\n')
    : '';

  const menuSectionsJson = Array.isArray(profile.menuSections) && profile.menuSections.length
    ? JSON.stringify(profile.menuSections, null, 2)
    : '';

  return {
    diningCuisines: Array.isArray(profile.cuisines) ? profile.cuisines.join(', ') : '',
    diningBestFor: Array.isArray(profile.bestFor) ? profile.bestFor.join(', ') : '',
    diningDietary: Array.isArray(profile.dietaryOptions) ? profile.dietaryOptions.join(', ') : '',
    diningServices: Array.isArray(profile.serviceModes) ? profile.serviceModes.join(', ') : '',
    diningAtmosphere: profile.atmosphere || '',
    diningReservationNotes: profile.reservationNotes || '',
    diningContactAddress: profile.contactAddress || profile.address || '',
    diningContactPhone: profile.contactPhone || profile.phone || '',
    diningContactEmail: profile.contactEmail || profile.email || '',
    diningContactNote: profile.contactNote || '',
    diningMenuNote: profile.menuNote || '',
    diningSignatureDishes: signatureLines,
    diningMenuJson: menuSectionsJson,
  };
}

function splitCommaList(value) {
  return String(value || '')
    .split(/[,;\\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSignatureDishLines(value) {
  return String(value || '')
    .split(/\\r?\\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = '', price = '', description = '', badge = ''] = line.split('|').map((part) => part.trim());
      return {
        name,
        ...(price ? { price } : {}),
        ...(description ? { description } : {}),
        ...(badge ? { badge } : {}),
      };
    })
    .filter((item) => item.name);
}

`;

if (s.includes('function diningProfileToForm(dp)')) {
  s = s.replace(oldBlock, '');
}

s = s.replace('...diningProfileToForm(p.diningProfile)', '...diningProfileToFormFields(p.diningProfile)');

const oldSubmit = `      let menuSections = [];
      if (form.diningMenuJson?.trim()) {
        try {
          const parsed = JSON.parse(form.diningMenuJson);
          if (!Array.isArray(parsed)) {
            setError('Menu sections must be a JSON array.');
            setSaving(false);
            return;
          }
          menuSections = parsed;
        } catch {
          setError('Menu sections JSON is invalid.');
          setSaving(false);
          return;
        }
      }
      const diningProfile = {
        cuisines: splitCommaList(form.diningCuisines),
        bestFor: splitCommaList(form.diningBestFor),
        dietaryOptions: splitCommaList(form.diningDietary),
        serviceModes: splitCommaList(form.diningServices),
        atmosphere: String(form.diningAtmosphere || '').trim(),
        reservationNotes: String(form.diningReservationNotes || '').trim(),
        contactAddress: String(form.diningContactAddress || '').trim(),
        contactPhone: String(form.diningContactPhone || '').trim(),
        contactEmail: String(form.diningContactEmail || '').trim(),
        contactNote: String(form.diningContactNote || '').trim(),
        menuNote: String(form.diningMenuNote || '').trim(),
        signatureDishes: parseSignatureDishLines(form.diningSignatureDishes),
        menuSections,
      };
`;

if (s.includes('form.diningMenuJson')) {
  s = s.replace(oldSubmit, '      const diningProfile = buildDiningProfilePayload(form);\n');
}

const oldUi = `            <div className="business-field">
              <label>Menu sections (JSON)</label>
              <textarea
                className="business-textarea"
                rows={12}
                value={form.diningMenuJson || ''}
                onChange={setField('diningMenuJson')}
                spellCheck={false}
                placeholder={'[\\n  {\\n    "title": "Breakfast",\\n    "note": "Served until noon",\\n    "items": [\\n      { "name": "Zaatar Manousheh", "price": "4$", "description": "Stone-baked flatbread", "badge": "Popular" }\\n    ]\\n  }\\n]'}
              />
              <p className="business-hint">Optional structured menu used by the public restaurant menu tab.</p>
            </div>`;

const newUi = `            <div className="business-field">
              <label>Menu sections (plain text)</label>
              <textarea
                className="business-textarea"
                rows={12}
                value={form.diningMenuPlain || ''}
                onChange={setField('diningMenuPlain')}
                spellCheck={false}
                placeholder={\`## Breakfast\\nNote: Served until noon.\\n\\nZaatar Manousheh | 4$ | Stone-baked flatbread | Popular\\n\\n## Cold mezza\\nLabneh | 4$ | Strained yogurt |\`}
              />
              <p className="business-hint">
                Optional. Use <code>##</code> for each section, <code>Note:</code> for a short intro, then one dish per line with
                <code> | </code> between name, price, description, and badge.
              </p>
            </div>`;

if (s.includes('Menu sections (JSON)')) {
  s = s.replace(oldUi, newUi);
}

const oldIntro = `            <p className="business-hint" style={{ marginBottom: '1rem' }}>
              Build a restaurant-grade detail page: cuisines, what the venue is best for, service options, signature dishes,
              and structured menu sections for the public menu tab.
            </p>`;

const newIntro = `            <p className="business-hint" style={{ marginBottom: '0.75rem' }}>
              Fill in normal text—no JSON. Suggested order: cuisines and services, contact details, then signature dishes and menu
              sections for the public menu tab.
            </p>
            <ol className="business-hint business-dining-steps" style={{ margin: '0 0 1rem 1.1rem', padding: 0, lineHeight: 1.5 }}>
              <li>Tags: cuisines, best for, dietary options, service modes (comma-separated).</li>
              <li>Story: atmosphere and reservation notes.</li>
              <li>Guest contact: address, phone, email, extra note.</li>
              <li>Signature dishes: one per line as <code>name | price | description | badge</code>.</li>
              <li>
                Menu sections: plain text—start each group with <code>## Section name</code>, optional <code>Note: …</code>, then dish
                lines (same <code>|</code> format as above).
              </li>
            </ol>`;

if (s.includes('Build a restaurant-grade detail page')) {
  s = s.replace(oldIntro, newIntro);
}

fs.writeFileSync(p, s);
console.log('patched', p);
