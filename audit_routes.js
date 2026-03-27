const fs = require('fs');
const path = require('path');

const routesDir = 'c:/Users/MY LAPTOP/Desktop/tripoli-explorer-web/server/src/routes';

function checkDir(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      checkDir(fullPath);
    } else if (file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Check for adminMiddleware in auth.js
      if (content.includes('adminMiddleware') && content.includes("require('../../middleware/auth')") && !content.includes("require('../../middleware/admin')")) {
         console.log(`WRONG adminMiddleware import: ${fullPath}`);
      }
      
      // Check for express
      if (content.includes('express.Router()') && !content.includes("require('express')")) {
        console.log(`MISSING express: ${fullPath}`);
      }
    }
  });
}

console.log('Starting middleware audit...');
checkDir(routesDir);
console.log('Audit complete.');
