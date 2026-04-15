from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def patch_dining():
    p = ROOT / "src/pages/PlaceDining.jsx"
    t = p.read_text(encoding="utf-8")
    a = "import { useSiteSettings } from '../context/SiteSettingsContext';\nimport './PlaceHotels.css';"
    b = "import { useSiteSettings } from '../context/SiteSettingsContext';\nimport GuideExperienceBand from '../components/GuideExperienceBand';\nimport './PlaceHotels.css';"
    if a not in t:
        raise SystemExit("PlaceDining import block not found")
    t = t.replace(a, b, 1)
    old = """      <div className="hg-container hg-main">
        {sponsoredDining.length > 0 ? (
          <section className="hg-sponsored" aria-label={sponsoredKicker}>
            <header className="hg-section-head">
              <h2 className="hg-section-title">{sponsoredKicker}</h2>
            </header>"""
    new = """      <div className="hg-container hg-main">
        <GuideExperienceBand t={t} ns="diningGuide" />

        {sponsoredDining.length > 0 ? (
          <section className="hg-sponsored hg-sponsored--deep" aria-label={sponsoredKicker}>
            <header className="hg-section-head hg-sponsored__head">
              <h2 className="hg-section-title">{sponsoredKicker}</h2>
              <p className="hg-sponsored__lead">{t('diningGuide', 'sponsoredSectionLead')}</p>
            </header>"""
    if old not in t:
        raise SystemExit("PlaceDining main block not found")
    t = t.replace(old, new, 1)
    p.write_text(t, encoding="utf-8")
    print("PlaceDining.jsx patched")


def patch_hotels():
    p = ROOT / "src/pages/PlaceHotels.jsx"
    t = p.read_text(encoding="utf-8")
    a = "import { useSiteSettings } from '../context/SiteSettingsContext';\nimport './PlaceHotels.css';"
    b = "import { useSiteSettings } from '../context/SiteSettingsContext';\nimport GuideExperienceBand from '../components/GuideExperienceBand';\nimport './PlaceHotels.css';"
    if a not in t:
        raise SystemExit("PlaceHotels import block not found")
    t = t.replace(a, b, 1)
    old = """      <div className="hg-container hg-main">
        {sponsoredStay.length > 0 ? (
          <section className="hg-sponsored" aria-label={sponsoredKicker}>
            <header className="hg-section-head">
              <h2 className="hg-section-title">{sponsoredKicker}</h2>
            </header>"""
    new = """      <div className="hg-container hg-main">
        <GuideExperienceBand t={t} ns="hotelGuide" />

        {sponsoredStay.length > 0 ? (
          <section className="hg-sponsored hg-sponsored--deep" aria-label={sponsoredKicker}>
            <header className="hg-section-head hg-sponsored__head">
              <h2 className="hg-section-title">{sponsoredKicker}</h2>
              <p className="hg-sponsored__lead">{t('hotelGuide', 'sponsoredSectionLead')}</p>
            </header>"""
    if old not in t:
        raise SystemExit("PlaceHotels main block not found")
    t = t.replace(old, new, 1)
    p.write_text(t, encoding="utf-8")
    print("PlaceHotels.jsx patched")


if __name__ == "__main__":
    patch_dining()
    patch_hotels()
