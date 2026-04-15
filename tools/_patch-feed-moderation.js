const fs = require('fs');
const path = require('path');

const feedPath = path.join(__dirname, '../server/src/routes/feed.js');
let s = fs.readFileSync(feedPath, 'utf8');
const before = s.split("moderation_status: 'approved'");
if (before.length !== 4) {
  console.error('Expected 3 occurrences of moderation_status approved, got', before.length - 1);
  process.exit(1);
}
s = before.join("moderation_status: { $nin: ['rejected'] }");
fs.writeFileSync(feedPath, s);
console.log('Patched', feedPath);
