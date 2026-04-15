import fs from 'fs';
const p = 'client/src/pages/PlaceDining.jsx';
let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

if (!c.includes("const qParam = searchParams.get('q') || '';")) throw new Error('qParam block');
c = c.replace(
  "const qParam = searchParams.get('q') || '';\n",
  "const qParam = searchParams.get('q') || '';\n  const flowParam = searchParams.get('flow') || '';\n"
);

const insertAfter = `  const diningPlacesAll = useMemo(
    () =>
      places.filter(
        (p) => isLikelyDiningPlace(p, foodCategoryIds) && !hiddenPlaceIdSet.has(String(p.id))
      ),
    [places, foodCategoryIds, hiddenPlaceIdSet]
  );
  const diningPlaceIdSet = useMemo(() => new Set(diningPlacesAll.map((p) => String(p.id))), [diningPlacesAll]);`;

const insertNew = `  const diningPlacesAll = useMemo(
    () =>
      places.filter(
        (p) => isLikelyDiningPlace(p, foodCategoryIds) && !hiddenPlaceIdSet.has(String(p.id))
      ),
    [places, foodCategoryIds, hiddenPlaceIdSet]
  );
  const diningPlacesFiltered = useMemo(() => {
    if (!flowParam) return diningPlacesAll;
    return diningPlacesAll.filter((pl) => matchesDiningFlow(pl, flowParam));
  }, [diningPlacesAll, flowParam]);
  const diningPlaceIdSet = useMemo(
    () => new Set(diningPlacesFiltered.map((p) => String(p.id))),
    [diningPlacesFiltered]
  );`;

if (!c.includes(insertAfter)) throw new Error('diningPlacesAll block not found');
c = c.replace(insertAfter, insertNew);

c = c.replace(
  '  const filteredForTopPicks = useMemo(() => {\n    let base = diningPlacesAll;',
  '  const filteredForTopPicks = useMemo(() => {\n    let base = diningPlacesFiltered;'
);
c = c.replace(
  '  }, [diningPlacesAll, fcatParam, qParam]);\n\n  const filteredTopPicksById',
  '  }, [diningPlacesFiltered, fcatParam, qParam]);\n\n  const filteredTopPicksById'
);

c = c.replace(
  '  const mainListPlaces = useMemo(() => {\n    let base = diningPlacesAll;',
  '  const mainListPlaces = useMemo(() => {\n    let base = diningPlacesFiltered;'
);
c = c.replace(
  '  }, [diningPlacesAll, diningGuide.featuredPlaceIds, featuredIdSet, fcatParam, qParam, sortParam]);\n\n  const placeMap',
  '  }, [diningPlacesFiltered, diningGuide.featuredPlaceIds, featuredIdSet, fcatParam, qParam, sortParam]);\n\n  const placeMap'
);

const setParamBlock = `  const setParam = useCallback(
    (key, value) => {
      const next = new URLSearchParams(searchParams);
      if (value === '' || value == null) next.delete(key);
      else next.set(key, String(value));
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );`;

const setParamNew = `  const setParam = useCallback(
    (key, value) => {
      const next = new URLSearchParams(searchParams);
      if (value === '' || value == null) next.delete(key);
      else next.set(key, String(value));
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const selectDiningFlow = useCallback(
    (flow) => {
      const next = new URLSearchParams(searchParams);
      if (!flow) next.delete('flow');
      else next.set('flow', flow);
      setSearchParams(next, { replace: true });
      window.setTimeout(() => {
        toolbarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    },
    [searchParams, setSearchParams]
  );`;

if (!c.includes(setParamBlock)) throw new Error('setParam not found');
c = c.replace(setParamBlock, setParamNew);

c = c.replace(
  '<GuideExperienceBand t={t} ns="diningGuide" />',
  '<DiningFlowRibbon activeFlow={flowParam} onSelectFlow={selectDiningFlow} t={t} />'
);

c = c.replace(
  `{mainListPlaces.length === 0 ? (
          <p className="hg-empty">{t('home', 'noSpots')}</p>
        ) : (`,
  `{mainListPlaces.length === 0 ? (
          <p className="hg-empty">{flowParam ? t('diningGuide', 'flowEmpty') : t('home', 'noSpots')}</p>
        ) : (`
);

fs.writeFileSync(p, c.replace(/\n/g, '\r\n'));
console.log('patched');
