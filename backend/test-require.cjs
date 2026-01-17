
try {
  require.resolve('escape-html');
  console.log('escape-html found');
} catch (e) {
  console.error('escape-html NOT found');
  console.error(e);
}
