#!/usr/bin/env node
/**
 * Reports which exercises still have no form model.
 *
 * Reads the exercise list from Neon and compares it against the JSON files in
 * liftlogic/data/animations/. Read-only: it issues a single SELECT and never
 * creates tables or writes anything back.
 *
 *   DATABASE_URL='postgres://...' node scripts/check-animations.mjs
 *   node scripts/check-animations.mjs --all      # include archived exercises
 *   node scripts/check-animations.mjs --json     # machine-readable output
 *   node scripts/check-animations.mjs --offline  # skip Neon, check built-ins only
 *
 * Exits 1 if any active exercise is missing a model, so it can gate CI.
 */
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ANIM_DIR = join(HERE, '..', 'liftlogic', 'data', 'animations');
const CONSTANTS = join(HERE, '..', 'liftlogic', 'constants.ts');

const args = new Set(process.argv.slice(2));
const includeArchived = args.has('--all');
const asJson = args.has('--json');
const offline = args.has('--offline');

function onDisk() {
  if (!existsSync(ANIM_DIR)) return new Set();
  return new Set(
    readdirSync(ANIM_DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5))
  );
}

/**
 * Built-in exercises live in constants.ts, not the database, so an exercise
 * like DUMBBELL_CURL would otherwise be invisible to a database-only check.
 */
async function builtIns() {
  try {
    const src = await import('node:fs/promises').then(fs => fs.readFile(CONSTANTS, 'utf8'));
    const ids = [...src.matchAll(/\[ExerciseId\.([A-Z_]+)\]/g)].map(m => m[1]);
    const names = Object.fromEntries(
      [...src.matchAll(/id:\s*ExerciseId\.([A-Z_]+),\s*\n\s*name:\s*"([^"]+)"/g)]
        .map(m => [m[1], m[2]])
    );
    return ids.map(id => ({ id, name: names[id] ?? id, source: 'constants.ts', archived: false }));
  } catch {
    return [];
  }
}

async function fromNeon() {
  if (offline) return [];
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Export your Neon connection string first:');
    console.error("  DATABASE_URL='postgres://...' node scripts/check-animations.mjs");
    process.exit(2);
  }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url);
  // Exercise definitions are stored as rows in `workouts` with the sentinel
  // exercise_id, carrying their JSON in `notes`.
  const rows = await sql`
    SELECT DISTINCT ON (notes::json->>'id')
           notes::json->>'id'         AS id,
           notes::json->>'name'       AS name,
           notes::json->>'isArchived' AS archived
    FROM workouts
    WHERE exercise_id = '__DEFINITION__'
      AND notes IS NOT NULL
    ORDER BY notes::json->>'id', timestamp DESC
  `;
  return rows.map(r => ({
    id: r.id,
    name: r.name ?? r.id,
    source: 'neon',
    archived: r.archived === 'true'
  }));
}

const [dbExercises, codeExercises] = await Promise.all([fromNeon(), builtIns()]);

// Database definitions override same-id built-ins, matching how the app merges.
const byId = new Map();
for (const e of codeExercises) byId.set(e.id, e);
for (const e of dbExercises) byId.set(e.id, e);

const files = onDisk();
const all = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
const considered = includeArchived ? all : all.filter(e => !e.archived);

const missing = considered.filter(e => !files.has(e.id));
const covered = considered.filter(e => files.has(e.id));
// Without the database list, every saved exercise would look orphaned.
const orphaned = offline ? [] : [...files].filter(id => !byId.has(id));

if (asJson) {
  console.log(JSON.stringify({ missing, covered: covered.map(e => e.id), orphaned }, null, 2));
} else {
  console.log(`\nForm model coverage  ${covered.length}/${considered.length}` +
              `${includeArchived ? '' : '  (active exercises; --all includes archived)'}`);
  if (offline) {
    console.log('Offline mode: only the built-ins in constants.ts were checked.');
    console.log('Set DATABASE_URL and drop --offline to include your saved exercises.');
  }
  console.log('');
  if (missing.length) {
    console.log('MISSING a form model:');
    for (const e of missing) {
      console.log(`  ${e.id.padEnd(24)} ${e.name}${e.archived ? '  [archived]' : ''}`);
    }
    console.log(`\nAdd one at liftlogic/data/animations/<id>.json`);
  } else {
    console.log('Every exercise has a form model.');
  }
  if (orphaned.length) {
    console.log('\nAnimation files with no matching exercise (renamed or deleted?):');
    for (const id of orphaned) console.log(`  ${id}`);
  }
  console.log('');
}

process.exit(missing.length ? 1 : 0);
