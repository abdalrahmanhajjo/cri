const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '../src/i18n/translations.js');
let s = fs.readFileSync(p, 'utf8');

const pairs = [
  [
    "      experienceTitle: 'Tripoli in one flow',\n      experienceLead: 'Search and categories bring culture, food, sleep, and corners of the city together — save favourites as you browse.',",
    "      experienceTitle: 'Deep discovery, on your terms',\n      experienceLead:\n        'Search and categories span culture, food, stays, and neighbourhood corners — jump between themes and save favourites as you go.',",
  ],
  [
    "      experienceCol1Body: 'See your hotel beside sights and dining — switch between this guide and the city map in one flow.',",
    "      experienceCol1Body:\n        'See your hotel beside sights and dining — move between this guide and the city map whenever you need.',",
  ],
  [
    "      experienceTitle: 'طرابلس في تدفق واحد',\n      experienceLead: 'البحث والفئات تجمع الثقافة والطعام والإقامة وزوايا المدينة — احفظ المفضلة وأنت تتصفح.',",
    "      experienceTitle: 'اكتشاف عميق على طريقتك',\n      experienceLead:\n        'البحث والفئات تغطي الثقافة والطعام والإقامة وزوايا المدينة — انتقل بين المواضيع واحفظ المفضلة في أي وقت.',",
  ],
  [
    "      experienceTitle: 'Tripoli tout en fluidité',\n      experienceLead: 'Recherche et catégories réunissent culture, tables, nuits et recoins — enregistrez vos favoris en parcourant.',",
    "      experienceTitle: 'Découverte profonde, à votre rythme',\n      experienceLead:\n        'Recherche et catégories couvrent culture, tables, nuits et recoins — passez d'un thème à l'autre et enregistrez vos favoris au fil de l'eau.',",
  ],
];

for (const [a, b] of pairs) {
  if (!s.includes(a)) {
    console.error('Missing expected chunk');
    process.exit(1);
  }
  s = s.replace(a, b);
}
fs.writeFileSync(p, s);
console.log('OK');
