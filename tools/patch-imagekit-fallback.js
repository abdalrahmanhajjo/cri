const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function patchUserFeed() {
  const p = path.join(root, 'server/src/routes/userFeed.js');
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(
    "const { getImageKit } = require('../utils/imagekit');",
    "const { getImageKit, uploadImageKitWithMetadataFallback } = require('../utils/imagekit');"
  );
  s = s.replace(
    'const uploadResponse = await imagekit.upload({',
    'const uploadResponse = await uploadImageKitWithMetadataFallback(imagekit, {'
  );
  fs.writeFileSync(p, s);
  console.log('patched userFeed.js');
}

function patchBusinessUpload() {
  const p = path.join(root, 'server/src/routes/business/upload.js');
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(
    "const { getImageKit } = require('../../utils/imagekit');",
    "const { getImageKit, uploadImageKitWithMetadataFallback } = require('../../utils/imagekit');"
  );
  s = s.replace(
    'const uploadResponse = await imagekit.upload({',
    'const uploadResponse = await uploadImageKitWithMetadataFallback(imagekit, {'
  );
  fs.writeFileSync(p, s);
  console.log('patched business/upload.js');
}

patchUserFeed();
patchBusinessUpload();
