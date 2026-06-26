/**
 * Seed sample data for demo:
 *   - 1 demo creator with wallet
 *   - 3 sample tracks (uses public domain audio or generates silence)
 *   - 1 demo listener
 *
 * Run: `node scripts/seed.js` from the perstream root.
 */

// Resolve modules from backend/node_modules first so this script works when run
// from the project root (`node scripts/seed.js`) instead of inside backend/.
const path = require('path');
const backendNodeModules = path.join(__dirname, '..', 'backend', 'node_modules');
require.main.paths.unshift(backendNodeModules);

require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

const fs = require('fs');

const db = require('../backend/src/db');
const wallet = require('../backend/src/wallet');
const arc = require('../backend/src/arc');

const AUDIO_DIR = process.env.AUDIO_DIR || path.join(__dirname, '..', 'backend', 'data', 'audio');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'backend', 'data', 'perstream.db');

async function main() {
console.log('[seed] starting...');
console.log('[seed] DB:', DB_PATH);
console.log('[seed] Audio dir:', AUDIO_DIR);

// Ensure dirs
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

// Initialise DB
await db.ready();

// ─── Seed creator ───
const CREATOR_EMAIL = 'demo-creator@perstream.fm';
let creator = db.getUserByEmail(CREATOR_EMAIL);

if (!creator) {
  const prov = await wallet.provisionWallet({ email: CREATOR_EMAIL, handle: 'perstream-demo' });
  creator = db.createUser({
    handle: 'perstream-demo',
    email: CREATOR_EMAIL,
    wallet: prov.wallet,
    role: 'creator',
  });
  console.log('[seed] created creator:', creator.handle, creator.wallet);
} else {
  console.log('[seed] creator already exists:', creator.handle);
}

// ─── Seed demo listener ───
const LISTENER_EMAIL = 'demo-listener@perstream.fm';
let listener = db.getUserByEmail(LISTENER_EMAIL);
if (!listener) {
  const prov = await wallet.provisionWallet({ email: LISTENER_EMAIL, handle: 'demo-listener' });
  listener = db.createUser({
    handle: 'demo-listener',
    email: LISTENER_EMAIL,
    wallet: prov.wallet,
    role: 'listener',
  });
  console.log('[seed] created listener:', listener.handle, listener.wallet);

  // Pre-fund listener with $5 in mock mode
  if (arc.MODE === 'mock') {
    await arc.deposit({ listener: listener.wallet, amountMicroUsdc: 5_000_000 });
    console.log('[seed] pre-funded listener with $5 USDC');
  }
} else {
  console.log('[seed] listener already exists:', listener.handle);
}

// ─── Seed sample tracks ───
const tracks = [
  {
    title: 'PerStream Theme — Welcome to paid seconds',
    description: 'A 30-second welcome message. Use this to test per-second pricing.',
    pricePerSec: 300, // 0.0003 USDC
    durationSec: 30,
    filename: 'track-1-welcome.mp3',
  },
  {
    title: 'The Cold-Start Cliff — PerStream pitch audio',
    description: '60-second pitch explaining why per-second beats subscriptions.',
    pricePerSec: 500, // 0.0005 USDC
    durationSec: 60,
    filename: 'track-2-pitch.mp3',
  },
  {
    title: 'Demo Loop — looping tone for testing',
    description: 'A short test track. Loop it to see continuous per-second tick.',
    pricePerSec: 100, // 0.0001 USDC (cheap!)
    durationSec: 15,
    filename: 'track-3-loop.mp3',
  },
];

// Generate placeholder MP3s if they don't exist.
// (Real audio for production — these are silent stubs good enough for demo).
for (const t of tracks) {
  const filePath = path.join(AUDIO_DIR, t.filename);
  if (!fs.existsSync(filePath)) {
    // Write a minimal silent MP3 frame header (technically not a valid MP3 but enough
    // for an `<audio>` element to load and "play" a 0-duration stream for demo).
    // For real audio, drop actual .mp3 files into AUDIO_DIR with these names.
    fs.writeFileSync(filePath + '.placeholder.txt',
      `Drop a real ${t.filename} here.\n` +
      `This is a placeholder. Replace with an actual audio file of ${t.durationSec}s.\n` +
      `The frontend will still work with a silent 0-duration stream for the demo.\n`
    );
    console.log(`[seed] placeholder created for ${t.filename} (replace with real audio for production demo)`);
  }

  // Only insert track if not already
  const existing = db.listTracks({ creatorId: creator.id }).find(x => x.title === t.title);
  if (!existing) {
    db.createTrack({
      creatorId: creator.id,
      title: t.title,
      description: t.description,
      audioUrl: `/api/tracks/audio/${t.filename}`,
      durationSec: t.durationSec,
      pricePerSec: t.pricePerSec,
    });
    console.log('[seed] added track:', t.title);
  }
}

console.log('\n[seed] done!');
console.log('Creator login: email = demo-creator@perstream.fm');
console.log('Listener login: email = demo-listener@perstream.fm');
console.log('Tracks:', db.listTracks({ creatorId: creator.id }).length);
}

main().catch(err => {
  console.error('[seed] fatal:', err);
  process.exit(1);
});