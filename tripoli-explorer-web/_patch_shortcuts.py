from pathlib import Path

p = Path("client/src/pages/PlaceDiscover.jsx")
text = p.read_text(encoding="utf-8")
old = """          <Link to={DINING_PATH} className="pd-shortcut">
            {t('nav', 'diningNav')}
          </Link>
          <Link to={HOTELS_PATH} className="pd-shortcut">
            {t('nav', 'hotelsNav')}
          </Link>"""
new = """          <NavLink
            to={DINING_PATH}
            end
            className={({ isActive }) => `pd-shortcut ${isActive ? 'pd-shortcut--active' : ''}`}
          >
            {t('nav', 'diningNav')}
          </NavLink>
          <NavLink
            to={HOTELS_PATH}
            end
            className={({ isActive }) => `pd-shortcut ${isActive ? 'pd-shortcut--active' : ''}`}
          >
            {t('nav', 'hotelsNav')}
          </NavLink>"""
if old not in text:
    raise SystemExit("OLD BLOCK NOT FOUND")
p.write_text(text.replace(old, new), encoding="utf-8")
print("OK")
