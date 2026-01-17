const fs = require('fs');
const path = require('path');

const nodeModulesPath = path.join(__dirname, 'node_modules');

if (fs.existsSync(nodeModulesPath)) {
  console.log('node_modules exists');
  const items = fs.readdirSync(nodeModulesPath);
  console.log('Count:', items.length);
  if (items.includes('express')) {
    console.log('express found');
  } else {
    console.log('express NOT found');
  }
} else {
  console.log('node_modules does NOT exist');
}
