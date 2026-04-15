# One-off patch script
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "pages" / "PlaceDetail.jsx"
s = p.read_text(encoding="utf-8")

old_import = "import './Detail.css';\n\n/** Resolved"
new_import = (
    "import './Detail.css';\n"
    "import { normalizeMenuSectionsForPlaceDisplay } from '../utils/diningProfileForm';\n\n"
    "/** Resolved"
)
if old_import not in s:
    raise SystemExit("import anchor not found")

old_menu = """  const menuSections = safeArray(raw.menuSections)
    .map((section) => ({
      title: String(section?.title || '').trim(),
      note: String(section?.note || '').trim(),
      items: safeArray(section?.items)
        .map((item) =>
          typeof item === 'string'
            ? { name: item }
            : {
                name: String(item?.name || '').trim(),
                description: String(item?.description || '').trim(),
                price: String(item?.price || '').trim(),
                badge: String(item?.badge || '').trim(),
                image: String(item?.image || '').trim(),
              }
        )
        .filter((item) => item.name),
    }))
    .filter((section) => section.title || section.items.length > 0 || section.note);

  return {"""

new_menu = """  const menuSections = normalizeMenuSectionsForPlaceDisplay(raw);

  return {"""

if old_menu not in s:
    raise SystemExit("menu block not found")

s = s.replace(old_import, new_import, 1)
s = s.replace(old_menu, new_menu, 1)
p.write_text(s, encoding="utf-8")
print("PlaceDetail.jsx patched OK")
