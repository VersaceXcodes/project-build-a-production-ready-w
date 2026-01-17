
try {
  require('express');
  console.log('Express loaded successfully');
} catch (error) {
  console.error('Failed to load express:', error);
  process.exit(1);
}
