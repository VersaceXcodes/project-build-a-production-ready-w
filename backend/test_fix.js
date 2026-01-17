try {
  require('express');
  console.log('Express loaded successfully!');
} catch (e) {
  console.error(e);
  process.exit(1);
}
