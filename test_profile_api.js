fetch('http://localhost:3000/gym-api/profile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ heightCm: 180, weightLbs: 170, age: 30 })
}).then(res => {
  console.log('Status:', res.status);
  return res.text();
}).then(text => console.log('Body:', text))
  .catch(err => console.error(err));
