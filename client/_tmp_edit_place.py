from pathlib import Path

p = Path(__file__).resolve().parent / "src/pages/business/BusinessPlaceEdit.jsx"
text = p.read_text(encoding="utf-8")
old = """            <div className=\"business-field\" style={{ marginTop: '1rem' }}>
              <label htmlFor=\"biz-urls\">Image URLs (one per line)</label>
              <textarea id=\"biz-urls\" className=\"business-textarea\" rows={3} value={form.images} onChange={setField('images')} />
            </div>
"""
if old not in text:
    raise SystemExit("block not found")
text = text.replace(old, "", 1)
old2 = "              First image is the cover. JPEG, PNG, GIF, or WebP — max 5 MB per file. Images are scanned server-side.\n"
new2 = "              First image is the cover. Upload files only — JPEG, PNG, GIF, or WebP — max 5 MB per file. Images are scanned\n              server-side.\n"
if old2 not in text:
    raise SystemExit("hint not found")
text = text.replace(old2, new2, 1)
p.write_text(text, encoding="utf-8")
print("ok")
