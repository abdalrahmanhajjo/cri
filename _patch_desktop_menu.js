const fs = require('fs');
const p = 'client/src/pages/PlaceDetail.jsx';
let s = fs.readFileSync(p, 'utf8');
const oldBlock = `{diningProfile.menuSections.map((section) => (
                        <section key={section.title || section.note} className="place-detail-dining-menu-section">
                          {section.title ? <h3 className="place-detail-dining-panel-title">{section.title}</h3> : null}`;
const newBlock = `{diningProfile.menuSections.map((section, secIdx) => (
                        <section key={\`dining-menu-\${secIdx}-\${section.signatureSection ? 'sig' : section.title || section.note || 's'}\`} className="place-detail-dining-menu-section">
                          {(section.signatureSection || section.title) ? (
                            <h3 className="place-detail-dining-panel-title">
                              {section.signatureSection
                                ? t('business', 'diningSignatureTitle') || 'Signature dishes'
                                : section.title}
                            </h3>
                          ) : null}`;
if (!s.includes('{diningProfile.menuSections.map((section) => (')) {
  console.error('desktop menu map not found');
  process.exit(1);
}
s = s.replace(oldBlock, newBlock);
fs.writeFileSync(p, s);
console.log('desktop dining menu ok');
