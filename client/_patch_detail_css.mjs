import fs from "fs";
const p = "src/pages/Detail.css";
let s = fs.readFileSync(p, "utf8");
const a = `.place-detail-app-hero-media {
  position: relative;
  height: 45vh;
  min-height: 320px;
  max-height: 550px;
  overflow: hidden;
  background: #e8eaed;
}
.place-detail-app-hero-img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  display: block;
}
.place-detail-app-hero-fallback {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  height: 100%;
  color: #9ca3af;
  background: #e8eaed;
}`;
const b = `.place-detail-app-hero-media {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: min(42vh, 380px);
  max-height: min(88vh, 960px);
  overflow: hidden;
  background: #e8eaed;
}
.place-detail-app-hero-img {
  position: relative;
  z-index: 1;
  display: block;
  max-width: 100%;
  width: auto;
  height: auto;
  max-height: min(88vh, 960px);
  margin: 0 auto;
  object-fit: contain;
  object-position: center;
}
.place-detail-app-hero-fallback {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: min(42vh, 380px);
  width: 100%;
  color: #9ca3af;
  background: #e8eaed;
}`;
if (!s.includes(a)) { console.error("hero block not found"); process.exit(1); }
s = s.replace(a, b);
s = s.replace(
`.place-detail-app-menu-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}`,
`.place-detail-app-menu-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  display: block;
}`
);
s = s.replace(
`.place-detail-dining-menu-thumb img {
  width: 100%;
  height: auto;
  max-height: 160px;
  object-fit: cover;
  display: block;
}`,
`.place-detail-dining-menu-thumb img {
  width: 100%;
  height: auto;
  max-height: 160px;
  object-fit: contain;
  object-position: center;
  display: block;
}`
);
s = s.replace(
`  .place-detail-app-hero-media {
    height: 60vh;
  }`,
`  .place-detail-app-hero-media {
    min-height: min(52vh, 440px);
    max-height: min(88vh, 960px);
  }`
);
fs.writeFileSync(p, s);
console.log("ok");
