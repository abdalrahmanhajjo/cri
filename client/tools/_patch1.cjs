const fs = require('fs');
const p = 'src/pages/PlaceDining.jsx';
let s = fs.readFileSync(p, 'utf8');
const eol = '\r\n';
const anchor = `  }, [langParam, sponsoredDiningEnabled]);${eol}${eol}`;
if (!s.includes('api.publicPromotions')) {
  const effect = `  useEffect(() => {
    let cancelled = false;
    api
      .publicPromotions({ limit: 200, lang: langParam })
      .then((r) => {
        if (!cancelled) setPublicPromotions(Array.isArray(r?.promotions) ? r.promotions : []);
      })
      .catch(() => {
        if (!cancelled) setPublicPromotions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [langParam]);

`;
  if (!s.includes(anchor)) throw new Error('anchor');
  s = s.replace(anchor, anchor + effect);
}
fs.writeFileSync(p, s);
console.log('effect', s.includes('api.publicPromotions'));
