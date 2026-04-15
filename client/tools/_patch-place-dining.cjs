const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '../src/pages/PlaceDining.jsx');
let s = fs.readFileSync(p, 'utf8');
const eol = '\r\n';

if (!s.includes('publicPromotions')) throw new Error('missing publicPromotions state');

const anchor = `  }, [langParam, sponsoredDiningEnabled]);${eol}${eol}`;
if (!s.includes(anchor)) throw new Error('sponsored effect anchor not found');
if (!s.includes('api.publicPromotions')) {
  const effect = `  useEffect(() => {
    let cancelled = false;
    api
      .publicPromotions({ limit: 200, lang: langParam })
      .then((r) => {
        if (!cancelled) setPublicPromotions(Array.isArray(r?.promotions) ? r.promotions : []);
      })
      .catch(() => {
        if (!cancelled) setPublicPromotions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [langParam]);

`;
  s = s.replace(anchor, anchor + effect);
}

const oldBlock = `  const diningPlacesFiltered = useMemo(() => {
    if (!flowParam) return diningPlacesAll;
    return diningPlacesAll.filter((pl) => matchesDiningFlow(pl, flowParam));
  }, [diningPlacesAll, flowParam]);
  const flowCounts = useMemo(() => {
    const all = diningPlacesAll;
    const counts = { all: all.length, reserve: 0, order: 0, menu: 0, offers: 0 };
    all.forEach((pl) => {
      if (matchesDiningFlow(pl, 'reserve')) counts.reserve += 1;
      if (matchesDiningFlow(pl, 'order')) counts.order += 1;
      if (matchesDiningFlow(pl, 'menu')) counts.menu += 1;
      if (matchesDiningFlow(pl, 'offers')) counts.offers += 1;
    });
    return counts;
  }, [diningPlacesAll]);
  const diningPlaceIdSet = useMemo(
    () => new Set(diningPlacesFiltered.map((p) => String(p.id))),
    [diningPlacesFiltered]
  );
  const featuredIdSet = useMemo(
    () => new Set((diningGuide.featuredPlaceIds || []).map((id) => String(id))),
    [diningGuide.featuredPlaceIds]
  );

  const sponsoredDining = useMemo(() => {
    return sponsoredItems.filter((it) => {
      const pid =
        it?.placeId != null ? String(it.placeId) : it?.place?.id != null ? String(it.place.id) : '';
      return pid && diningPlaceIdSet.has(pid);
    });
  }, [sponsoredItems, diningPlaceIdSet]);

  const mainListPlaces = useMemo(() => {
    let base = diningPlacesFiltered;
    if (fcatParam) {
      const id = String(fcatParam);
      base = base.filter((p) => String(p.categoryId ?? p.category_id) === id);
    }
    const q = qParam.trim();
    if (q) {
      const narrow = filterPlacesByQuery(base, q);
      base = narrow.length > 0 ? narrow : base;
    }
    const sort = sortParam === 'rating' || sortParam === 'name' ? sortParam : 'recommended';
    const sorted =
      sort === 'recommended'
        ? [...base].sort(
            (a, b) =>
              diningSmartScore(b, { query: qParam, activeCategoryId: fcatParam, featuredIds: featuredIdSet }) -
              diningSmartScore(a, { query: qParam, activeCategoryId: fcatParam, featuredIds: featuredIdSet })
          )
        : sortDiscoverPlaces(base, { query: qParam, sort });
    let combined = sorted;
    if (flowParam === 'offers') {
      combined = [...combined].sort((a, b) => {
        const la = diningOfferTeaser(a).length;
        const lb = diningOfferTeaser(b).length;
        if (lb !== la) return lb - la;
        return (
          diningSmartScore(b, { query: qParam, activeCategoryId: fcatParam, featuredIds: featuredIdSet }) -
          diningSmartScore(a, { query: qParam, activeCategoryId: fcatParam, featuredIds: featuredIdSet })
        );
      });
    }
    return combined;
  }, [diningPlacesFiltered, featuredIdSet, fcatParam, qParam, sortParam, flowParam]);

  const diningOfferRows = useMemo(() => {
    if (flowParam !== 'offers') return null;
    const rows = [];
    for (const p of mainListPlaces) {
      const lines = diningOfferLines(p);
      lines.forEach((text, i) => {
        rows.push({
          rowKey: \`\${p.id}-offer-\${i}-\${String(text).slice(0, 24)}\`,
          place: p,
          offerText: text,
        });
      });
    }
    return rows;
  }, [mainListPlaces, flowParam]);

  const showOfferRowCards =
    flowParam === 'offers' && Array.isArray(diningOfferRows) && diningOfferRows.length > 0;


  const placeMap = useMemo(() => {
    const m = {};
    (places || []).forEach((p) => {
      if (p && p.id != null) m[String(p.id)] = p;
    });
    return m;
  }, [places]);`;

const newBlock = `  const diningPlacesFiltered = useMemo(() => {
    if (!flowParam) return diningPlacesAll;
    if (flowParam === 'offers') return diningPlacesAll;
    return diningPlacesAll.filter((pl) => matchesDiningFlow(pl, flowParam));
  }, [diningPlacesAll, flowParam]);

  const placeMap = useMemo(() => {
    const m = {};
    (places || []).forEach((p) => {
      if (p && p.id != null) m[String(p.id)] = p;
    });
    return m;
  }, [places]);

  const diningIdSetAll = useMemo(
    () => new Set(diningPlacesAll.map((p) => String(p.id))),
    [diningPlacesAll]
  );

  const diningPromotionsForPlaces = useMemo(
    () =>
      publicPromotions.filter((pr) => pr.placeId != null && diningIdSetAll.has(String(pr.placeId))),
    [publicPromotions, diningIdSetAll]
  );

  const flowCounts = useMemo(() => {
    const all = diningPlacesAll;
    const counts = { all: all.length, reserve: 0, order: 0, menu: 0, offers: 0 };
    const offerPlaceIds = new Set();
    all.forEach((pl) => {
      if (matchesDiningFlow(pl, 'reserve')) counts.reserve += 1;
      if (matchesDiningFlow(pl, 'order')) counts.order += 1;
      if (matchesDiningFlow(pl, 'menu')) counts.menu += 1;
      if (diningOfferLines(pl).length > 0) offerPlaceIds.add(String(pl.id));
    });
    diningPromotionsForPlaces.forEach((pr) => {
      offerPlaceIds.add(String(pr.placeId));
    });
    counts.offers = offerPlaceIds.size;
    return counts;
  }, [diningPlacesAll, diningPromotionsForPlaces]);
  const diningPlaceIdSet = useMemo(
    () => new Set(diningPlacesFiltered.map((p) => String(p.id))),
    [diningPlacesFiltered]
  );
  const featuredIdSet = useMemo(
    () => new Set((diningGuide.featuredPlaceIds || []).map((id) => String(id))),
    [diningGuide.featuredPlaceIds]
  );

  const sponsoredDining = useMemo(() => {
    return sponsoredItems.filter((it) => {
      const pid =
        it?.placeId != null ? String(it.placeId) : it?.place?.id != null ? String(it.place.id) : '';
      return pid && diningPlaceIdSet.has(pid);
    });
  }, [sponsoredItems, diningPlaceIdSet]);

  const mainListPlaces = useMemo(() => {
    let base = diningPlacesFiltered;
    if (fcatParam) {
      const id = String(fcatParam);
      base = base.filter((p) => String(p.categoryId ?? p.category_id) === id);
    }
    const q = qParam.trim();
    if (q) {
      const narrow = filterPlacesByQuery(base, q);
      base = narrow.length > 0 ? narrow : base;
    }
    const sort = sortParam === 'rating' || sortParam === 'name' ? sortParam : 'recommended';
    const sorted =
      sort === 'recommended'
        ? [...base].sort(
            (a, b) =>
              diningSmartScore(b, { query: qParam, activeCategoryId: fcatParam, featuredIds: featuredIdSet }) -
              diningSmartScore(a, { query: qParam, activeCategoryId: fcatParam, featuredIds: featuredIdSet })
          )
        : sortDiscoverPlaces(base, { query: qParam, sort });
    let combined = sorted;
    if (flowParam === 'offers') {
      combined = [...combined].sort((a, b) => {
        const la = diningOfferLines(a).length;
        const lb = diningOfferLines(b).length;
        if (lb !== la) return lb - la;
        return (
          diningSmartScore(b, { query: qParam, activeCategoryId: fcatParam, featuredIds: featuredIdSet }) -
          diningSmartScore(a, { query: qParam, activeCategoryId: fcatParam, featuredIds: featuredIdSet })
        );
      });
    }
    return combined;
  }, [diningPlacesFiltered, featuredIdSet, fcatParam, qParam, sortParam, flowParam]);

  const mainListPlaceIdSet = useMemo(
    () => new Set(mainListPlaces.map((p) => String(p.id))),
    [mainListPlaces]
  );

  const diningOfferRows = useMemo(() => {
    if (flowParam !== 'offers') return null;
    const rows = [];
    const seen = new Set();
    const add = (place, text, rowKey) => {
      const x = String(text || '').trim();
      if (x.length < 3) return;
      const dedupe = \`\${String(place.id)}\\u001f\${x.toLowerCase()}\`;
      if (seen.has(dedupe)) return;
      seen.add(dedupe);
      rows.push({ rowKey, place, offerText: x });
    };

    for (const pr of diningPromotionsForPlaces) {
      const pid = String(pr.placeId ?? '');
      if (!mainListPlaceIdSet.has(pid)) continue;
      const pl = placeMap[pid];
      if (!pl) continue;
      const promoText = [pr.title, pr.subtitle, pr.discountLabel]
        .map((e) => String(e || '').trim())
        .filter(Boolean)
        .join(' — ');
      add(pl, promoText, \`promo-\${pr.id}\`);
    }
    for (const pl of mainListPlaces) {
      diningOfferLines(pl).forEach((text, i) => {
        add(pl, text, \`\${pl.id}-offer-\${i}-\${String(text).slice(0, 20)}\`);
      });
    }
    return rows;
  }, [flowParam, diningPromotionsForPlaces, mainListPlaces, mainListPlaceIdSet, placeMap]);`;

if (!s.includes(oldBlock)) {
  console.error('oldBlock not found — file may have changed');
  process.exit(1);
}
s = s.replace(oldBlock, newBlock);

const oldResult = `  const resultCountNumber = showOfferRowCards ? diningOfferRows.length : mainListPlaces.length;
  const countLabel = showOfferRowCards
    ? (t('diningGuide', 'offerResultCount') || '{count} offers').replace(
        '{count}',
        String(resultCountNumber)
      )
    : (t('placeDiscover', 'resultCount') || '{count} places').replace(
        '{count}',
        String(resultCountNumber)
      );`;

const newResult = `  const resultCountNumber =
    flowParam === 'offers'
      ? Array.isArray(diningOfferRows)
        ? diningOfferRows.length
        : 0
      : mainListPlaces.length;
  const countLabel =
    flowParam === 'offers'
      ? (t('diningGuide', 'offerResultCount') || '{count} offers').replace(
          '{count}',
          String(resultCountNumber)
        )
      : (t('placeDiscover', 'resultCount') || '{count} places').replace(
          '{count}',
          String(resultCountNumber)
        );`;

if (!s.includes(oldResult)) {
  console.error('result block not found');
  process.exit(1);
}
s = s.replace(oldResult, newResult);

fs.writeFileSync(p, s);
console.log('PlaceDining patched OK');
