from pathlib import Path

path = Path(__file__).resolve().parent / "src" / "pages" / "PlaceDetail.jsx"
s = path.read_text(encoding="utf-8")

old1 = """        : hoursEntries.slice(0, 3).map((entry) => `${entry.label} ${entry.value}`).join(' - ');

  const reviewsContent = ("""

new1 = """        : hoursEntries.slice(0, 3).map((entry) => `${entry.label} ${entry.value}`).join(' - ');

  const mapCoords = useMemo(() => getPlaceCoordinates(place), [place]);
  const hasMapsKey =
    typeof import.meta !== 'undefined' && Boolean(import.meta.env?.VITE_GOOGLE_MAPS_API_KEY);

  const reviewsContent = ("""

old2 = """          </div>

          {place.description && ("""

new2 = """          </div>

          {mapCoords && hasMapsKey && Number.isFinite(mapCoords.lat) && Number.isFinite(mapCoords.lng) && (
            <section className="place-detail-section place-detail-map-section" aria-labelledby="place-map-heading">
              <h2 id="place-map-heading" className="place-detail-section-title">
                {t('detail', 'tourMapTab')}
              </h2>
              <div className="place-detail-map-wrap">
                <PlaceDetailMap lat={mapCoords.lat} lng={mapCoords.lng} title={place.name} t={t} />
              </div>
            </section>
          )}

          {place.description && ("""

if old1 not in s:
    raise SystemExit("BLOCK1 not found")
if old2 not in s:
    raise SystemExit("BLOCK2 not found")

s = s.replace(old1, new1, 1)
s = s.replace(old2, new2, 1)
path.write_text(s, encoding="utf-8", newline="\n")
print("patched", path)
