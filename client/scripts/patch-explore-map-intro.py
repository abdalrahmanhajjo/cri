from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "pages" / "Explore.jsx"
text = p.read_text(encoding="utf-8")
old = """            <div id=\"areas\" className=\"vd-plan-trip-block vd-find-your-way-areas-card vd-find-your-way-areas-card--map\">
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
              <FindYourWayMap places={places} t={t} loadEager />
            </div>"""
new = """            <div id=\"areas\" className=\"vd-plan-trip-block vd-find-your-way-areas-card vd-find-your-way-areas-card--map\">
              <div className=\"vd-find-your-way-areas-card-intro\">
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
              </div>
              <FindYourWayMap places={places} t={t} loadEager />
            </div>"""
if old not in text:
    raise SystemExit("pattern not found")
p.write_text(text.replace(old, new, 1), encoding="utf-8")
print("patched")
