
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

try {
  const psp = require('postcss-selector-parser');
  console.log('Successfully required postcss-selector-parser');
  console.log(psp);
} catch (e) {
  console.error('Failed to require postcss-selector-parser', e);
}

try {
    const path = require.resolve('postcss-selector-parser');
    console.log('Resolved path:', path);
} catch (e) {
    console.error('Failed to resolve postcss-selector-parser', e);
}
