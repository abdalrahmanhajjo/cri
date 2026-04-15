from pathlib import Path

p = Path("client/src/pages/PlaceDetail.jsx")
text = p.read_text(encoding="utf-8")

old1 = """  }, [place, user, navigate, location.pathname, location.search, location.hash]);

  if (loading) {"""
new1 = """  }, [place, user, navigate, location.pathname, location.search, location.hash]);

  const mapCoords = useMemo(() => getPlaceCoordinates(place), [place]);

  if (loading) {"""

old2 = """        : hoursEntries.slice(0, 3).map((entry) => `${entry.label} ${entry.value}`).join(' - ');

  const mapCoords = useMemo(() => getPlaceCoordinates(place), [place]);
  const hasMapsKey ="""
new2 = """        : hoursEntries.slice(0, 3).map((entry) => `${entry.label} ${entry.value}`).join(' - ');

  const hasMapsKey ="""

if old1 not in text:
    raise SystemExit("block1 not found")
if old2 not in text:
    raise SystemExit("block2 not found")

p.write_text(text.replace(old1, new1, 1).replace(old2, new2, 1), encoding="utf-8")
print("ok")
