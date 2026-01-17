
try {
  const escape = require('escape-html');
  console.log('Successfully required escape-html');
  console.log('Type:', typeof escape);
} catch (error) {
  console.error('Failed to require escape-html:', error);
  process.exit(1);
}
