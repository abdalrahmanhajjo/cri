from pathlib import Path

p = Path("client/src/pages/Detail.css")
text = p.read_text(encoding="utf-8")
old = """/* Full-bleed hero; narrower reading column (place detail) */
.place-detail-article--bleed {
  overflow: visible;
}

.place-detail-hero--fullbleed {
  width: 100vw;
  max-width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
  border-radius: 0;
  min-height: min(52vh, 520px);
}
"""
new = """/* Place detail: hero + card aligned to a comfortable column (not edge-to-edge) */
.place-detail-article.place-detail-article--bleed {
  max-width: min(680px, calc(100vw - 32px));
  margin-left: auto;
  margin-right: auto;
}

.place-detail-hero--fullbleed {
  min-height: min(44vh, 440px);
}
"""
if old not in text:
    raise SystemExit("OLD NOT FOUND")
p.write_text(text.replace(old, new), encoding="utf-8")
print("OK")
