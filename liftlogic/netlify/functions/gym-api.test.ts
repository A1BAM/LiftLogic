import test from 'node:test';
import assert from 'node:assert';
import { handler } from './gym-api.ts';

test('gym-api POST missing fields returns 400', async () => {
  // Set required env var for the handler to proceed past initial check
  process.env.NETLIFY_DATABASE_URL = 'postgres://dummy:dummy@dummy/dummy';

  const eventMissingExerciseId = {
    httpMethod: 'POST',
    body: JSON.stringify({
      id: '123'
    })
  };

  const response1 = await handler(eventMissingExerciseId);
  assert.strictEqual(response1.statusCode, 400);
  assert.strictEqual(response1.body, "Missing required fields");

  const eventMissingId = {
    httpMethod: 'POST',
    body: JSON.stringify({
      exerciseId: 'ex1'
    })
  };

  const response2 = await handler(eventMissingId);
  assert.strictEqual(response2.statusCode, 400);
  assert.strictEqual(response2.body, "Missing required fields");

  const eventEmptyBody = {
    httpMethod: 'POST',
    body: JSON.stringify({})
  };

  const response3 = await handler(eventEmptyBody);
  assert.strictEqual(response3.statusCode, 400);
  assert.strictEqual(response3.body, "Missing required fields");

  const eventNoBody = {
    httpMethod: 'POST'
  };

  const response4 = await handler(eventNoBody);
  assert.strictEqual(response4.statusCode, 400);
  assert.strictEqual(response4.body, "Missing required fields");
});
