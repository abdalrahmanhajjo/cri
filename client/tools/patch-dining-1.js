const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "../src/pages/PlaceDining.jsx");
let s = fs.readFileSync(p, "utf8");
if (!s.includes("GuideExperienceBand")) {
  s = s.replace(
    "import DiningFlowRibbon from '../components/DiningFlowRibbon';\nimport './PlaceHotels.css';",
    "import DiningFlowRibbon from '../components/DiningFlowRibbon';\nimport GuideExperienceBand from '../components/GuideExperienceBand';\nimport './PlaceHotels.css';"
  );
}
fs.writeFileSync(p, s);
console.log("import ok");
