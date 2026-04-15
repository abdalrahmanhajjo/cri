from pathlib import Path

p = Path("client/src/pages/PlaceDining.jsx")
text = p.read_text(encoding="utf-8")

text = text.replace(
    "import { diningOfferTeaser } from '../utils/diningOfferTeaser';",
    "import { diningOfferTeaser, diningOfferLines } from '../utils/diningOfferTeaser';",
    1,
)

insert = """
  const diningOfferRows = useMemo(() => {
    if (flowParam !== 'offers') return null;
    const rows = [];
    for (const p of mainListPlaces) {
      const lines = diningOfferLines(p);
      lines.forEach((text, i) => {
        rows.push({
          rowKey: `${p.id}-offer-${i}-${String(text).slice(0, 24)}`,
          place: p,
          offerText: text,
        });
      });
    }
    return rows;
  }, [mainListPlaces, flowParam]);

  const showOfferRowCards =
    flowParam === 'offers' && Array.isArray(diningOfferRows) && diningOfferRows.length > 0;

"""

anchor = "  }, [diningPlacesFiltered, featuredIdSet, fcatParam, qParam, sortParam, flowParam]);\n\n  const placeMap = useMemo(() => {"
if anchor not in text:
    raise SystemExit("anchor1 missing")
text = text.replace(anchor, "  }, [diningPlacesFiltered, featuredIdSet, fcatParam, qParam, sortParam, flowParam]);\n" + insert + "\n  const placeMap = useMemo(() => {", 1)

old_count = """  const countLabel = (t('placeDiscover', 'resultCount') || '{count} places').replace(
    '{count}',
    String(mainListPlaces.length)
  );"""
new_count = """  const resultCountNumber = showOfferRowCards ? diningOfferRows.length : mainListPlaces.length;
  const countLabel = showOfferRowCards
    ? (t('diningGuide', 'offerResultCount') || '{count} offers').replace(
        '{count}',
        String(resultCountNumber)
      )
    : (t('placeDiscover', 'resultCount') || '{count} places').replace(
        '{count}',
        String(resultCountNumber)
      );"""
if old_count not in text:
    raise SystemExit("count block missing")
text = text.replace(old_count, new_count, 1)

old_spon = """                    <DiningMealListingCard
                      place={merged}
                      onMapClick={handleViewOnMap}
                      offerHighlight={flowParam === 'offers'}
                      mealLineCountForPlace={countMealLinesForPlace(merged.id)}"""
new_spon = """                    <DiningMealListingCard
                      place={merged}
                      onMapClick={handleViewOnMap}
                      offerHeadline={flowParam === 'offers' ? diningOfferTeaser(merged) || '' : ''}
                      offerHighlight={flowParam === 'offers' && !diningOfferTeaser(merged)}
                      mealLineCountForPlace={countMealLinesForPlace(merged.id)}"""
if old_spon not in text:
    raise SystemExit("sponsored block missing")
text = text.replace(old_spon, new_spon, 1)

old_list = """          <section className="hg-stays" aria-labelledby="hg-grid-label-dining">
            {mainListPlaces.map((p) => (
              <DiningMealListingCard
                key={p.id}
                place={p}
                onMapClick={handleViewOnMap}
                offerHighlight={flowParam === 'offers'}
                mealLineCountForPlace={countMealLinesForPlace(p.id)}
                viewDetailsLabel={t('home', 'viewDetails')}
                mapAriaLabel={t('placeDiscover', 'viewOnMap')}
                t={t}
              />
            ))}
          </section>"""
new_list = """          <section className="hg-stays" aria-labelledby="hg-grid-label-dining">
            {showOfferRowCards
              ? diningOfferRows.map((row) => (
                  <DiningMealListingCard
                    key={row.rowKey}
                    place={row.place}
                    offerHeadline={row.offerText}
                    offerHighlight={false}
                    onMapClick={handleViewOnMap}
                    mealLineCountForPlace={countMealLinesForPlace(row.place.id)}
                    viewDetailsLabel={t('home', 'viewDetails')}
                    mapAriaLabel={t('placeDiscover', 'viewOnMap')}
                    t={t}
                  />
                ))
              : mainListPlaces.map((p) => (
                  <DiningMealListingCard
                    key={p.id}
                    place={p}
                    onMapClick={handleViewOnMap}
                    offerHighlight={flowParam === 'offers'}
                    mealLineCountForPlace={countMealLinesForPlace(p.id)}
                    viewDetailsLabel={t('home', 'viewDetails')}
                    mapAriaLabel={t('placeDiscover', 'viewOnMap')}
                    t={t}
                  />
                ))}
          </section>"""
if old_list not in text:
    raise SystemExit("list block missing")
text = text.replace(old_list, new_list, 1)

p.write_text(text, encoding="utf-8")
print("PlaceDining.jsx patched")
