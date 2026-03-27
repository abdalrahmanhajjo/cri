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
      if (content.includes('express.Router()') && !content.includes("require('express')")) {
        console.log(`MISSING express: ${fullPath}`);
      }
      if (content.includes('query(') && !content.includes("require('../../db')") && !content.includes("require('../db')")) {
        console.log(`MISSING query: ${fullPath}`);
      }
      if (content.includes('authMiddleware') && !content.includes("require('../../middleware/auth')") && !content.includes("require('../middleware/auth')")) {
        console.log(`MISSING authMiddleware: ${fullPath}`);
      }
      if (content.includes('adminMiddleware') && !content.includes("require('../../middleware/auth')") && !content.includes("require('../middleware/auth')") && !content.includes("require('../../middleware/admin')") && !content.includes("require('../middleware/admin')")) {
         console.log(`MISSING adminMiddleware: ${fullPath}`);
      }
    }
  });
}

checkDir(routesDir);
