from pathlib import Path

p = Path("client/src/App.jsx")
t = p.read_text(encoding="utf-8")
old = """        <Route
          path="dining"
          element={<LazyBoundary message="Loading…"><PlaceDining /></LazyBoundary>}
        />
        <Route
          path="hotels"
          element={<LazyBoundary message="Loading…"><PlaceHotels /></LazyBoundary>}
        />"""
new = """        <Route path="dining" element={<Navigate to="/discover" replace />} />
        <Route path="hotels" element={<Navigate to="/discover" replace />} />"""
if old not in t:
    raise SystemExit("pattern not found")
p.write_text(t.replace(old, new), encoding="utf-8")
print("patched")
