from pathlib import Path

p = Path("client/src/pages/Explore.jsx")
text = p.read_text(encoding="utf-8")
old = """        <div className=\"vd-find-your-way-main-grid\">
          <div className=\"vd-find-your-way-areas-panel\">
            <div id=\"areas\" className=\"vd-plan-trip-block vd-find-your-way-areas-card vd-find-your-way-areas-card--map\">
              <h3 className=\"vd-plan-trip-block-title\">{safeT('home', 'areasTitle')}</h3>
              <p className=\"vd-plan-trip-block-desc\">{safeT('home', 'areasMapSub')}</p>
              <FindYourWayMap places={places} t={t} />
            </div>
          </div>
          <div className=\"vd-find-your-way-side-stack\">
            <div className=\"vd-plan-trip-block vd-plan-trip-block--compact vd-find-your-way-side-card\">
              <h3 className=\"vd-plan-trip-block-title\">{safeT('nav', 'discoverPlaces')}</h3>
              <p className=\"vd-plan-trip-block-desc\">{safeT('home', 'seeAllWaysDiscover')}</p>
              <div className=\"vd-plan-trip-inline-actions\">
                <Link to={PLACES_DISCOVER_PATH} className=\"vd-plan-trip-cta vd-btn vd-btn--primary\">
                  {safeT('nav', 'discoverPlaces')}
                  <Icon name=\"arrow_forward\" className=\"vd-btn-arrow\" size={20} />
                </Link>
                {showMap && (
                  <Link to=\"/map\" className=\"vd-plan-trip-inline-link\">
                    {safeT('home', 'viewMapCta')}
                    <Icon name=\"arrow_forward\" size={18} aria-hidden />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>"""
new = """        <div className=\"vd-find-your-way-main-grid vd-find-your-way-main-grid--map-only\">
          <div className=\"vd-find-your-way-areas-panel\">
            <div id=\"areas\" className=\"vd-plan-trip-block vd-find-your-way-areas-card vd-find-your-way-areas-card--map\">
              <h3 className=\"vd-plan-trip-block-title\">{safeT('home', 'areasTitle')}</h3>
              <p className=\"vd-plan-trip-block-desc\">{safeT('home', 'areasMapSub')}</p>
              {showMap && (
                <div className=\"vd-plan-trip-inline-actions vd-find-your-way-areas-map-link\">
                  <Link to=\"/map\" className=\"vd-plan-trip-inline-link\">
                    {safeT('home', 'viewMapCta')}
                    <Icon name=\"arrow_forward\" size={18} aria-hidden />
                  </Link>
                </div>
              )}
              <FindYourWayMap places={places} t={t} />
            </div>
          </div>
        </div>"""
if old not in text:
    raise SystemExit("OLD NOT FOUND")
p.write_text(text.replace(old, new), encoding="utf-8")
print("OK")
