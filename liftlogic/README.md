<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:** Node.js, a PostgreSQL-compatible Neon database, and a Cloudflare
account with Wrangler access.


1. Install the frontend dependencies:

   ```sh
   npm install
   ```

2. Create the database tables required by `worker.ts` in your Neon database, then
   configure these Worker values:

   - `DATABASE_URL`: the Neon connection string. Store this as a Wrangler secret;
     do not add it to `wrangler.jsonc`.
   - `TARGET_HASH`: the SHA-256 hash of the password used to unlock the app. As an
     alternative, set `PASSWORD` and the Worker will hash it at runtime.
   - `LOGIN_RATE_LIMITER`: the rate-limit binding declared in `wrangler.jsonc`.

   For local development, secrets can be placed in a repository-root `.dev.vars`
   file (which must not be committed):

   ```dotenv
   DATABASE_URL=postgresql://...
   TARGET_HASH=...
   ```

3. From the repository root, start the Worker API on port `8787`:

   ```sh
   npx wrangler dev --port 8787
   ```

4. In a second terminal, start the Vite frontend from this directory:

   ```sh
   npm run dev
   ```

   Vite serves the app at `http://localhost:3000` and proxies `/gym-api` requests
   to the Worker at `http://127.0.0.1:8787`.

## Verification

```sh
npm test
npm run build
```
