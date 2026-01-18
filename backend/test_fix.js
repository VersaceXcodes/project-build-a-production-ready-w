try {
  require('ee-first');
  console.log('Success: ee-first found');
  require('etag');
  console.log('Success: etag found');
} catch (e) {
  console.error('Error: module not found');
  console.error(e);
}
