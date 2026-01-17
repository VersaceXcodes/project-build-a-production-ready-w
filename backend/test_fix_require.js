
try {
  console.log('Requiring ee-first...');
  require('ee-first');
  console.log('Success requiring ee-first');
} catch (e) {
  console.error('Failed to require ee-first:', e);
}

try {
  console.log('Requiring on-finished...');
  require('on-finished');
  console.log('Success requiring on-finished');
} catch (e) {
  console.error('Failed to require on-finished:', e);
}
