import { test } from 'node:test';
import * as assert from 'node:assert';
import { handler } from './gym-api.ts';

test("API Handler missing connection string returns 500", async () => {
    // Save the original environment variable
    const originalEnv = process.env.NETLIFY_DATABASE_URL;

    // Remove the variable to simulate missing configuration
    delete process.env.NETLIFY_DATABASE_URL;

    try {
        // Invoke the handler with a mock event
        const event = { httpMethod: 'GET' };
        const response = await handler(event);

        // Verify the response
        assert.strictEqual(response.statusCode, 500);
        assert.strictEqual(response.body, "Database configuration missing");
    } finally {
        // Restore the original environment variable
        if (originalEnv !== undefined) {
            process.env.NETLIFY_DATABASE_URL = originalEnv;
        }
    }
});
