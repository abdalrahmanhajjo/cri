from pathlib import Path

p = Path("client/src/pages/Explore.jsx")
text = p.read_text(encoding="utf-8")

old_jsx = """      {topPicks.length > 0 && (
        <TopPicksCarousel places={topPicks} t={t} moreTo={PLACES_DISCOVER_PATH} />
      )}

"""
if old_jsx not in text:
    raise SystemExit("jsx block not found")
text = text.replace(old_jsx, "")

old_top = """  const topPicks = directoryPlaces
    .slice()
    .sort((a, b) => (Number(b?.rating) || 0) - (Number(a?.rating) || 0))
    .slice(0, 6);
"""
if old_top not in text:
    raise SystemExit("topPicks const not found")
text = text.replace(old_top, "")

start = text.find("function PlaceCard(")
end = text.find("/** How many distinct directory categories", start)
if start == -1 or end == -1:
    raise SystemExit("could not find PlaceCard/TopPicks block boundaries")
text = text[:start] + text[end:]

text = text.replace("import { Link, useNavigate } from 'react-router-dom';\n", "import { Link } from 'react-router-dom';\n")
text = text.replace("import DeliveryImg from '../components/DeliveryImg';\n", "")
text = text.replace("import { useToast } from '../context/ToastContext';\n", "")
text = text.replace("import { useFavourites } from '../context/FavouritesContext';\n", "")

p.write_text(text, encoding="utf-8")
print("done")
