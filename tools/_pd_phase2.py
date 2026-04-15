import pathlib

p = pathlib.Path("client/src/pages/PlaceDining.jsx")
s = p.read_text(encoding="utf-8")

resolve_fn = """
function resolveSponsoredPlaceForCard(item, placeMap) {
  const pid =
    item?.placeId != null
      ? String(item.placeId)
      : item?.place?.id != null
        ? String(item.place.id)
        : '';
  const fromList = pid ? placeMap[pid] : null;
  const base = fromList ? { ...fromList, ...(item?.place && typeof item.place === 'object' ? item.place : {}) } : item?.place;
  if (!base || base.id == null) return null;
  const title = String(item?.titleOverride || '').trim();
  const sub = String(item?.subtitleOverride || '').trim();
  return {
    ...base,
    ...(title ? { name: title } : {}),
    ...(sub ? { location: sub } : {}),
  };
}

"""

# Remove unused DINING_PLACE_HASH + serviceModeLabel
old_top = """const DINING_PLACE_HASH = '#place-dining-heading';

function serviceModeLabel(token, t) {
  const k = String(token || '').toLowerCase();
  const id =
    k === 'delivery'
      ? 'svcDelivery'
      : k === 'takeaway'
        ? 'svcTakeaway'
        : k === 'reservations'
          ? 'svcReservations'
          : k === 'outdoor seating'
            ? 'svcOutdoor'
            : null;
  return id ? t('diningGuide', id) : token;
}

export default function PlaceDining() {"""

new_top = resolve_fn + "export default function PlaceDining() {"
if old_top not in s:
    raise SystemExit("old_top block not found")
s = s.replace(old_top, new_top, 1)

# State: replace trip with meal cart
old_state = """  const [qDraft, setQDraft] = useState(qParam);
  const [tripPickPlace, setTripPickPlace] = useState(null);
  const [tripModalTrips, setTripModalTrips] = useState([]);
  const [tripModalLoading, setTripModalLoading] = useState(false);
  const [tripAddSaving, setTripAddSaving] = useState(false);
  const [toast, setToast] = useState(null);"""

new_state = """  const [qDraft, setQDraft] = useState(qParam);
  const [mealCart, setMealCart] = useState(() => getMealCart());
  const [toast, setToast] = useState(null);"""

if old_state not in s:
    raise SystemExit("old_state not found")
s = s.replace(old_state, new_state, 1)

# Remove trips useEffect block
old_fx = """  useEffect(() => {
    if (!tripPickPlace || !user) {
      setTripModalTrips([]);
      return;
    }
    let cancelled = false;
    setTripModalLoading(true);
    api.user
      .trips()
      .then((res) => {
        if (!cancelled) setTripModalTrips(Array.isArray(res.trips) ? res.trips : []);
      })
      .catch(() => {
        if (!cancelled) setTripModalTrips([]);
      })
      .finally(() => {
        if (!cancelled) setTripModalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tripPickPlace, user]);

"""

s = s.replace(old_fx, "", 1)

# mainListPlaces — replace return and dependency
old_ml = """    const rest = sorted.filter((p) => !featuredSet.has(String(p.id)));
    return [...orderedFeatured, ...rest];
  }, [diningPlacesFiltered, diningGuide.featuredPlaceIds, featuredIdSet, fcatParam, qParam, sortParam]);"""

new_ml = """    const rest = sorted.filter((p) => !featuredSet.has(String(p.id)));
    let combined = [...orderedFeatured, ...rest];
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
  }, [diningPlacesFiltered, diningGuide.featuredPlaceIds, featuredIdSet, fcatParam, qParam, sortParam, flowParam]);"""

if old_ml not in s:
    raise SystemExit("mainListPlaces tail not found")
s = s.replace(old_ml, new_ml, 1)

# Handlers: remove openAddToTrip through escape useEffect, insert cart handlers after handleViewOnMap
old_handlers = """  const openAddToTrip = useCallback(
    (place) => {
      const returnTo = `${location.pathname}${location.search}${location.hash || ''}`;
      if (!user) {
        navigate('/login', { state: { from: returnTo } });
        return;
      }
      setTripPickPlace(place);
    },
    [user, navigate, location.pathname, location.search, location.hash]
  );

  const closeTripModal = useCallback(() => {
    setTripPickPlace(null);
  }, []);

  const addPlaceToTripFirstDay = useCallback(
    async (trip) => {
      if (!tripPickPlace || tripAddSaving) return;
      const start = toDateOnly(trip.startDate);
      const end = toDateOnly(trip.endDate);
      const dayCount = getDayCount(start || trip.startDate, end || trip.endDate);
      const days = ensureDaysArray(trip.days, dayCount);
      const idStr = String(tripPickPlace.id);
      const firstIds = days[0]?.placeIds || [];
      if (firstIds.includes(idStr)) {
        showToast(t('placeDiscover', 'addToTripAlready'), 'info');
        closeTripModal();
        return;
      }
      const mergedIds = sortPlacesForItinerary([...firstIds, idStr], placeMap);
      const newDaysPlaceIds = [{ placeIds: mergedIds }, ...days.slice(1).map((d) => ({ placeIds: [...(d?.placeIds || [])] }))];
      const newDays = tripDaysPlaceIdsOnlyToPayload(newDaysPlaceIds, start || toDateOnly(trip.startDate));

      setTripAddSaving(true);
      try {
        await api.user.updateTrip(trip.id, { days: newDays });
        showToast(
          (t('placeDiscover', 'addToTripSuccess') || '').replace('{name}', trip.name || ''),
          'success'
        );
        closeTripModal();
      } catch (err) {
        showToast(err?.message || t('placeDiscover', 'addToTripFailed'), 'error');
      } finally {
        setTripAddSaving(false);
      }
    },
    [tripPickPlace, tripAddSaving, placeMap, showToast, t, closeTripModal]
  );

  useEffect(() => {
    if (!tripPickPlace) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeTripModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tripPickPlace, closeTripModal]);

"""

new_handlers = """  const handleAddMealToCart = useCallback(
    (place) => {
      const returnTo = `${location.pathname}${location.search}${location.hash || ''}`;
      if (!user) {
        navigate('/login', { state: { from: returnTo } });
        return;
      }
      const added = pushMealToCart(place);
      if (added) {
        setMealCart(getMealCart());
        showToast(t('diningGuide', 'mealCartToastAdded'), 'success');
      } else {
        showToast(t('diningGuide', 'mealCartToastDup'), 'info');
      }
    },
    [user, navigate, location.pathname, location.search, location.hash, showToast, t]
  );

  useEffect(() => {
    const onCart = () => setMealCart(getMealCart());
    window.addEventListener('dining-meal-cart-changed', onCart);
    return () => window.removeEventListener('dining-meal-cart-changed', onCart);
  }, []);

"""

if old_handlers not in s:
    raise SystemExit("old_handlers not found")
s = s.replace(old_handlers, new_handlers, 1)

# mainCollectionTitleSr
old_title = """  const mainCollectionTitleSr =
    String(secLoc.mainCollectionTitle || '').trim() || t('diningGuide', 'mainCollectionTitle');"""

new_title = """  const flowTitleKey =
    flowParam === 'reserve' || flowParam === 'order' || flowParam === 'menu' || flowParam === 'offers'
      ? `mainCollectionTitle_${flowParam}`
      : '';
  const mainCollectionTitleSr =
    String(secLoc.mainCollectionTitle || '').trim() ||
    (flowTitleKey ? t('diningGuide', flowTitleKey) : t('diningGuide', 'mainCollectionTitle'));
  const flowIntroKey =
    flowParam === 'reserve' || flowParam === 'order' || flowParam === 'menu' || flowParam === 'offers'
      ? `flowIntro_${flowParam}`
      : '';
  const flowIntroText = flowIntroKey ? t('diningGuide', flowIntroKey) : '';"""

if old_title not in s:
    raise SystemExit("mainCollectionTitleSr not found")
s = s.replace(old_title, new_title, 1)

# Remove locale line
s = s.replace("  const locale = lang === 'ar' ? 'ar-LB' : lang === 'fr' ? 'fr-LB' : 'en-GB';\n\n", "", 1)

# Hero trust icon
s = s.replace(
    '<li className="dg-hero-trust__item">\n              <Icon name="event_note" size={18} aria-hidden />',
    '<li className="dg-hero-trust__item">\n              <Icon name="shopping_cart" size={18} aria-hidden />',
    1,
)

# Sponsored card
old_spon = """                    <DiningListingCard
                      place={merged}
                      onMapClick={handleViewOnMap}
                      onAddToTrip={openAddToTrip}
                      viewDetailsLabel={t('home', 'viewDetails')}
                      mapAriaLabel={t('placeDiscover', 'viewOnMap')}
                      addToTripLabel={t('placeDiscover', 'addToTrip')}
                      t={t}
                      sponsoredBadge={badge || t('discover', 'sponsoredLabel')}
                    />"""

new_spon = """                    <DiningMealListingCard
                      place={merged}
                      onMapClick={handleViewOnMap}
                      onAddMealToCart={handleAddMealToCart}
                      offerHighlight={flowParam === 'offers'}
                      inMealCart={mealCart.some((x) => x.id === String(merged.id))}
                      viewDetailsLabel={t('home', 'viewDetails')}
                      mapAriaLabel={t('placeDiscover', 'viewOnMap')}
                      addMealCartLabel={t('diningGuide', 'cardActionAddCart')}
                      addMealCartAddedLabel={t('diningGuide', 'mealCartToastDup')}
                      t={t}
                      sponsoredBadge={badge || t('discover', 'sponsoredLabel')}
                    />"""

if old_spon not in s:
    raise SystemExit("sponsored card not found")
s = s.replace(old_spon, new_spon, 1)

# List intro
old_intro = """        <header className="dg-list-intro">
          <h2 id="hg-grid-label-dining" className="dg-list-intro__title">
            {mainCollectionTitleSr}
          </h2>
        </header>"""

new_intro = """        <header className="dg-list-intro">
          <h2 id="hg-grid-label-dining" className="dg-list-intro__title">
            {mainCollectionTitleSr}
          </h2>
          {flowIntroText ? <p className="dg-list-intro__sub">{flowIntroText}</p> : null}
        </header>"""

if old_intro not in s:
    raise SystemExit("list intro not found")
s = s.replace(old_intro, new_intro, 1)

# Main grid cards
old_grid = """            {mainListPlaces.map((p) => (
              <DiningListingCard
                key={p.id}
                place={p}
                onMapClick={handleViewOnMap}
                onAddToTrip={openAddToTrip}
                viewDetailsLabel={t('home', 'viewDetails')}
                mapAriaLabel={t('placeDiscover', 'viewOnMap')}
                addToTripLabel={t('placeDiscover', 'addToTrip')}
                t={t}
              />
            ))}"""

new_grid = """            {mainListPlaces.map((p) => (
              <DiningMealListingCard
                key={p.id}
                place={p}
                onMapClick={handleViewOnMap}
                onAddMealToCart={handleAddMealToCart}
                offerHighlight={flowParam === 'offers'}
                inMealCart={mealCart.some((x) => x.id === String(p.id))}
                viewDetailsLabel={t('home', 'viewDetails')}
                mapAriaLabel={t('placeDiscover', 'viewOnMap')}
                addMealCartLabel={t('diningGuide', 'cardActionAddCart')}
                addMealCartAddedLabel={t('diningGuide', 'mealCartToastDup')}
                t={t}
              />
            ))}"""

if old_grid not in s:
    raise SystemExit("main grid not found")
s = s.replace(old_grid, new_grid, 1)

# Remove trip modal — from {tripPickPlace to before toast
old_modal = s[s.find("      {tripPickPlace && (") : s.find("      {toast ? (")]
if "      {tripPickPlace && (" not in s:
    raise SystemExit("modal start missing")
s = s.replace(old_modal, "", 1)

# Meal cart dock before toast
meal_dock = """      {mealCart.length > 0 ? (
        <aside className="dg-meal-cart-dock" aria-label={t('diningGuide', 'mealCartPanelLabel')}>
          <div className="dg-meal-cart-dock__head">
            <Icon name="shopping_cart" size={20} aria-hidden />
            <span>{t('diningGuide', 'mealCartTitle').replace('{count}', String(mealCart.length))}</span>
          </div>
          <ul className="dg-meal-cart-dock__list">
            {mealCart.map((row) => (
              <li key={row.id} className="dg-meal-cart-dock__row">
                <Link to={`/place/${row.id}`} className="dg-meal-cart-dock__link">
                  {row.name}
                </Link>
                <button
                  type="button"
                  className="dg-meal-cart-dock__rm"
                  onClick={() => {
                    removeMealFromCart(row.id);
                    setMealCart(getMealCart());
                  }}
                  aria-label={t('diningGuide', 'mealCartRemoveAria')}
                >
                  <Icon name="close" size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <p className="dg-meal-cart-dock__hint">{t('diningGuide', 'mealCartHint')}</p>
        </aside>
      ) : null}

"""

insert_at = s.find("      {toast ? (")
if insert_at == -1:
    raise SystemExit("toast block not found")
s = s[:insert_at] + meal_dock + s[insert_at:]

p.write_text(s, encoding="utf-8")
print("phase2 complete")
