"""Strip dining/hotel-specific UI from PlaceDetail.jsx (one-off refactor)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "client/src/pages/PlaceDetail.jsx"
lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
out = []
i = 0
while i < len(lines):
    line = lines[i]
    # Drop dining imports
    if "from '../utils/diningMealCart'" in line or "from '../utils/diningOfferTeaser'" in line:
        i += 1
        continue
    if "from '../utils/diningProfileForm'" in line or "from '../utils/diningProfileMergeClient'" in line:
        i += 1
        continue
    out.append(line)
    i += 1

text = "".join(out)
lines = text.splitlines(keepends=True)
out = []
i = 0
while i < len(lines):
    if lines[i].startswith("function isDiningPlace"):
        while i < len(lines) and not lines[i].startswith("function translationOr"):
            i += 1
        continue
    out.append(lines[i])
    i += 1
text = "".join(out)

# Remove dining state / meal cart hooks (line blocks)
def drop_block(src: str, start_pat: str, end_pat: str | None = None) -> str:
    lines = src.splitlines(keepends=True)
    out = []
    i = 0
    while i < len(lines):
        if start_pat in lines[i]:
            if end_pat:
                i += 1
                while i < len(lines) and end_pat not in lines[i]:
                    i += 1
                if i < len(lines):
                    i += 1
            else:
                depth = 0
                start_i = i
                while i < len(lines):
                    for ch in lines[i]:
                        if ch == "(":
                            depth += 1
                        elif ch == ")":
                            depth -= 1
                    i += 1
                    if i > start_i and depth <= 0 and ");" in lines[i - 1]:
                        break
            continue
        out.append(lines[i])
        i += 1
    return "".join(out)

# diningTab state
text = drop_block(
    text,
    "  const [diningTab, setDiningTab] = useState('overview');",
)
text = drop_block(
    text,
    "  const [mealCartVersion, setMealCartVersion] = useState(0);",
)
# meal cart listener effect
old = """  useEffect(() => {
    const on = () => setMealCartVersion((v) => v + 1);
    window.addEventListener('dining-meal-cart-changed', on);
    return () => window.removeEventListener('dining-meal-cart-changed', on);
  }, []);

"""
text = text.replace(old, "")
# handleAddDishToCart + dishInCart
import re

text = re.sub(
    r"\n  const handleAddDishToCart = useCallback\([\s\S]*?\n  \);\n\n",
    "\n",
    text,
    count=1,
)
text = re.sub(
    r"\n  const dishInCart = useCallback\([\s\S]*?\n  \);\n\n",
    "\n",
    text,
    count=1,
)

text = text.replace("    setDiningTab('overview');\n", "")

# openExternalDirections
text = text.replace(
    """    const address =
      place?.diningProfile && typeof place.diningProfile === 'object'
        ? String(place.diningProfile.contactAddress || place.diningProfile.address || '').trim()
        : '';
    const query = address || place?.location || place?.name || 'Tripoli Lebanon';
""",
    """    const query = String(place?.location || place?.name || 'Tripoli Lebanon').trim();
""",
)

text = text.replace(
    "setInquiryIntent(isDiningPlace(place) ? 'booking' : 'general');",
    "setInquiryIntent('general');",
)

# Remove dining-derived consts through isDining; keep hours + mapEmbedUrl
lines = text.splitlines(keepends=True)
out = []
i = 0
while i < len(lines):
    if lines[i].strip().startswith("const diningPlace = isDiningPlace"):
        while i < len(lines) and not lines[i].startswith("  const hoursEntries"):
            i += 1
        continue
    if lines[i].strip().startswith("const diningGallery ="):
        while i < len(lines) and not lines[i].startswith("  const mapEmbedUrl"):
            i += 1
        continue
    if lines[i].strip() == "const isDining = isDiningPlace(place);":
        i += 1
        continue
    out.append(lines[i])
    i += 1
text = "".join(out)

# contactContent
text = re.sub(
    r"\n  const contactContent = \([\s\S]*?\n  \);\n\n  if \(isDining\)",
    "\n\n  if (isDining)",
    text,
    count=1,
)

# Remove if (isDining) { ... } entirely
start = text.find("\n  if (isDining) {")
if start == -1:
    raise SystemExit("isDining block not found")
rest = text[start + 1 :]
depth = 0
end_idx = None
j = 0
while j < len(rest):
    if rest[j] == "{":
        depth += 1
    elif rest[j] == "}":
        depth -= 1
        if depth == 0:
            # closing brace of if (isDining)
            end_idx = start + 1 + j + 1
            break
    j += 1
if end_idx is None:
    raise SystemExit("could not close isDining")
text = text[:start] + text[end_idx:]

# Remove isDining references in reviewsContent
text = text.replace("{isDining && place.rating != null && (", "{place.rating != null && (")

# dining section in default layout
text = re.sub(
    r"\n\s*\{diningPlace && \([\s\S]*?\n\s*\)\}\n\n\s*\{place\.description",
    "\n\n          {place.description",
    text,
    count=1,
)

text = text.replace("{!diningPlace && <div className=\"place-detail-engage-block place-detail-reviews-box\">", "<div className=\"place-detail-engage-block place-detail-reviews-box\">")

if "isDiningPlace" in text or "diningPlace" in text or "diningTab" in text or "diningProfile" in text:
    bad = [x for x in ["isDiningPlace", "diningPlace", "diningTab", "diningProfile", "getMealCart", "diningOfferLines"] if x in text]
    raise SystemExit(f"leftover tokens: {bad}")

path.write_text(text, encoding="utf-8")
print("PlaceDetail patched OK")
