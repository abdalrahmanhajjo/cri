const fs = require('fs');
const p = 'client/src/pages/PlaceDetail.jsx';
let s = fs.readFileSync(p, 'utf8');
const oldBlock =
  '{diningProfile.menuSections.map((section) => (\r\n                        <section key={section.title || section.note} className="place-detail-dining-menu-section">\r\n                          {section.title ? <h3 className="place-detail-dining-panel-title">{section.title}</h3> : null}';
const newBlock =
  '{diningProfile.menuSections.map((section, secIdx) => (\r\n                        <section key={`dining-menu-${secIdx}-${section.signatureSection ? \'sig\' : section.title || section.note || \'s\'}`} className="place-detail-dining-menu-section">\r\n                          {(section.signatureSection || section.title) ? (\r\n                            <h3 className="place-detail-dining-panel-title">\r\n                              {section.signatureSection\r\n                                ? t(\'business\', \'diningSignatureTitle\') || \'Signature dishes\'\r\n                                : section.title}\r\n                            </h3>\r\n                          ) : null}';
if (!s.includes(oldBlock)) {
  console.error('block not found');
  process.exit(1);
}
s = s.replace(oldBlock, newBlock);
fs.writeFileSync(p, s);
console.log('patched desktop header');
