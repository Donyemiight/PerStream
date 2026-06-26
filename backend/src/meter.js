/**
 * PerStream Meter — the per-second settlement engine.
 *
 * For each active session, ticks every N milliseconds and:
 *   1. Calls arc.tick() (mock or live)
 *   2. Updates DB session totals + track stats
 *
 * Mock mode: in-memory accounting, no chain interaction.
 * Live mode: calls PerStreamPaymaster.tick() on Arc.
 */

const db = require('./db');
const arc = require('./arc');

// Tick interval — 1 second is the canonical unit
const TICK_INTERVAL_MS = 1000;

class Meter {
  constructor() {
    /** @type {Map<string, NodeJS.Timeout>} */
    this.timers = new Map();
    this.running = false;
  }

  /**
   * Start the meter for a session.
   * @param {object} session  row from db.getSession()
   */
  start(session) {
    if (this.timers.has(session.id)) {
      // Already running — no-op
      return;
    }

    const timer = setInterval(async () => {
      try {
        await this._tick(session);
      } catch (err) {
        console.error(`[meter] tick failed for session ${session.id}:`, err.message);
        this.stop(session.id);
      }
    }, TICK_INTERVAL_MS);

    this.timers.set(session.id, timer);
    this.running = this.timers.size > 0;
    console.log(`[meter] started session ${session.id} (track ${session.track_id})`);
  }

  /**
   * Stop the meter for a session. Closes session in DB.
   */
  stop(sessionId) {
    const timer = this.timers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(sessionId);
      db.closeSession(sessionId);
      console.log(`[meter] stopped session ${sessionId}`);
    }
    this.running = this.timers.size > 0;
  }

  /**
   * Stop all running sessions (for graceful shutdown).
   */
  stopAll() {
    for (const sessionId of [...this.timers.keys()]) {
      this.stop(sessionId);
    }
  }

  /**
   * Internal tick — called every TICK_INTERVAL_MS per session.
   */
  async _tick(session) {
    // Re-read session from DB in case it was closed externally
    const fresh = db.getSession(session.id);
    if (!fresh || !fresh.active) {
      this.stop(session.id);
      return;
    }

    const pricePerSec = fresh.price_per_sec;
    const track = db.getTrack(fresh.track_id);

    // Stop the meter if track duration was hit
    if (track && track.duration_sec > 0 && fresh.seconds_played >= track.duration_sec) {
      this.stop(session.id);
      return;
    }

    // Resolve listener/creator to their wallet addresses (mock ledger is keyed by wallet)
    const listenerUser = db.getUser(fresh.listener_id);
    const creatorUser = db.getUser(fresh.creator_id);

    // Settle one second
    const result = await arc.tick({
      sessionId: fresh.id,
      listener: listenerUser ? listenerUser.wallet : fresh.listener_id,
      creator: creatorUser ? creatorUser.wallet : fresh.creator_id,
      pricePerSec,
      seconds: 1,
    });

    if (result.ok) {
      db.tickSession(fresh.id, pricePerSec);
      db.incrementTrackStats(fresh.track_id, pricePerSec);
    } else {
      // Listener ran out of deposit — stop the meter gracefully
      console.log(`[meter] session ${fresh.id}: ${result.reason}, stopping`);
      this.stop(fresh.id);
    }
  }

  /** Number of currently-metered sessions */
  active() {
    return this.timers.size;
  }
}

module.exports = new Meter();