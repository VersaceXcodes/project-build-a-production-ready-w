try {
  require('ee-first');
  console.log('Success: ee-first found');
} catch (e) {
  console.error('Error: ee-first not found');
  console.error(e);
}
