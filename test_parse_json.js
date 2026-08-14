try {
  JSON.parse('invalid json');
} catch (e) {
  console.log(e.message);
}
